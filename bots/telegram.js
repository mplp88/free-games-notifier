const { addUser, deleteUser } = require("../db/db");
const {
  checkGames,
  checkEpicGames,
  checkSteamGames,
} = require("../services/gamesServices");
const { notifyGames } = require("../services/notification");
const { bot } = require("./telegramBot");
const logger = require("../utils/logger");

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "🎮 Bienvenido a Free Games Bot\n\nUsá /subscribe para recibir notificaciones automáticas.\nUsá /stop para dejar de recibirlas.\nUsá /help para obtener ayuda."
  );
});

bot.onText(/\/subscribe/, (msg) => {
  const chatId = msg.chat.id;
  addUser(chatId, (err) => {
    if (err) {
      logger.error("Error al suscribirse: " + err.message);
      return bot.sendMessage(chatId, "❌ Hubo un error al suscribirte.");
    }

    bot.sendMessage(
      chatId,
      "✅ ¡Te has suscrito para recibir notificaciones de juegos gratis!"
    );

    setTimeout(async () => {
      const games = await checkGames(false, false);
      notifyGames(games, chatId, false);
    }, 500);
  });
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;

  deleteUser(chatId, (err) => {
    if (err) {
      logger.error("Error al eliminar el chat: " + err.message);
      return bot.sendMessage(
        chatId,
        "❌ Hubo un error al suscribirte. Contactate con el desarrollador @tehpon"
      );
    }

    bot.sendMessage(chatId, "Ya no recibirás notificaciones de juegos gratis.");
  });
});

bot.onText(/\/current/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    bot.sendMessage(
      chatId,
      "🔄 Verificando nuevos juegos gratis, por favor espera..."
    );

    const games = await checkGames(false, true);
    notifyGames(games, chatId, true);
  } catch (error) {
    logger.error("Error en la verificación manual: " + error.message);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error durante la verificación manual."
    );
  }
});

bot.onText(/\/next/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    bot.sendMessage(
      chatId,
      "🔄 Verificando nuevos juegos gratis, por favor espera..."
    );

    const games = await checkGames(true, true);
    notifyGames(games, chatId, true, true);
  } catch (error) {
    logger.error("Error en la verificación manual: " + error.message);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error durante la verificación manual."
    );
  }
});

bot.onText(/\/epic/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    bot.sendMessage(
      chatId,
      "🔄 Verificando nuevos juegos gratis, por favor espera..."
    );

    const games = await checkEpicGames();
    notifyGames(games, chatId, true);
  } catch (error) {
    logger.error("Error en la verificación manual: " + error.message);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error durante la verificación manual."
    );
  }
});

bot.onText(/\/steam/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    bot.sendMessage(
      chatId,
      "🔄 Verificando nuevos juegos gratis, por favor espera..."
    );

    const games = await checkSteamGames();
    notifyGames(games, chatId, true);
  } catch (error) {
    logger.error("Error en la verificación manual: " + error.message);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error durante la verificación manual."
    );
  }
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const chatId = msg.chat.id;

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

    bot.sendMessage(chatId, part1, { parse_mode: "Markdown" });
    setTimeout(() => {
      bot.sendMessage(chatId, part2, { parse_mode: "Markdown" });
    }, 500);
    setTimeout(() => {
      bot.sendMessage(chatId, part3, { parse_mode: "Markdown" });
    }, 1000);
  } catch (error) {
    logger.error("Error en la verificación manual: " + error.message);
    bot.sendMessage(chatId, "❌ Ocurrió un error.");
  }
});

bot.onText(/\/info/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const infoMessage =
      `ℹ️ *Acerca del bot*\n\n` +
      `Este bot te avisa cuando hay *juegos gratis* en Epic Games Store y Steam 🎉\n` +
      `Funciona de manera automática cada hora y también podés consultarlo con los comandos.\n\n` +
      `🔗 Proyecto desarrollado por @tehpon (2025).\n` +
      `💡 Código abierto y en constante mejora 🚀\n\n`+
      `🙏 Si el bot te resulta útil, podés apoyarlo con /donate`;

    bot.sendMessage(chatId, infoMessage, { parse_mode: "Markdown" });
  } catch (error) {
    bot.sendMessage(chatId, "❌ Ocurrió un error.");
  }
});

bot.onText(/\/donate/, (msg) => {
  const chatId = msg.chat.id;

  const donateMessage = 
    `☕️ *¿Querés apoyar este bot?*\n\n` +
    `Si el bot te resulta útil, podés invitarme un café o colaborar por PayPal 🙌`;

  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "☕️ Cafecito", url: "https://cafecito.app/tehpon" },
          { text: "💳 PayPal", url: "https://paypal.me/tehpon" }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, donateMessage, options);
});

bot.on("polling_error", (error) => {
  logger.error(
    `Error de polling: ${error.code || ""} - ${
      error.message || error.toString()
    }`
  );
});
