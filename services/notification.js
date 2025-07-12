const { db } = require("../db/db");
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
    db.get(
      `SELECT 1 FROM user_game_notifications WHERE user_id = ? AND game_id = ?`,
      [chatId, game.id],
      (err, row) => {
        if (err) return console.error(err);
        if (!row) {
          console.log("notifying user: ", chatId);
          bot.sendMessage(chatId, message, options);
          saveUserNotification(chatId, game.id);
        }
      }
    );
  };

  if (specificChatId) {
    notify(specificChatId);
  } else {
    db.all("SELECT chat_id FROM users", [], (err, rows) => {
      if (err) return console.error(err);
      rows.forEach(({ chat_id }) => notify(chat_id));
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
    db.all("SELECT chat_id FROM users", [], (err, rows) => {
      if (err) return console.error(err);

      rows.forEach(({ chat_id }) => {
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
    db.all("SELECT chat_id FROM users", [], (err, rows) => {
      if (err) return console.error(err);
      rows.forEach(({ chat_id }) => notify(chat_id));
    });
  }
}

function saveUserNotification(userId, gameId) {
  db.run(
    `INSERT OR IGNORE INTO user_game_notifications (user_id, game_id)
    VALUES (?, ?)`,
    [userId, gameId]
  );
}

module.exports = { notifyGames };
