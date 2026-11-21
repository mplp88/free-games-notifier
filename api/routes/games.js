const express = require('express');
const router = express.Router();

const { getAllGames } = require('../../db/db');

router.get('/current', async (req, res) => {
  try {
    const games = await getAllGames();

    const result = games.map((game) => ({
      id: game.id,
      title: game.title,
      url: game.url,
      startDate: game.offer.startDate,
      endDate: game.offer.endDate,
      source: game.source,
      imageUrl: game.imageUrl,
    }));

    res.json(result);
  } catch (error) {
    logger.error(`Error consultando juegos: ${error.stack}`);

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No se pudo obtener la lista de juegos.',
      },
    });
  }
});

module.exports = router;
