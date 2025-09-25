// TODO: WIP - No implementado todavía, falta configurar permisos de bot en discord
const { REST, Routes } = require("discord.js");
const { checkGames } = require("../services/gamesServices");
const logger = require("../utils/logger");
const { client, isBotReady } = require("./discordBot");
const { notifyDiscordGames, replyDiscord, followUpDiscord } = require("../services/notification");
const {
  addDiscordSubscription,
  deleteChannelSubscription,
} = require("../db/db");

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

  if (!isBotReady()) {
    return interaction.reply({
      content: "❌ El bot no está listo aún. Por favor, intentá más tarde.",
      ephemeral: true,
    });
  }

  await handleInteraction(interaction);
});

async function handleInteraction(interaction) {
switch (interaction.commandName) {
    case "current":
      await checkCurrentGames(interaction);
      break;
    case "subscribe":
      subscribe(interaction);
      break;
    case "stop":
      deleteSubscription(interaction);
      break;
    case "next":
      await checkNextGames(interaction);
      break;
    case "epic":
      break;
    case "steam":
      break;
    case "help":
      break;
    case "info":
      break;
    default:
      interaction.reply({
        content: "Comando no implementado aún.",
        ephemeral: true,
      });
      break;
  }
}

function subscribe(interaction) {
  const guildId = interaction.guild?.id;
  const channelId = interaction.channel?.id;

  if (!guildId || !channelId) {
    return interaction.reply({
      content: "❌ No pude identificar el servidor o canal.",
      ephemeral: true,
    });
  }

  addDiscordSubscription(guildId, channelId, (err) => {
    if (err) {
      logger.error("Error al agregar suscripción de Discord: " + err.message);
      return interaction.reply({
        content: "❌ No pude agregar la suscripción.",
        ephemeral: true,
      });
    }
    replyDiscord(interaction, {
      content:
        "✅ ¡Ya estás suscrito para recibir notificaciones de juegos gratis!",
      ephemeral: true,
    });

    setTimeout(async () => {
      followUpDiscord(interaction, "🔄 Verificando nuevos juegos gratis, por favor esperá...");
      const games = await checkGames(false, false);
      notifyDiscordGames(games);
    }, 500);
  });
}

function deleteSubscription(interaction) {
  deleteChannelSubscription(
    interaction.guild?.id,
    interaction.channel?.id,
    (dbErr) => {
      if (dbErr) {
        logger.error(
          `Error al eliminar suscripción ${interaction.channel?.id}: ${dbErr.message}`
        );
      }
    }
  );

  replyDiscord(interaction, "✅ Detuviste las notificaciones de juegos gratis.");
}

async function checkCurrentGames(interaction){
  const games = await checkGames(false, true);
  notifyDiscordGames(games, interaction, false);
}

async function checkNextGames(interaction) {
  const games = await checkGames(true, false);
  notifyDiscordGames(games, interaction, true);
}

module.exports = { registerCommands };
