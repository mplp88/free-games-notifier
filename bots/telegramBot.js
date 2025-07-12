require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
module.exports = { bot }