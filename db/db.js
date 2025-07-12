const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("games.db");

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

module.exports = { db };
