const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { db } = require("../db/db");

puppeteer.use(StealthPlugin());

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

class GameOffer {
  constructor(startDate, endDate) {
    this.startDate = startDate;
    this.endDate = endDate;
  }

  startDate = null;
  endDate = null;
}

async function checkGames(next, force) {
  cleanupExpiredGames();

  const requests = [fetchEpicGames(next), fetchSteamGames(next)];

  const responses = await Promise.all(requests);
  const games = [...responses[0], ...responses[1]];
  if (!force) {
    games.forEach(saveNotifiedGame);
  }

  games.forEach((game) => {
    console.log("Game found: ", game.title);
  });

  return games;
}

function saveNotifiedGame(game) {
  db.run(
    `INSERT OR REPLACE INTO notified_games (game_id, title, url, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)`,
    [game.id, game.title, game.url, game.offer.startDate, game.offer.endDate]
  );
}

async function fetchEpicGames(next) {
  try {
    const { data } = await axios.get(
      "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions"
    );

    let games = [];
    if (!next) {
      games = filterNewGames(data);
    } else {
      games = filterNextGames(data);
    }

    return games.map((game) => {
      return new Game(
        game.id,
        game.title,
        `https://www.epicgames.com/store/en-US/p/${game.catalogNs.mappings[0].pageSlug}`,
        new GameOffer(
          game.promotions.promotionalOffers[0]?.promotionalOffers[0]
            .startDate ?? null,
          game.promotions.promotionalOffers[0]?.promotionalOffers[0].endDate ??
            null
        )
      );
    });
  } catch (error) {
    console.error("Error fetching Epic games:", error.message);
    return [];
  }
}

async function fetchSteamGames(next) {
  try {
    const url = "https://steamdb.info/upcoming/free/";
    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-history-row.app", { timeout: 10000 });

    const rawGames = await page.evaluate(() => {
      const rows = document.querySelectorAll(".app-history-row.app");
      const result = [];

      rows.forEach((row) => {
        const appId = row.getAttribute("data-appid");
        const titleEl = row.querySelector(".panel-sale-name b");
        const typeEl = row.querySelector(".cat");
        const dates = row.querySelectorAll(".panel-sale-time relative-time");

        const title = titleEl?.innerText.trim();
        const type = typeEl?.innerText.trim();
        const startDate = dates[0]?.getAttribute("datetime");
        const endDate = dates[1]?.getAttribute("datetime");

        if (
          appId &&
          title &&
          !title.toLowerCase().includes("steamdb.info") &&
          type.toLowerCase().includes("free")
        ) {
          result.push({
            id: appId,
            title,
            url: `https://store.steampowered.com/app/${appId}`,
            offer: { startDate, endDate },
          });
        }
      });

      return result;
    });

    await browser.close();
    const games = rawGames.map(
      (game) => new Game(game.id, game.title, game.url, game.offer)
    );
    return games;
  } catch (error) {
    console.error("Error fetching Steam games:", error.message);
    return [];
  }
}

function filterNewGames(data) {
  return data.data.Catalog.searchStore.elements.filter(
    (game) =>
      game.promotions &&
      game.promotions.promotionalOffers.length > 0 &&
      game.promotions.promotionalOffers[0].promotionalOffers[0].discountSetting
        .discountPercentage == 0
  );
}

function filterNextGames(data) {
  return data.data.Catalog.searchStore.elements.filter(
    (game) =>
      game.promotions &&
      game.promotions.upcomingPromotionalOffers.length > 0 &&
      game.promotions.upcomingPromotionalOffers[0].promotionalOffers[0]
        .discountSetting.discountPercentage == 0
  );
}

function cleanupExpiredGames() {
  const now = new Date().toISOString();
  db.all(`SELECT game_id, end_date FROM notified_games`, [], (err, rows) => {
    if (err) return console.error(err);
    console.log("Cleaning up games");

    rows.forEach(({ game_id, end_date }) => {
      if (end_date < now) {
        console.log("Cleaning up game: " + game_id);
        db.run(`DELETE FROM notified_games WHERE game_id = ?`, [game_id]);
        db.run(`DELETE FROM user_game_notifications WHERE game_id = ?`, [
          game_id,
        ]);
      }
    });
  });
}

module.exports = { checkGames };
