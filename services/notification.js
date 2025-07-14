const {
  saveUserNotification,
  wasUserNotified,
  getAllUsers,
} = require("../db/db");
const { bot } = require("../bots/telegramBot");
const { format } = require("date-fns");

function notifyGames(games, chatId, force = false) {
  if (games.length > 0) {
    games.forEach((game) => {
      notifyUsers(game, chatId, force);
    });
  } else {
    notifyNotFound(chatId);
  }
}

async function notifyUsers(game, specificChatId = null, force = false) {
  const formattedStartDate = format(new Date(game.offer.startDate), "dd/MM/yy");
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
          console.log("notifying user:", chatId);
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

async function notifyNotFound(chatId) {
  console.log("No games found");
  const message = `😭 ¡No se encontraron nuevos juegos gratis!`;
  const options = { parse_mode: "Markdown" };

  if (chatId) {
    bot.sendMessage(chatId, message, options);
  } else {
    getAllUsers((err, users) => {
      if (err) return console.error(err);

      users.forEach(({ chat_id }) => {
        bot.sendMessage(chat_id, message, options);
      });
    });
  }
}

module.exports = { notifyGames };
