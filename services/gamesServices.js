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
const UserAgent = require("user-agents");
const logger = require("../utils/logger");

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
  
  await closeAllPages();

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
              .startDate ?? game.promotions.upcomingPromotionalOffers[0].promotionalOffers[0].startDate,
          endDate:
            game.promotions.promotionalOffers[0]?.promotionalOffers[0]
              .endDate ?? game.promotions.upcomingPromotionalOffers[0].promotionalOffers[0].endDate,
        },
        "epic"
      );
    });
  } catch (error) {
    logger.error("Error fetching Epic games: " + error.message);
    return [];
  }
}

let browserInstance = null;
let launchTime = Date.now();
const BROWSER_RESTART_TIME = parseInt(process.env.BROWSER_RESTART_TIME) || 2; // horas

async function getBrowser() {
  if (
    !browserInstance ||
    Date.now() - launchTime > BROWSER_RESTART_TIME * 60 * 60 * 1000
  ) {
    if (browserInstance) {
      logger.info("Reiniciando browser");
      await browserInstance.close();
    }

    browserInstance = await puppeteer.launch({
      headless: 'new',
    });
    launchTime = Date.now();

    process.on("exit", closeBrowser);
    process.on("SIGINT", closeBrowser);
    process.on("SIGTERM", closeBrowser);

    logger.info("Browser lanzado correctamente");
  }

  return browserInstance;
}

async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      browserInstance = null;
      logger.info("Browser cerrado correctamente");
    } catch (err) {
      logger.warn("Error al cerrar browser:", err.message);
    }
  }
}

async function closeAllPages() {
  const browser = await getBrowser();

  try {
    const pages = await browser.pages();
    for (const page of pages) {
      try {
        await page.close();
      } catch (err) {
        console.warn(`⚠️ Error al cerrar page: ${err.message}`);
      }
    }
    logger.info(`Se cerraron ${pages.length} páginas activas.`);
  } catch (err) {
    logger.error("Error al intentar cerrar páginas:", err);
  }
}

async function fetchSteamGames(next) {
  try {
    if (next) return [];
    const url = "https://steamdb.info/upcoming/free/";
    const browser = await getBrowser();
    const page = await browser.newPage();

    const ua = new UserAgent({ deviceCategory: "desktop" });
    await page.setUserAgent(ua.toString());
    logger.info(`User Agent: ${ua.toString()}`);

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
          appId &&
          appId !== "730" &&
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

    await page.close();
    const games = rawGames.map(
      (game) => new Game(game.id, game.title, game.url, game.offer, game.source)
    );
    return games;
  } catch (error) {
    logger.error("Error fetching Steam games: " + error.message);
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
