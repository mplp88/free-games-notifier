const sqlite3 = require('sqlite3').verbose();
const { Game } = require('../models/Game');
const logger = require('../utils/logger');

const db = new sqlite3.Database('./games.db');

let initializationPromise = null;

// ============================================================
// SQLite Promise helpers
// ============================================================

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);

      resolve({
        lastID: this.lastID,
        changes: this.changes,
      });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      resolve(rows);
    });
  });
}

// ============================================================
// Database initialization and migrations
// ============================================================

async function getTableColumns(tableName) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  return columns.map(({ name }) => name);
}

async function addColumnIfMissing(tableName, columnName, definition) {
  const columns = await getTableColumns(tableName);

  if (columns.includes(columnName)) return;

  await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);

  logger.info(`Columna agregada: ${tableName}.${columnName}`);
}

async function initializeDatabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    logger.info('Inicializando base de datos...');

    try {
      // --------------------------------------------------------
      // Tables
      // --------------------------------------------------------

      await run(`
        CREATE TABLE IF NOT EXISTS users (
          chat_id TEXT PRIMARY KEY
        )
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS notified_games (
          game_id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL
        )
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS user_game_notifications (
          user_id TEXT,
          game_id TEXT,
          PRIMARY KEY (user_id, game_id)
        )
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS discord_subscriptions (
          guild_id TEXT,
          channel_id TEXT,
          PRIMARY KEY (guild_id, channel_id)
        )
      `);

      await run(`
        CREATE TABLE IF NOT EXISTS discord_channel_game_notifications (
          guild_id TEXT,
          channel_id TEXT,
          game_id TEXT,
          PRIMARY KEY (guild_id, channel_id, game_id)
        )
      `);

      // --------------------------------------------------------
      // Migrations
      // --------------------------------------------------------

      await addColumnIfMissing(
        'notified_games',
        'source',
        "TEXT DEFAULT 'unknown'",
      );

      await addColumnIfMissing('notified_games', 'imageUrl', "TEXT DEFAULT ''");

      await addColumnIfMissing(
        'user_game_notifications',
        'notified_at',
        'TEXT',
      );

      await addColumnIfMissing(
        'discord_channel_game_notifications',
        'notified_at',
        'TEXT',
      );

      logger.info('Base de datos inicializada correctamente.');
    } catch (error) {
      initializationPromise = null;

      logger.error(`Error inicializando la base de datos: ${error.message}`);

      throw error;
    }
  })();

  return initializationPromise;
}

// ============================================================
// Game persistence
// ============================================================

function saveNotifiedGame(game) {
  return run(
    `INSERT OR REPLACE INTO notified_games
      (game_id, title, url, start_date, end_date, source, imageUrl)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      game.id,
      game.title,
      game.url,
      game.offer.startDate,
      game.offer.endDate,
      game.source,
      game.imageUrl || '',
    ],
  );
}

async function cleanupExpiredGames() {
  const now = new Date().toISOString();

  const rows = await all(
    `SELECT game_id, start_date, end_date
     FROM notified_games`,
  );

  // Conservamos por ahora la condición de limpieza original.
  // Su semántica merece una revisión independiente.
  const expiredGames = rows.filter(
    ({ start_date, end_date }) => start_date > now || end_date < now,
  );

  for (const { game_id } of expiredGames) {
    await run('DELETE FROM user_game_notifications WHERE game_id = ?', [
      game_id,
    ]);

    await run(
      `DELETE FROM discord_channel_game_notifications
       WHERE game_id = ?`,
      [game_id],
    );

    await run('DELETE FROM notified_games WHERE game_id = ?', [game_id]);
  }

  logger.info(
    expiredGames.length === 0
      ? 'Limpieza finalizada: nada que limpiar.'
      : `Limpieza finalizada: ${expiredGames.length} juego/s eliminado/s.`,
  );

  return expiredGames.length;
}

// ============================================================
// User notifications
// ============================================================

function saveUserNotification(userId, gameId) {
  return run(
    `INSERT OR IGNORE INTO user_game_notifications
      (user_id, game_id, notified_at)
     VALUES (?, ?, ?)`,
    [userId, gameId, new Date().toISOString()],
  );
}

async function wasUserNotified(userId, gameId) {
  const row = await get(
    `SELECT 1
     FROM user_game_notifications
     WHERE user_id = ? AND game_id = ?`,
    [userId, gameId],
  );

  return Boolean(row);
}

// ============================================================
// Discord notifications
// ============================================================

function saveChannelNotification(guildId, channelId, game) {
  return run(
    `INSERT OR IGNORE INTO discord_channel_game_notifications
      (guild_id, channel_id, game_id, notified_at)
     VALUES (?, ?, ?, ?)`,
    [guildId, channelId, game.id, new Date().toISOString()],
  );
}

async function wasChannelNotified(guildId, channelId, gameId) {
  const row = await get(
    `SELECT 1
     FROM discord_channel_game_notifications
     WHERE guild_id = ?
       AND channel_id = ?
       AND game_id = ?`,
    [guildId, channelId, gameId],
  );

  return Boolean(row);
}

// ============================================================
// Game queries
// ============================================================

function mapGame(row) {
  return new Game(
    row.game_id,
    row.title,
    row.url,
    {
      startDate: row.start_date,
      endDate: row.end_date,
    },
    row.source,
    row.imageUrl || '',
  );
}

async function getGamesBySource(source = null) {
  const sql = source
    ? 'SELECT * FROM notified_games WHERE source = ?'
    : 'SELECT * FROM notified_games';

  const params = source ? [source] : [];

  const rows = await all(sql, params);

  return rows.map(mapGame);
}

async function getAllGames() {
  logger.info('Obteniendo juegos de la DB');

  return getGamesBySource();
}

function getEpicGames() {
  return getGamesBySource('epic');
}

function getSteamGames() {
  return getGamesBySource('steam');
}

// ============================================================
// User management
// ============================================================

function getAllUsers() {
  return all('SELECT chat_id FROM users');
}

function addUser(chatId) {
  return run('INSERT OR IGNORE INTO users (chat_id) VALUES (?)', [chatId]);
}

function deleteUser(chatId) {
  return run('DELETE FROM users WHERE chat_id = ?', [chatId]);
}

// ============================================================
// Discord subscription management
// ============================================================

function addDiscordSubscription(guildId, channelId) {
  return run(
    `INSERT OR IGNORE INTO discord_subscriptions
      (guild_id, channel_id)
     VALUES (?, ?)`,
    [guildId, channelId],
  );
}

function getDiscordSubscriptions() {
  return all(
    `SELECT guild_id, channel_id
     FROM discord_subscriptions`,
  );
}

function deleteChannelSubscription(guildId, channelId) {
  return run(
    `DELETE FROM discord_subscriptions
     WHERE guild_id = ? AND channel_id = ?`,
    [guildId, channelId],
  );
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  initializeDatabase,

  saveNotifiedGame,
  cleanupExpiredGames,

  saveUserNotification,
  wasUserNotified,
  getAllUsers,
  addUser,
  deleteUser,

  getAllGames,
  getEpicGames,
  getSteamGames,

  addDiscordSubscription,
  getDiscordSubscriptions,
  saveChannelNotification,
  wasChannelNotified,
  deleteChannelSubscription,
};
