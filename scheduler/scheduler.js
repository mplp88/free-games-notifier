const cron = require("node-schedule");
const { checkGames } = require("../services/gamesServices");
const { notifyGames, notifyDiscordGames } = require("../services/notification");
const logger = require("../utils/logger");

let isRunning = false;

// Ejecutar cada hora en el minuto 5
cron.scheduleJob("5 * * * *", async () => {
  if (isRunning) {
    logger.warn("El Cron está corriendo.");
    return;
  }

  isRunning = true;

  try {
    logger.info("Ejecución de Cron");
    const games = await checkGames(false, false);
    notifyGames(games, null, false);
    notifyDiscordGames(games);
  } catch (err) {
    logger.error("Error en Cron: " + err.message);
  } finally {
    isRunning = false;
  }
});
