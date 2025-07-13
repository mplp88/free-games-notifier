const {
  saveUserNotification,
  wasUserNotified,
  getAllUsers,
} = require("../db/db");
const { bot } = require("../bots/telegramBot");

function notifyGames(games, chatId, force = false) {
  if (games.length > 0) {
    games.forEach((game) => {
      if (force) {
        forceNotifyUsers(game, chatId);
      } else {
        notifyUsersIfNotAlready(game, chatId);
      }
    });
  } else {
    notifyNotFound(chatId);
  }
}

async function notifyUsersIfNotAlready(game, specificChatId = null) {
  const message = `🎮 Nuevo juego gratis disponible: *${game.title}*\n\n[¡Consíguelo aquí!](${game.url})`;
  const options = { parse_mode: "Markdown" };

  const notify = (chatId) => {
    wasUserNotified(chatId, game.id, (err, alreadyNotified) => {
      if (err) return console.error(err);
      if (!alreadyNotified) {
        console.log("notifying user:", chatId);
        bot.sendMessage(chatId, message, options);
        saveUserNotification(chatId, game.id);
      }
    });
  };

  if (specificChatId) {
    notify(specificChatId);
  } else {
    getAllUsers((err, users) => {
      if (err) return console.error(err);
      users.forEach(({ chat_id }) => notify(chat_id));
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

function forceNotifyUsers(game, specificChatId = null) {
  const message = `🎮 Nuevo juego gratis disponible: *${game.title}*\n\n[¡Consíguelo aquí!](${game.url})`;
  const options = { parse_mode: "Markdown" };

  const notify = (chatId) => {
    bot.sendMessage(chatId, message, options);
  };

  if (specificChatId) {
    notify(specificChatId);
  } else {
    getAllUsers((err, users) => {
      if (err) return console.error(err);
      users.forEach(({ chat_id }) => notify(chat_id));
    });
  }
}

module.exports = { notifyGames };
