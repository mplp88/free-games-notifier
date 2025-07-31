const axios = require("axios");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const {
  saveNotifiedGame,
  cleanupExpiredGames,
  getAllGames,
  getEpicGames,
  getSteamGames,
} = require("../db/db");
const { Game } = require("../models/Game");
const logger = require('../utils/logger')

puppeteer.use(StealthPlugin());

async function checkGames(next, force) {
  if (!next && force) {
    return new Promise((resolve, reject) => {
      getAllGames((err, games) => {
        if (err) return reject(err);
        return resolve(games);
      });
    });
  }

  cleanupExpiredGames();

  const requests = [fetchEpicGames(next), fetchSteamGames(next)];

  const responses = await Promise.all(requests);
  const games = [...responses[0], ...responses[1]];
  if (!force) {
    games.forEach(saveNotifiedGame);
  }

  games.sort((a, b) => {
    const dateA = new Date(a.offer.endDate);
    const dateB = new Date(b.offer.endDate);
    return dateA - dateB;
  });

  games.forEach((game) => {
    logger.info(`Juego encontrado: ${game.title}`);
  });

  return games;
}

async function checkEpicGames() {
  return new Promise((resolve, reject) => {
    getEpicGames((err, games) => {
      if (err) return reject(err);
      return resolve(games);
    });
  });
}

async function checkSteamGames() {
  return new Promise((resolve, reject) => {
    getSteamGames((err, games) => {
      if (err) return reject(err);
      return resolve(games);
    });
  });
}

async function fetchEpicGames(next) {
  try {
    const { data } = await axios.get(
      "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions"
    );

    const games = next ? filterNextGames(data) : filterNewGames(data);

    return games.map((game) => {
      return new Game(
        game.id,
        game.title,
        `https://www.epicgames.com/store/en-US/p/${game.catalogNs.mappings[0].pageSlug}`,
        {
          startDate:
            game.promotions.promotionalOffers[0]?.promotionalOffers[0]
              .startDate ?? null,
          endDate:
            game.promotions.promotionalOffers[0]?.promotionalOffers[0]
              .endDate ?? null,
        },
        "epic"
      );
    });
  } catch (error) {
    console.error("Error fetching Epic games:", error.message);
    return [];
  }
}

async function fetchSteamGames(next) {
  try {
    if (next) return [];
    const url = "https://steamdb.info/upcoming/free/";
    const browser = await puppeteer.launch({
      headless: "new",
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
        const FREE_TO_KEEP = "Free to Keep";

        const title = titleEl?.innerText.trim();
        const type = typeEl?.innerText.trim();
        const startDate = dates[0]?.getAttribute("datetime");
        const endDate = dates[1]?.getAttribute("datetime");

        if (
          (appId && appId !== '730') &&
          title &&
          type.toLowerCase().includes(FREE_TO_KEEP.toLowerCase()) &&
          new Date() < new Date(endDate)
        ) {
          result.push({
            id: appId,
            title,
            url: `https://store.steampowered.com/app/${appId}`,
            offer: { startDate, endDate },
            source: "steam",
          });
        }
      });

      return result;
    });

    await browser.close();
    const games = rawGames.map(
      (game) => new Game(game.id, game.title, game.url, game.offer, game.source)
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

module.exports = { checkGames, checkEpicGames, checkSteamGames };
