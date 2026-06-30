// TODO: WIP - No implementado todavía, falta configurar permisos de bot en discord
const { REST, Routes } = require('discord.js');
const {
  checkGames,
  checkEpicGames,
  checkSteamGames,
} = require('../services/gamesServices');
const logger = require('../utils/logger');
const { client, isBotReady } = require('./discordBot');
const {
  notifyDiscordGames,
  replyDiscord,
  followUpDiscord,
} = require('../services/notification');
const {
  addDiscordSubscription,
  deleteChannelSubscription,
} = require('../db/db');

// Registra el slash command al iniciar el bot
async function registerCommands() {
  const commands = [
    {
      name: 'subscribe',
      description: 'Suscribe a las notificaciones de juegos',
    },
    {
      name: 'stop',
      description: 'Deja de enviar notificaciones',
    },
    {
      name: 'current',
      description: 'Muestra los juegos gratis actuales',
    },
    {
      name: 'next',
      description:
        'Muestra los juegos gratis que estarán disponibles próximamente',
    },
    {
      name: 'epic',
      description: 'Muestra los juegos gratis actuales de Epic Games Store',
    },
    {
      name: 'steam',
      description: 'Muestra los juegos gratis actuales de Steam Store',
    },
    {
      name: 'help',
      description: 'Muestra la ayuda del bot',
    },
    {
      name: 'info',
      description: 'Muestra información sobre el bot',
    },
    {
      name: 'donate',
      description: 'Muestra información sobre Opciones para apoyar el proyecto',
    },
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
      body: commands,
    });
    logger.info('Slash commands registrados correctamente.');
  } catch (error) {
    logger.error('Error registrando slash commands: ' + error.message);
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!isBotReady()) {
    return interaction.reply({
      content: '❌ El bot no está listo aún. Por favor, intentá más tarde.',
      ephemeral: true,
    });
  }

  await handleInteraction(interaction);
});

async function handleInteraction(interaction) {
  switch (interaction.commandName) {
    case 'current':
      await checkCurrentGames(interaction);
      break;
    case 'subscribe':
      subscribe(interaction);
      break;
    case 'stop':
      deleteSubscription(interaction);
      break;
    case 'next':
      await checkNextGames(interaction);
      break;
    case 'epic':
      await checkEpicGamesDiscord(interaction);
      break;
    case 'steam':
      await checkSteamGamesDiscord(interaction);
      break;
    case 'help':
      await sendHelpMessage(interaction);
      break;
    case 'info':
      await sendInfoMessage(interaction);
      break;
    case 'donate':
      await sendDonateInfo(interaction);
      break;
    default:
      interaction.reply({
        content: 'Comando no implementado aún.',
        ephemeral: true,
      });
      break;
  }
}

function subscribe(interaction) {
  const guildId = interaction.guild?.id;
  const channelId = interaction.channel?.id;

  if (!guildId || !channelId) {
    logger.error('No se pudo obtener guildId o channelId para la suscripción');
    replyDiscord(
      interaction,
      '❌ No pude identificar el servidor o canal.',
      true,
    );
    return;
  }

  addDiscordSubscription(guildId, channelId, (err) => {
    logger.info(
      `Agregando suscripción de Discord: Servidor ${guildId}, canal: ${channelId}`,
    );
    if (err) {
      logger.error('Error al agregar suscripción de Discord: ' + err.message);
      replyDiscord(interaction, '❌ No pude agregar la suscripción.');
      return;
    }

    logger.info('Enviando mensaje de suscripción exitosa en Discord');
    replyDiscord(
      interaction,
      '✅ ¡Ya estás suscrito para recibir notificaciones de juegos gratis!',
    );

    setTimeout(async () => {
      const games = await checkGames(false, true);
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
          `Error al eliminar suscripción ${interaction.channel?.id}: ${dbErr.message}`,
        );
      }
    },
  );

  replyDiscord(
    interaction,
    '✅ Detuviste las notificaciones de juegos gratis.',
  );
}

async function checkCurrentGames(interaction) {
  const games = await checkGames(false, true);
  await notifyDiscordGames(games, interaction, false);
}

async function checkNextGames(interaction) {
  const games = await checkGames(true, false);
  await notifyDiscordGames(games, interaction, true);
}

async function checkEpicGamesDiscord(interaction) {
  const games = await checkEpicGames();
  await notifyDiscordGames(games, interaction, false);
}

async function checkSteamGamesDiscord(interaction) {
  const games = await checkSteamGames();
  await notifyDiscordGames(games, interaction, false);
}

async function sendHelpMessage(interaction) {
  const part1 = `🤖 *Comandos disponibles*\n\nAquí tenés una lista rápida de lo que podés hacer con el bot ⬇️`;

  const part2 =
    `🟢 *Comandos básicos*\n` +
    `/start - Inicia el bot y muestra el mensaje de bienvenida\n` +
    `/subscribe - Te suscribe a las notificaciones automáticas de juegos\n` +
    `/stop - Deja de enviarte notificaciones\n` +
    `/help - Muestra este mensaje de ayuda\n` +
    `/info - Muestra información sobre el bot\n` +
    `/donate - Opciones para apoyar el proyecto`;

  const part3 =
    `🎮 *Comandos de juegos*\n` +
    `/current - Lista de juegos gratis disponibles ahora\n` +
    `/next - Lista de juegos gratis de la próxima semana\n` +
    `/epic - Juegos gratis actuales en Epic Games Store\n` +
    `/steam - Juegos gratis actuales en Steam Store`;

  await replyDiscord(interaction, part1);

  await followUpDiscord(interaction, part2);

  await followUpDiscord(interaction, part3);
}

async function sendInfoMessage(interaction) {
  const infoMessage =
    `ℹ️ *Acerca del bot*\n\n` +
    `Este bot te avisa cuando hay *juegos gratis* en Epic Games Store y Steam 🎉\n` +
    `Funciona de manera automática cada hora y también podés consultarlo con los comandos.\n\n` +
    `🔗 Proyecto desarrollado por <@299234428222177291> (2025).\n` +
    `💡 Código abierto y en constante mejora 🚀\n\n` +
    `🙏 Si el bot te resulta útil, podés apoyarlo con /donate`;
  await replyDiscord(interaction, infoMessage);
}

async function sendDonateInfo(interaction) {
  const donateMessage =
    `☕️ *¿Querés apoyar este bot?*\n\n` +
    `Si el bot te resulta útil, podés invitarme un café o colaborar por PayPal 🙌 \n\n` +
    `[☕️ Cafecito](https://cafecito.app/tehpon)   |   [💳 PayPal](https://paypal.me/tehpon)`;
  await replyDiscord(interaction, donateMessage);
}

module.exports = { registerCommands };
