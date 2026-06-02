require("dotenv").config();
require("./db/db");
require("./bots/telegram");
const { client, startDiscordBot, setReady } = require("./bots/discordBot");
const { registerCommands } = require("./bots/discord");
require("./scheduler/scheduler");
const logger = require("./utils/logger");
const { checkGames } = require("./services/gamesServices");
const { notifyGames, notifyDiscordGames } = require("./services/notification");
const { getAllGames } = require("./db/db");

async function startBots() {
  await startDiscordBot();
  registerCommands();
  client.once("ready", () => {
    setReady(true);
    logger.info(`Bot de Discord conectado como ${client.user.tag}`);
  });
  logger.info("Bots iniciados correctamente.");
  await checkGames(false, false);
  getAllGames((err, games) => {
    if (err) {
      logger.error(err);
      return;
    }

    notifyGames(games, null, false);
    notifyDiscordGames(games);
  });
}

startBots().catch((err) => {
  logger.error("Error al iniciar el bot: " + err.message);
});
