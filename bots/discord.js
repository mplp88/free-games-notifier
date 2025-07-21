// TODO: WIP - No implementado todavía, falta configurar permisos de bot en discord
const { Client, GatewayIntentBits } = require('discord.js');
const { fetchGames } = require('../services/epicGames');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  logger.info(`🤖 Bot de Discord conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '/current') {
    const games = await fetchGames();
    if (!games.length) {
      message.channel.send('😭 No se encontraron juegos gratis actualmente.');
    } else {
      for (const game of games) {
        message.channel.send(`🎮 **${game.title}**\n${game.url}`);
      }
    }
  }
});

function startDiscordBot() {
  client.login(process.env.DISCORD_TOKEN);
}

module.exports = { startDiscordBot };
