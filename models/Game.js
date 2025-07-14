const { GameOffer } = require("./GameOffer");

class Game {
  constructor(id, title, url, offer) {
    this.id = id;
    this.title = title;
    this.url = url;
    const { startDate, endDate } = offer;
    this.offer = new GameOffer(startDate, endDate);
  }

  id = 0;
  title = "";
  url = "";
}

exports.Game = Game;
