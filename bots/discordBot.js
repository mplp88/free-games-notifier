const { Client, GatewayIntentBits } = require("discord.js");

let isReady = false;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function startDiscordBot() {
  client.login(process.env.DISCORD_TOKEN);
}

function setReady(ready) {
  isReady = ready;
}

function isBotReady() {
  return isReady;
}

module.exports = { client, startDiscordBot, setReady, isBotReady };
