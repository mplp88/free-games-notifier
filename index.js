require('dotenv').config();
require('./db/db');

const { client, startDiscordBot, setReady } = require('./bots/discordBot');
const { registerCommands } = require('./bots/discord');
const logger = require('./utils/logger');
const { checkGames } = require('./services/gamesServices');
const { notifyGames, notifyDiscordGames } = require('./services/notification');
const { getAllGames, initializeDatabase } = require('./db/db');
const fs = require('fs');

async function startBots() {
  await initializeDatabase();

  require('./bots/telegram');
  require('./scheduler/scheduler');

  await startDiscordBot();
  registerCommands();

  client.once('clientReady', () => {
    setReady(true);
    logger.info(`Bot de Discord conectado como ${client.user.tag}`);
  });

  logger.info('Bots iniciados correctamente.');
  await checkGames(false, false);

  const games = await getAllGames();
  await notifyGames(games, null, false);
  await notifyDiscordGames(games);
}

const pid = process.pid.toString();
fs.writeFileSync('./bot.pid', pid);

logger.info(`Bot iniciado con PID: ${pid}`);

startBots().catch((err) => {
  logger.error('Error al iniciar el bot: ' + err.message);
});
