
const cron = require("node-schedule");
const { checkGames } = require('../services/gamesServices')
const { notifyGames } = require('../services/notification')
const logger = require('../utlis/logger')

// Ejecutar cada hora en el minuto 0
cron.scheduleJob("0 * * * *", async () => {
  logger.info('cron run')
  const games = await checkGames(false, false)
  notifyGames(games, null, false)
});
