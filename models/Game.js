const { GameOffer } = require('./GameOffer');

class Game {
  constructor(id, title, url, offer, source, imageUrl) {
    this.id = id;
    this.title = title;
    this.url = url;
    const { startDate, endDate } = offer;
    this.offer = new GameOffer(startDate, endDate);
    this.source = source;
    this.imageUrl = imageUrl;
  }

  id = 0;
  title = '';
  url = '';
  source = 'unknown';
  imageUrl = '';
}

exports.Game = Game;
