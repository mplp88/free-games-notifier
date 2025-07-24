require('dotenv').config();
require('./db/db');
require('./bots/telegram');
//require('./bots/discord').startDiscordBot(); // Not implemented yet
require('./scheduler/scheduler')
const logger = require('./utils/logger')

logger.info('Bot iniciado')
