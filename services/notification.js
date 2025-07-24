const {
  saveUserNotification,
  wasUserNotified,
  getAllUsers,
} = require("../db/db");
const { bot } = require("../bots/telegramBot");
const { format } = require("date-fns");
const logger = require('../utils/logger')

function notifyGames(games, chatId, force = false) {
  if (games.length > 0) {
    games.forEach((game) => {
      notifyUsers(game, chatId, force);
    });
  }
}

async function notifyUsers(game, specificChatId = null, force = false) {
  const formattedEndDate = format(new Date(game.offer.endDate), "dd/MM/yy");
  let message = `🎮 Nuevo juego gratis disponible: *${game.title}*\n\n[¡Consíguelo aquí!](${game.url})`;
  message += game.offer.endDate
    ? `\n\n🕐 Oferta disponible hasta: *${formattedEndDate}*`
    : "";
  const options = { parse_mode: "Markdown" };

  const notify = (chatId, force = false) => {
    if (force) {
      bot.sendMessage(chatId, message, options);
    } else {
      wasUserNotified(chatId, game.id, (err, alreadyNotified) => {
        if (err) return console.error(err);
        if (!alreadyNotified) {
          logger.info(`Notificando usuario: ${chatId}`);
          bot.sendMessage(chatId, message, options);
          saveUserNotification(chatId, game.id);
        }
      });
    }
  };

  if (specificChatId) {
    notify(specificChatId, force);
  } else {
    getAllUsers((err, users) => {
      if (err) return console.error(err);
      users.forEach(({ chat_id }) => notify(chat_id, force));
    });
  }
}

module.exports = { notifyGames };
