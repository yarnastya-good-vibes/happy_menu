// parser/build-weekly.js
// Еженедельный оркестратор. Тянет 25 основных блюд + 5 супов с eda.rambler.ru,
// фильтрует шум, дедуплицирует по id и имени, и пишет результат в JSON-файл.
//
// Использование:
//   node parser/build-weekly.js                   → собирает в recipes.json (первая генерация)
//   node parser/build-weekly.js --pending         → собирает в recipes-pending.json (еженедельная ротация)
//   node parser/build-weekly.js --out <path>      → произвольный путь
//
// Запускается как локально пользователем, так и по расписанию (scheduled task).

'use strict';

const fs = require('fs');
const path = require('path');
const { fetchRecipe } = require('./fetch-recipe');
const { fetchCategoryRecipes, isRealDish } = require('./fetch-category');

const MAIN_COUNT = 25;
const SOUP_COUNT = 5;
// Сколько страниц каждой категории читать. 1 стр. = 14 рецептов. 4 стр. дают ~56 кандидатов
// для основных, чтобы после фильтра всё ещё оставалось с запасом на 25.
const MAIN_PAGES = 4;
const SOUP_PAGES = 1;

const parseArgs = (argv) => {
  const args = { out: null, pending: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--pending') args.pending = true;
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
};

// Удаляет почти-дубликаты по нормализованному имени ("Крем-суп из брокколи" vs "Крем-суп брокколи").
const normalizeTitle = (s) =>
  s
    .toLowerCase()
    .replace(/[«»"'.,\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const dedupe = (candidates) => {
  const seenId = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const c of candidates) {
    if (seenId.has(c.id)) continue;
    const nt = normalizeTitle(c.name);
    if (seenTitle.has(nt)) continue;
    seenId.add(c.id);
    seenTitle.add(nt);
    out.push(c);
  }
  return out;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchAll = async (candidates, limit, { logger = console } = {}) => {
  const results = [];
  let fetched = 0;
  for (const c of candidates) {
    if (results.length >= limit) break;
    const url = c.relativeUrl
      ? `https://eda.rambler.ru${c.relativeUrl}`
      : c.url;
    try {
      const recipe = await fetchRecipe(url, { logger });
      // Повторная проверка после полного фетча: иногда в listing-е
      // cookingTime=0, а на детальной — реально блюдо.
      if (!recipe.ingredients?.length || !recipe.steps?.length) {
        logger.warn(
          `[build] skip ${recipe.title} — empty ingredients/steps`
        );
        continue;
      }
      // Перекладываем id на чистый числовой sourceId — чтобы не ломать совместимость
      // с текущим script.js, где id сравниваются как числа.
      recipe.id = Number(recipe.sourceId);
      results.push(recipe);
      fetched++;
      // мягкий троттлинг, чтобы не бомбить сайт
      await sleep(150);
    } catch (err) {
      logger.warn(`[build] ${url} failed: ${err.message}`);
    }
  }
  logger.log(`[build] fetched ${fetched} recipes (target ${limit})`);
  return results;
};

const buildWeekly = async ({ logger = console } = {}) => {
  const startedAt = new Date();

  logger.log('[build] === collect main dishes ===');
  const mainsRaw = await fetchCategoryRecipes('osnovnye-blyuda', {
    pageCount: MAIN_PAGES,
    logger
  });
  const mainCandidates = dedupe(mainsRaw).filter(isRealDish);
  logger.log(`[build] main candidates after dedup: ${mainCandidates.length}`);

  logger.log('[build] === collect soups ===');
  const soupsRaw = await fetchCategoryRecipes('supy', {
    pageCount: SOUP_PAGES,
    logger
  });
  const soupCandidates = dedupe(soupsRaw).filter(isRealDish);
  logger.log(`[build] soup candidates after dedup: ${soupCandidates.length}`);

  const mains = await fetchAll(mainCandidates, MAIN_COUNT, { logger });
  const soups = await fetchAll(soupCandidates, SOUP_COUNT, { logger });

  // Дополнительная дедупликация после фетча (на случай если mains и soups
  // неожиданно пересеклись по id).
  const allIds = new Set();
  const all = [];
  for (const r of [...mains, ...soups]) {
    if (allIds.has(r.id)) continue;
    allIds.add(r.id);
    all.push(r);
  }

  const weekTag = startedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  return {
    generatedAt: startedAt.toISOString(),
    weekTag,
    source: 'eda.rambler.ru',
    counts: { main: mains.length, soup: soups.length, total: all.length },
    recipes: all
  };
};

const main = async () => {
  const args = parseArgs(process.argv);
  const outPath =
    args.out ||
    (args.pending
      ? path.resolve(__dirname, '..', 'recipes-pending.json')
      : path.resolve(__dirname, '..', 'recipes.json'));

  console.log(`[build] target: ${outPath}`);
  const result = await buildWeekly();

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(
    `[build] wrote ${outPath} — ${result.counts.main} mains + ${result.counts.soup} soups = ${result.counts.total} total`
  );
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[build] FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { buildWeekly };
