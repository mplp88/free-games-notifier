const express = require('express');
const gamesRouter = require('./routes/games');
const logger = require('../utils/logger');
const cors = require('cors');

function startApi() {
  const app = express();

  app.disable('x-powered-by');

  app.use(cors());

  app.use('/api/games', gamesRouter);

  const port = process.env.API_PORT || 3187;

  const server = app.listen(port, () => {
    logger.info(`API iniciada en el puerto ${port}`);
  });

  server.on('error', (error) => {
    logger.error(`Error iniciando la API: ${error.message}`);
  });

  return server;
}

module.exports = { startApi };
