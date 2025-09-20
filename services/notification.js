const {
  saveUserNotification,
  wasUserNotified,
  getAllUsers,
  deleteUser,
} = require("../db/db");
const { bot } = require("../bots/telegramBot");
const { format } = require("date-fns");
const logger = require("../utils/logger");

function notifyGames(games, chatId, force = false, next = false) {
  if (games.length > 0) {
    games.forEach((game) => {
      logger.info(`Juego encontrado: ${game.title}`);
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
  const offerType = next ? "próximamente" : "disponible";
  const actionText = next ? "Miralo" : "Conseguilo";
  let message = `🎮 Nuevo juego gratis ${offerType} en ${game.source}: *${game.title}*\n\n[¡${actionText} acá!](${game.url})`;
  message += next
    ? `\n\n🕐 Oferta disponible a partir del: *${formattedStartDate}*`
    : `\n\n🕐 Oferta disponible hasta: *${formattedEndDate}*`;
  const options = { parse_mode: "Markdown" };

  const notify = (chatId, force = false) => {
    if (force) {
      bot.sendMessage(chatId, message, options);
    } else {
      wasUserNotified(chatId, game.id, async (err, alreadyNotified) => {
        if (err) return logger.error(err);
        if (!alreadyNotified) {
          try {
            logger.info(`Notificando usuario: ${chatId}`);
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
  if (!date) return "N/A";
  return format(new Date(date), "dd/MM/yy");
}

async function notifyCurrentGamesDiscord(interaction) {
  await interaction.reply(
    "🔄 Verificando nuevos juegos gratis, por favor espera..."
  );
  const games = await checkGames();
  if (!games.length) {
    await interaction.followUp(
      "😭 No se encontraron juegos gratis actualmente."
    );
  } else {
    for (const game of games) {
      await interaction.followUp(`🎮 **${game.title}**\n${game.url}`);
    }
  }
}

module.exports = { notifyGames, notifyCurrentGamesDiscord };
