const {
  saveUserNotification,
  saveUserNotificationDiscord,
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

function notifyGames(games, chatId, force = false, next = false) {
  if (games.length > 0) {
    games.forEach((game) => {
      const { source } = game;
      logger.info(
        `Juego encontrado en ${source.replace(
          source.at(0),
          source.at(0).toUpperCase()
        )}: ${game.title}`
      );
      notifyUsers(game, chatId, force, next);
    });
  }
}

async function notifyUsers(
  game,
  specificChatId = null,
  force = false,
  next = false
) {
  const formattedStartDate = formatDate(game.offer.startDate);
  const formattedEndDate = formatDate(game.offer.endDate);
  const offerType = next ? 'próximamente' : 'disponible';
  const actionText = next ? 'Miralo' : 'Conseguilo';
  const { source, title, url } = game;
  const capitalizedSource = source.replace(
    source.at(0),
    source.at(0).toUpperCase()
  );
  let message = `🎮 Nuevo juego gratis ${offerType} en ${capitalizedSource}: *${title}*`;
  message += url ?? `\n\n[¡${actionText} acá!](${url})`;
  message += next
    ? `\n\n🕐 Oferta disponible a partir del: *${formattedStartDate}*`
    : `\n\n🕐 Oferta disponible hasta: *${formattedEndDate}*`;
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
                `Usuario ${chatId} bloqueó al bot. Eliminándolo de la DB.`
              );
              deleteUser(chatId, (dbErr) => {
                if (dbErr)
                  logger.error(
                    `Error al eliminar usuario ${chatId}: ${dbErr.message}`
                  );
              });
            } else {
              logger.error(
                `Error enviando mensaje a ${chatId}: ${err.message}`
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
      '🔄 Verificando nuevos juegos gratis, por favor esperá...'
    );
    if (!games.length) {
      await followUpDiscord(
        interaction,
        '😭 No se encontraron juegos gratis actualmente.'
      );

      return;
    }

    for (const game of games) {
      await followUpDiscord(interaction, `🎮 **${game.title}**\n${game.url}`);
    }
  } else {
    getDiscordSubscriptions((err, rows) => {
      if (err) return console.error(err);

      rows.forEach(({ guild_id, channel_id }) => {
        const guild = client.guilds.cache.get(guild_id);
        const channel = guild?.channels.cache.get(channel_id);

        if (channel && channel.isTextBased()) {
          games.forEach((game) => {
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
                  `Notificando en Discord: Servidor ${guild_id}, canal: ${channel_id}`
                );
                const formattedStartDate = formatDate(game.offer.startDate);
                const formattedEndDate = formatDate(game.offer.endDate);
                const offerType = next ? 'próximamente' : 'disponible';
                const actionText = next ? 'Miralo' : 'Conseguilo';
                const { source, title, url } = game;
                const capitalizedSource = source.replace(
                  source.at(0),
                  source.at(0).toUpperCase()
                );
                let message = `🎮 Nuevo juego gratis ${offerType} en ${capitalizedSource}: *${title}*\n\n[¡${actionText} acá!](${url})`;
                message += next
                  ? `\n\n🕐 Oferta disponible a partir del: *${formattedStartDate}*`
                  : `\n\n🕐 Oferta disponible hasta: *${formattedEndDate}*`;
                channel.send(message);

                saveUserNotificationDiscord(guild_id, channel_id, game);
              }
            );
          });
        }
      });
    });
  }
}

async function replyDiscord(interaction, reply, ephemeral = true) {
  await interaction.reply({ content: reply, ephemeral });
}

async function followUpDiscord(interaction, reply, ephemeral = true) {
  await interaction.followUp({ content: reply, ephemeral });
}

module.exports = {
  notifyGames,
  notifyDiscordGames,
  replyDiscord,
  followUpDiscord,
};
