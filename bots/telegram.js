const { addUser, deleteUser } = require("../db/db");
const {
  checkGames,
  checkEpicGames,
  checkSteamGames,
} = require("../services/gamesServices");
const { notifyGames } = require("../services/notification");
const { bot } = require("./telegramBot");
const logger = require('../utils/logger')

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  addUser(chatId, (err) => {
    if (err) {
      logger.error("Error al suscribirse:", err);
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
      logger.error("Error al eliminar el chat:", err);
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
    logger.error("Error en la verificación manual:", error);
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
    notifyGames(games, chatId, true);
  } catch (error) {
    logger.error("Error en la verificación manual:", error);
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
    logger.error("Error en la verificación manual:", error);
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
    logger.error("Error en la verificación manual:", error);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error durante la verificación manual."
    );
  }
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    bot.sendMessage(
      chatId,
      "Acá va a estar la ayuda del bot. No implementado todavía."
    );
  } catch (error) {
    logger.error("Error en la verificación manual:", error);
    bot.sendMessage(chatId, "❌ Ocurrió un error.");
  }
});

bot.onText(/\/info/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    bot.sendMessage(
      chatId,
      "Acá va a estar la información del bot. No implementado todavía."
    );
  } catch (error) {
    bot.sendMessage(chatId, "❌ Ocurrió un error.");
  }
});

bot.on('polling_error', (error) => {
  logger.error(`Error de polling: ${error.code || ''} - ${error.message || error.toString()}`);
});