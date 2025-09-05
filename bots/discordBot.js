const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function startDiscordBot() {
  client.login(process.env.DISCORD_TOKEN);
}

module.exports = { client, startDiscordBot };
