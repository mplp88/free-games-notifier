const {
  saveUserNotification,
  saveChannelNotification,
  wasUserNotified,
  wasChannelNotified,
  getAllUsers,
  getDiscordSubscriptions,
  deleteUser,
} = require('../db/db');

const { bot } = require('../bots/telegramBot');
const { client } = require('../bots/discordBot');
const { format } = require('date-fns');
const logger = require('../utils/logger');
const { EmbedBuilder, MessageFlags } = require('discord.js');

function capitalize(value = '') {
  if (!value) return 'Unknown';

  return value.charAt(0).toUpperCase() + value.slice(1);
}

const LAUNCHER_REDIRECT_BASE_URL =
  'https://free-games-notifier.martinponce.com.ar';

function getLauncherUrl(game) {
  if (!game?.source || !game?.url) return null;

  try {
    const storeUrl = new URL(game.url);
    const source = game.source.toLowerCase();

    if (source === 'steam') {
      if (storeUrl.hostname !== 'store.steampowered.com') {
        return null;
      }

      const match = storeUrl.pathname.match(/\/app\/(\d+)/);

      if (!match) return null;

      return `${LAUNCHER_REDIRECT_BASE_URL}/steam/${match[1]}`;
    }

    if (source === 'epic') {
      if (
        storeUrl.hostname !== 'store.epicgames.com' &&
        storeUrl.hostname !== 'www.epicgames.com'
      ) {
        return null;
      }

      const segments = storeUrl.pathname.split('/').filter(Boolean);

      const productIndex = segments.indexOf('p');
      const slug = segments[productIndex + 1];

      if (!slug || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
        return null;
      }

      return `${LAUNCHER_REDIRECT_BASE_URL}/epic/${slug}`;
    }

    return null;
  } catch (error) {
    logger.warn(
      `No se pudo generar el enlace del launcher para ${game.title}: ${error.message}`,
    );

    return null;
  }
}

function notifyGames(games, chatId, force = false, next = false) {
  return processTelegramNotifications(games, chatId, force, next);
}

async function processTelegramNotifications(games, chatId, force, next) {
  if (!Array.isArray(games) || games.length === 0) return;

  for (const game of games) {
    logger.info(
      `Juego encontrado en ${capitalize(game.source)}: ${game.title}`,
    );

    await notifyUsers(game, chatId, force, next);
  }
}

async function notifyUsers(
  game,
  specificChatId = null,
  force = false,
  next = false,
) {
  const message = formatMessage(game, next);
  const options = { parse_mode: 'Markdown' };

  let users;

  if (specificChatId !== null && specificChatId !== undefined) {
    users = [{ chat_id: specificChatId }];
  } else {
    try {
      users = await getAllUsers();
    } catch (error) {
      logger.error(`Error obteniendo usuarios de Telegram: ${error.message}`);
      return;
    }
  }

  for (const { chat_id } of users) {
    if (!force) {
      try {
        const alreadyNotified = await wasUserNotified(chat_id, game.id);

        if (alreadyNotified) continue;
      } catch (error) {
        logger.error(
          `Error consultando historial de Telegram para ${chat_id}: ${error.message}`,
        );
        continue;
      }
    }

    try {
      logger.info(`Notificando en Telegram: usuario ${chat_id}`);

      await bot.sendMessage(chat_id, message, options);
    } catch (error) {
      if (error.response?.statusCode === 403) {
        logger.warn(
          `Usuario ${chat_id} bloqueó al bot. Eliminándolo de la DB.`,
        );

        try {
          await deleteUser(chat_id);
        } catch (dbError) {
          logger.error(
            `Error al eliminar usuario ${chat_id}: ${dbError.message}`,
          );
        }
      } else {
        logger.error(`Error enviando mensaje a ${chat_id}: ${error.message}`);
      }

      continue;
    }

    // Las notificaciones forzadas no se guardan en el historial,
    // manteniendo el comportamiento anterior.
    if (!force) {
      try {
        await saveUserNotification(chat_id, game.id);
      } catch (error) {
        logger.error(
          `Error guardando notificación de Telegram para ${chat_id}: ${error.message}`,
        );
      }
    }
  }
}

function formatDate(date) {
  if (!date) return 'N/A';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return 'N/A';

  return format(parsedDate, 'dd/MM/yy');
}

async function notifyDiscordGames(games, interaction = null, next = false) {
  if (interaction) {
    await replyDiscord(
      interaction,
      '🔄 Verificando nuevos juegos gratis, por favor esperá...',
    );

    if (!games.length) {
      await followUpDiscord(
        interaction,
        '😭 No se encontraron juegos gratis actualmente.',
      );
      return;
    }

    for (const game of games) {
      const embed = formatEmbed(game, next);

      await followUpDiscord(interaction, { embeds: [embed] });
    }

    return;
  }

  if (!Array.isArray(games) || games.length === 0) return;

  let subscriptions;

  try {
    subscriptions = await getDiscordSubscriptions();
  } catch (error) {
    logger.error(`Error obteniendo suscripciones de Discord: ${error.message}`);
    return;
  }

  for (const { guild_id, channel_id } of subscriptions) {
    const guild = client.guilds.cache.get(guild_id);
    const channel = guild?.channels.cache.get(channel_id);

    if (!channel || !channel.isTextBased() || !channel.send) {
      logger.warn(
        `No se encontró un canal de texto válido para la suscripción ${guild_id}/${channel_id}.`,
      );
      continue;
    }

    for (const game of games) {
      try {
        const alreadyNotified = await wasChannelNotified(
          guild_id,
          channel_id,
          game.id,
        );

        if (alreadyNotified) continue;
      } catch (error) {
        logger.error(
          `Error consultando historial de Discord (${guild_id}/${channel_id}): ${error.message}`,
        );
        continue;
      }

      logger.info(
        `Notificando en Discord: Servidor ${guild_id}, canal: ${channel_id}`,
      );

      const embed = formatEmbed(game, next);

      try {
        await channel.send({ embeds: [embed] });
      } catch (error) {
        logger.error(
          `Error enviando mensaje a Discord (${guild_id}/${channel_id}): ${error.message}`,
        );
        continue;
      }

      // Registrar solamente después de confirmar el envío.
      try {
        await saveChannelNotification(guild_id, channel_id, game);
      } catch (error) {
        logger.error(
          `Error guardando notificación de Discord (${guild_id}/${channel_id}): ${error.message}`,
        );
      }
    }
  }
}

async function replyDiscord(interaction, reply, ephemeral = false) {
  try {
    await interaction.reply({
      content: reply,
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    });

    return true;
  } catch (error) {
    logger.error(`Error al enviar mensaje en Discord: ${error.message}`);

    return false;
  }
}

async function followUpDiscord(interaction, reply, ephemeral = false) {
  try {
    const payload =
      typeof reply === 'string'
        ? {
            content: reply,
            flags: ephemeral ? MessageFlags.Ephemeral : undefined,
          }
        : {
            ...reply,
            flags: ephemeral ? MessageFlags.Ephemeral : undefined,
          };

    await interaction.followUp(payload);

    return true;
  } catch (error) {
    logger.error(`Error al enviar seguimiento en Discord: ${error.message}`);

    return false;
  }
}

function formatMessage(game, next = false) {
  const formattedStartDate = formatDate(game.offer.startDate);
  const formattedEndDate = formatDate(game.offer.endDate);
  const offerType = next ? 'próximamente' : 'disponible';
  const actionText = next ? 'Miralo' : 'Conseguilo';
  const { source, title, url } = game;

  const capitalizedSource = capitalize(source);
  const launcherUrl = getLauncherUrl(game);

  let message = `🎮 Nuevo juego gratis ${offerType} en ${capitalizedSource}: *${title}*\n\n[¡${actionText} acá!](${url})`;

  if (launcherUrl) {
    message += `\n\n[🚀 Ver en la app](${launcherUrl})`;
  }

  message += next
    ? `\n\n🕐 Oferta disponible a partir del: *${formattedStartDate}*`
    : `\n\n🕐 Oferta disponible hasta: *${formattedEndDate}*`;

  return message;
}

function formatEmbed(game, next = false) {
  const sourceConfig = {
    epic: {
      name: 'Epic Games Store',
      color: 0x0078f2,
      iconUrl:
        'https://upload.wikimedia.org/wikipedia/commons/a/a7/Epic_Games_logo.png',
    },
    steam: {
      name: 'Steam',
      color: 0x171a21,
      iconUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c1/Steam_Logo.png',
    },
  };

  const config = sourceConfig[game.source?.toLowerCase()] || {
    name: game.source || 'Unknown',
    color: 0x5865f2,
    iconUrl: null,
  };

  const offerType = next ? 'próximamente' : 'disponible';
  const targetDate = next ? game.offer.startDate : game.offer.endDate;

  const dateLabel = next
    ? 'Disponible a partir del'
    : 'Oferta disponible hasta';

  let dateValue = 'Fecha no disponible';

  if (targetDate) {
    const unixTimestamp = Math.floor(new Date(targetDate).getTime() / 1000);

    if (Number.isFinite(unixTimestamp)) {
      dateValue = `<t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;
    }
  }

  const author = {
    name: `🎮 Nuevo juego gratis ${offerType} en ${config.name}`,
  };

  if (config.iconUrl) {
    author.iconURL = config.iconUrl;
  }

  const launcherUrl = getLauncherUrl(game);

  const embed = new EmbedBuilder()
    .setTitle(game.title)
    .setURL(game.url)
    .setColor(config.color)
    .setAuthor(author)
    .addFields({
      name: `🕐 ${dateLabel}`,
      value: dateValue,
      inline: false,
    });

  if (launcherUrl) {
    embed.addFields({
      name: '🚀 Ver en la app',
      value: `[Abrir en ${config.name}](${launcherUrl})`,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Free Games Notifier' }).setTimestamp();

  if (game.imageUrl) {
    embed.setImage(game.imageUrl);
  }

  return embed;
}

module.exports = {
  notifyGames,
  notifyDiscordGames,
  replyDiscord,
  followUpDiscord,
};
