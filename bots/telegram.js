const { db } = require("../db/db");
const { checkGames } = require("../services/gamesServices");
const { notifyGames } = require("../services/notification");
const { bot } = require('./telegramBot');

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  db.run(
    "INSERT OR IGNORE INTO users (chat_id) VALUES (?)",
    [chatId],
    (err) => {
      if (err) return console.error(err);

      bot.sendMessage(
        chatId,
        "¡Te has suscrito para recibir notificaciones de juegos gratis!"
      );
    }
  );
});

bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;

  db.run("DELETE FROM users WHERE chat_id = ?", [chatId], (err) => {
    if (err) return console.error(err);

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
    console.error("Error during manual verification:", error);
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
    console.error("Error during manual verification:", error);
    bot.sendMessage(
      chatId,
      "❌ Ocurrió un error durante la verificación manual."
    );
  }
});