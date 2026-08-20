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

function notifyGames(games, chatId, force = false, next = false) {
  if (games.length > 0) {
    games.forEach((game) => {
      const { source } = game;
      logger.info(
        `Juego encontrado en ${source.replace(
          source.at(0),
          source.at(0).toUpperCase(),
        )}: ${game.title}`,
      );
      notifyUsers(game, chatId, force, next);
    });
  }
}

async function notifyUsers(
  game,
  specificChatId = null,
  force = false,
  next = false,
) {
  const message = formatMessage(game);
  const options = { parse_mode: 'Markdown' };

  const notify = (chatId, force = false) => {
    if (force) {
      bot.sendMessage(chatId, message, options);
    } else {
      wasUserNotified(chatId, game.id, async (err, alreadyNotified) => {
        if (err) return logger.error(err);
        if (!alreadyNotified) {
          try {
            logger.info(`Notificando en Telegram: usuario ${chatId}`);
            await bot.sendMessage(chatId, message, options);
            saveUserNotification(chatId, game.id);
          } catch (err) {
            if (err.response && err.response.statusCode === 403) {
              logger.warn(
                `Usuario ${chatId} bloqueó al bot. Eliminándolo de la DB.`,
              );
              deleteUser(chatId, (dbErr) => {
                if (dbErr)
                  logger.error(
                    `Error al eliminar usuario ${chatId}: ${dbErr.message}`,
                  );
              });
            } else {
              logger.error(
                `Error enviando mensaje a ${chatId}: ${err.message}`,
              );
            }
          }
        }
      });
    }
  };

  if (specificChatId) {
    notify(specificChatId, force);
  } else {
    getAllUsers((err, users) => {
      if (err) return logger.error(err);
      users.forEach(({ chat_id }) => notify(chat_id, force));
    });
  }
}

function formatDate(date) {
  if (!date) return 'N/A';
  return format(new Date(date), 'dd/MM/yy');
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
      const _embed = formatEmbed(game, next);
      await followUpDiscord(interaction, { embeds: [_embed] });
    }
    // En las interacciones, followUp acepta el objeto con la propiedad embeds
  } else {
    getDiscordSubscriptions((err, rows) => {
      if (err) return console.error(err);

      rows.forEach(({ guild_id, channel_id }) => {
        const guild = client.guilds.cache.get(guild_id);
        const channel = guild?.channels.cache.get(channel_id);

        for (const game of games) {
          if (channel && channel.isTextBased()) {
            wasChannelNotified(
              guild_id,
              channel_id,
              game.id,
              (err, alreadyNotified) => {
                if (err) {
                  logger.error(err);
                  return;
                }

                if (alreadyNotified) return;

                logger.info(
                  `Notificando en Discord: Servidor ${guild_id}, canal: ${channel_id}`,
                );

                const _embed = formatEmbed(game, next);
                // Enviamos el embed al canal
                channel.send({ embeds: [_embed] });

                saveChannelNotification(guild_id, channel_id, game);
              },
            );
          }
        }
      });
    });
  }
}

async function replyDiscord(interaction, reply, ephemeral = false) {
  try {
    await interaction.reply({
      content: reply,
      flags: ephemeral ? MessageFlags.ephemeral : undefined,
    });
  } catch (e) {
    logger.error('Error al enviar mensaje en Discord: ' + e.message);
  }
}

async function followUpDiscord(interaction, reply, ephemeral = false) {
  try {
    const payload =
      typeof reply === 'string'
        ? {
            content: reply,
            flags: ephemeral ? MessageFlags.ephemeral : undefined,
          }
        : { ...reply, flags: ephemeral ? MessageFlags.ephemeral : undefined };

    await interaction.followUp(payload);
  } catch (e) {
    logger.error('Error al enviar mensaje en Discord: ' + e.message);
  }
}

function formatMessage(game, next = false) {
  const formattedStartDate = formatDate(game.offer.startDate);
  const formattedEndDate = formatDate(game.offer.endDate);
  const offerType = next ? 'próximamente' : 'disponible';
  const actionText = next ? 'Miralo' : 'Conseguilo';
  const { source, title, url } = game;
  const capitalizedSource = source.replace(
    source.at(0),
    source.at(0).toUpperCase(),
  );
  let message = `🎮 Nuevo juego gratis ${offerType} en ${capitalizedSource}: *${title}*\n\n[¡${actionText} acá!](${url})`;
  message += next
    ? `\n\n🕐 Oferta disponible a partir del: *${formattedStartDate}*`
    : `\n\n🕐 Oferta disponible hasta: *${formattedEndDate}*`;
  return message;
}

function formatEmbed(game, next = false) {
  const isEpic = game.source?.toLowerCase() === 'epic';

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
    name: game.source,
    color: 0x5865f2,
    iconUrl: null,
  };

  const offerType = next ? 'próximamente' : 'disponible';
  const targetDate = next ? game.offer.startDate : game.offer.endDate;
  const dateLabel = next
    ? 'Disponible a partir del'
    : 'Oferta disponible hasta';

  // Timestamp de Discord (<t:UNIX:F> muestra fecha/hora y <t:UNIX:R> muestra el "en X días")
  let dateValue = 'Fecha no disponible';
  if (targetDate) {
    const unixTimestamp = Math.floor(new Date(targetDate).getTime() / 1000);
    dateValue = `<t:${unixTimestamp}:F> (<t:${unixTimestamp}:R>)`;
  }

  const embed = new EmbedBuilder()
    .setTitle(game.title)
    .setURL(game.url)
    .setColor(config.color)
    .setAuthor({
      name: `🎮 Nuevo juego gratis ${offerType} en ${config.name}`,
      iconURL: config.iconUrl,
    })
    .addFields({ name: `🕐 ${dateLabel}`, value: dateValue, inline: false })
    .setFooter({ text: 'Free Games Notifier' })
    .setTimestamp()
    .setImage(game.imageUrl);

  return embed;
}

module.exports = {
  notifyGames,
  notifyDiscordGames,
  replyDiscord,
  followUpDiscord,
};
