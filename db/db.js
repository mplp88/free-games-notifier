const sqlite3 = require("sqlite3").verbose();
const { Game } = require("../models/Game");
const logger = require('../utils/logger')

const db = new sqlite3.Database("./games.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (chat_id TEXT PRIMARY KEY)`);
  db.run(`CREATE TABLE IF NOT EXISTS notified_games (
    game_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL);`);
  db.run(`CREATE TABLE IF NOT EXISTS user_game_notifications (
    user_id TEXT,
    game_id TEXT,
    PRIMARY KEY (user_id, game_id));`);
});

db.get("PRAGMA table_info(notified_games);", (err, row) => {
  if (err) return logger.error(err);

  db.all("PRAGMA table_info(notified_games);", (err, columns) => {
    if (err) return logger.error(err);

    const hasSourceColumn = columns.some((col) => col.name === "source");

    if (!hasSourceColumn) {
      db.run(
        "ALTER TABLE notified_games ADD COLUMN source TEXT DEFAULT 'unknown';",
        (err) => {
          if (err) logger.error("Error agregando columna source:", err);
        }
      );
    }
  });
});

function saveNotifiedGame(game) {
  db.run(
    `INSERT OR REPLACE INTO notified_games (game_id, title, url, start_date, end_date, source)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      game.id,
      game.title,
      game.url,
      game.offer.startDate,
      game.offer.endDate,
      game.source,
    ]
  );
}

function cleanupExpiredGames() {
  const now = new Date().toISOString();
  db.all(`SELECT game_id, end_date FROM notified_games`, [], (err, rows) => {
    if (err) return logger.error(err);
    logger.info("Limpiando juegos");

    rows.forEach(({ game_id, end_date }) => {
      if (end_date < now) {
        logger.info(`Limpiando juego con Id: ${game_id}`);
        db.run(`DELETE FROM notified_games WHERE game_id = ?`, [game_id]);
        db.run(`DELETE FROM user_game_notifications WHERE game_id = ?`, [
          game_id,
        ]);
      }
    });
  });
}

function saveUserNotification(userId, gameId) {
  db.run(
    `INSERT OR IGNORE INTO user_game_notifications (user_id, game_id)
    VALUES (?, ?)`,
    [userId, gameId]
  );
}

function wasUserNotified(userId, gameId, callback) {
  db.get(
    `SELECT 1 FROM user_game_notifications WHERE user_id = ? AND game_id = ?`,
    [userId, gameId],
    (err, row) => callback(err, !!row)
  );
}

function getAllUsers(callback) {
  db.all("SELECT chat_id FROM users", [], callback);
}

function getAllGames(callback) {
  logger.info("Obteniendo juegos de la DB");
  db.all("SELECT * FROM notified_games", [], (err, rows) => {
    if (err) return callback(err, null);

    const games = rows.map((row) => {
      return new Game(
        row.game_id,
        row.title,
        row.url,
        {
          startDate: row.start_date,
          endDate: row.end_date,
        },
        row.source
      );
    });

    callback(null, games);
  });
}

function getSteamGames(callback) {
  db.all(
    "SELECT * FROM notified_games WHERE source = 'steam'",
    [],
    (err, rows) => {
      if (err) return callback(err, null);

      const games = rows.map((row) => {
        return new Game(
          row.game_id,
          row.title,
          row.url,
          {
            startDate: row.start_date,
            endDate: row.end_date,
          },
          row.source
        );
      });

      callback(null, games);
    }
  );
}

function getEpicGames(callback) {
  db.all(
    "SELECT * FROM notified_games WHERE source = 'epic'",
    [],
    (err, rows) => {
      if (err) return callback(err, null);

      const games = rows.map((row) => {
        return new Game(
          row.game_id,
          row.title,
          row.url,
          {
            startDate: row.start_date,
            endDate: row.end_date,
          },
          row.source
        );
      });

      callback(null, games);
    }
  );
}

function addUser(chatId, callback) {
  db.run(
    "INSERT OR IGNORE INTO users (chat_id) VALUES (?)",
    [chatId],
    callback
  );
}

function deleteUser(chatId, callback) {
  db.run("DELETE FROM users WHERE chat_id = ?", [chatId], callback);
}

module.exports = {
  saveNotifiedGame,
  cleanupExpiredGames,
  saveUserNotification,
  wasUserNotified,
  getAllUsers,
  getAllGames,
  getEpicGames,
  getSteamGames,
  addUser,
  deleteUser,
};
