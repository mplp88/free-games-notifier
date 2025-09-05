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
  const formattedEndDate = format(new Date(game.offer.endDate), "dd/MM/yy");
  const offerType = next ? "próximamente" : "disponible";
  let message = `🎮 Nuevo juego gratis ${offerType}: *${game.title}*\n\n[¡Consíguelo aquí!](${game.url})`;
  message += game.offer.endDate
    ? `\n\n🕐 Oferta disponible hasta: *${formattedEndDate}*`
    : "";
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
