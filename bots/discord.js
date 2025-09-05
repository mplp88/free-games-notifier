// TODO: WIP - No implementado todavía, falta configurar permisos de bot en discord
const { REST, Routes } = require("discord.js");
//const { checkGames } = require("../services/gamesServices");
const logger = require("../utils/logger");
const { client } = require("./discordBot");
const { notifyCurrentGamesDiscord } = require("../services/notification");

// Registra el slash command al iniciar el bot
async function registerCommands() {
  const commands = [
    {
      name: "subscribe",
      description: "Suscribe a las notificaciones de juegos",
    },
    {
      name: "stop",
      description: "Deja de enviar notificaciones",
    },
    {
      name: "current",
      description: "Muestra los juegos gratis actuales",
    },
    {
      name: "next",
      description:
        "Muestra los juegos gratis que estarán disponibles próximamente",
    },
    {
      name: "epic",
      description: "Muestra los juegos gratis actuales de Epic Games Store",
    },
    {
      name: "steam",
      description: "Muestra los juegos gratis actuales de Steam Store",
    },
    {
      name: "help",
      description: "Muestra la ayuda del bot",
    },
    {
      name: "info",
      description: "Muestra información sobre el bot",
    },
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
      body: commands,
    });
    logger.info("Slash commands registrados correctamente.");
  } catch (error) {
    logger.error("Error registrando slash commands: " + error.message);
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case "current":
      await notifyCurrentGamesDiscord(interaction);
  }
});

module.exports = { registerCommands };
