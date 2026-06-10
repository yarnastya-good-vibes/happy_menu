// parser/sources.js
// Источники рецептов с ЕДИНЫМ интерфейсом. Оркестратор (build-weekly) пулит их
// вместе через общие фильтры — не зависит от одного шаткого источника.
//
// Каждый источник: { name, sourceClass, collect(mealType, { keep, need, budget, weekTag, logger }) }
//   collect фетчит кандидатов, прогоняет через keep(recipe) и возвращает массив
//   ПРОШЕДШИХ рецептов (нормализованных, в формате приложения), пока не наберёт
//   need или не исчерпает бюджет сетевых запросов budget.
//
// КЛАССЫ ИСТОЧНИКОВ (см. КРИТЕРИИ_v2_по_примерам.md, решено 10.06.2026):
//   nutritional — есть КБЖУ, проходит фильтры по белку/калориям.
//                 Готовы: eda.rambler.ru. TODO-адаптеры: edimdoma.ru, food.ru (КБЖУ на 100 г!).
//   curated     — КБЖУ нет (или только ккал) → НЕ фильтруем по белку, только тип/ингредиенты/время.
//                 TODO-адаптеры: elementaree.ru, menunedeli.ru.
//   manual      — ручной список ссылок (t-j.ru: js-рендер, нет КБЖУ/структур.данных).
//                 Импорт по ссылке, без автокроулинга.
//
// calorizator.ru УБРАН из активных источников 10.06.2026 (низкий hit-rate, неаппетитные фото —
//   подтверждено пользователем). Адаптер fetch-calorizator.js оставлен в репо, но не подключён.

'use strict';

const { fetchRecipe: edaFetchRecipe } = require('./fetch-recipe');
const { fetchCategoryRecipes: edaList } = require('./fetch-category');
const edim = require('./fetch-edimdoma');
const food = require('./fetch-food');
const menunedeli = require('./fetch-menunedeli');
const elementaree = require('./fetch-elementaree');
const manualTj = require('./fetch-manual');
const fs = require('fs');
const path = require('path');

// Загрузка seed-списка ссылок (food.ru/t-j: каталог не кроулится автоматически).
const loadSeeds = (file, logger = console) => {
  try {
    const p = path.resolve(__dirname, file);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf-8')).recipes || [];
  } catch (e) { logger.warn(`[seeds] ${file}: ${e.message}`); return []; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hashStr = (s) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const seededJitter = (seed, id, max = 999999) => hashStr(`${seed}:${id}`) % (max + 1);
const uniqById = (arr) => { const s = new Set(); return arr.filter((r) => (s.has(r.id) ? false : s.add(r.id))); };
const shuffleByWeek = (arr, seed) =>
  arr.map((r) => ({ r, k: seededJitter(seed, r.id) })).sort((a, b) => a.k - b.k).map((x) => x.r);

// eda отдаёт точные минуты → переводим в наш бакет (calorizator уже отдаёт бакет).
const edaBucket = (min) => (!min ? null : min <= 30 ? 'quick' : min <= 60 ? 'medium' : 'long');

// Универсальный сбор: фетчим кандидатов по очереди, оставляем прошедшие keep,
// останавливаемся по набору need или по бюджету запросов budget.
const harvest = async ({ name, cands, fetchOne, mealType, keep, need, budget, logger }) => {
  const out = [];
  let fetched = 0;
  for (const c of cands) {
    if (out.length >= need || fetched >= budget) break;
    fetched++;
    let r;
    try { r = await fetchOne(c); } catch (e) { continue; }
    if (!r) continue;
    r.mealType = mealType;
    r.id = Number(r.sourceId) || r.id;
    if (keep(r)) out.push(r);
    await sleep(110);
  }
  logger.log(`[source ${name}] ${mealType}: запросов ${fetched}, прошло ${out.length}`);
  return out;
};

// ===== eda.rambler.ru — класс nutritional. Объём, надёжно доступен из CI (JSON-LD на порцию) =====
const eda = {
  name: 'eda.rambler.ru',
  sourceClass: 'nutritional',
  async collect(mealType, { keep, need, budget = 150, weekTag, logger = console }) {
    const slug = mealType === 'soup' ? 'supy' : 'osnovnye-blyuda';
    const pages = mealType === 'soup' ? 6 : 14;
    const cands = shuffleByWeek(uniqById(await edaList(slug, { pageCount: pages, logger })), weekTag);
    return harvest({
      name: this.name, cands, mealType, keep, need, budget, logger,
      fetchOne: async (c) => {
        const r = await edaFetchRecipe(`https://eda.rambler.ru${c.relativeUrl}`, { logger });
        r.timeBucket = edaBucket(r.time);
        r.source = 'eda.rambler.ru';
        r.sourceClass = 'nutritional';
        return r;
      }
    });
  }
};

// ===== edimdoma.ru — класс nutritional. JSON-LD Recipe, КБЖУ на порцию (как eda) =====
const edimdoma = {
  name: 'edimdoma.ru',
  sourceClass: 'nutritional',
  async collect(mealType, { keep, need, budget = 120, weekTag, logger = console }) {
    const tag = mealType === 'soup' ? '161-supy-i-bulony' : '165-osnovnye-blyuda';
    const pages = mealType === 'soup' ? 4 : 6;
    const cands = shuffleByWeek(uniqById(await edim.fetchListing(tag, { pageCount: pages, logger })), weekTag);
    return harvest({
      name: this.name, cands, mealType, keep, need, budget, logger,
      fetchOne: async (c) => {
        const r = await edim.fetchRecipe(`https://www.edimdoma.ru${c.relativeUrl}`, { mealType });
        r.timeBucket = edaBucket(r.time);
        return r;
      }
    });
  }
};

// ===== food.ru — класс nutritional. Деталь из __NEXT_DATA__ (КБЖУ на 100 г → на порцию).
// Каталог рендерится клиентски → работаем по SEED-списку (parser/seeds-food.json). =====
const foodru = {
  name: 'food.ru',
  sourceClass: 'nutritional',
  async collect(mealType, { keep, need, budget = 40, weekTag, logger = console }) {
    const seeds = loadSeeds('seeds-food.json', logger).filter((s) => (s.mealType || 'main') === mealType);
    const cands = shuffleByWeek(seeds.map((s, i) => ({ id: `food-${i}-${s.url}`, url: s.url })), weekTag);
    return harvest({
      name: this.name, cands, mealType, keep, need, budget, logger,
      fetchOne: async (c) => { const r = await food.fetchRecipe(c.url); r.mealType = mealType; r.timeBucket = edaBucket(r.time); return r; }
    });
  }
};

// Фабрика seed-источника по ссылкам (для сайтов без авто-кроула каталога).
const makeSeedSource = (name, sourceClass, seedFile, fetchOneFor) => ({
  name, sourceClass,
  async collect(mealType, { keep, need, budget = 40, weekTag, logger = console }) {
    const seeds = loadSeeds(seedFile, logger).filter((s) => (s.mealType || 'main') === mealType);
    const cands = shuffleByWeek(seeds.map((s, i) => ({ id: `${name}-${i}-${s.url}`, url: s.url, mealType })), weekTag);
    return harvest({ name, cands, mealType, keep, need, budget, logger, fetchOne: (c) => fetchOneFor(c, mealType) });
  }
});

// ===== menunedeli.ru — curated (только калорийность/100 г). Seed-список. =====
const menunedeliSrc = makeSeedSource('menunedeli.ru', 'curated', 'seeds-menunedeli.json',
  async (c, mealType) => { const r = await menunedeli.fetchRecipe(c.url, { mealType }); r.timeBucket = edaBucket(r.time); return r; });

// ===== elementaree.ru — curated (КБЖУ нет, теги/ингредиенты). Seed-список. =====
const elementareeSrc = makeSeedSource('elementaree.ru', 'curated', 'seeds-elementaree.json',
  async (c, mealType) => { const r = await elementaree.fetchRecipe(c.url, { mealType }); r.timeBucket = edaBucket(r.time); return r; });

// ===== t-j.ru — manual. Полностью заданные рецепты из parser/manual-recipes.json (без фетча). =====
const tjSrc = {
  name: 't-j.ru', sourceClass: 'curated',
  async collect(mealType, { keep, need, weekTag, logger = console }) {
    const items = manualTj.loadManual(logger).filter((r) => (r.mealType || 'main') === mealType);
    const out = [];
    for (const raw of shuffleByWeek(items, weekTag)) {
      if (out.length >= need) break;
      const r = manualTj.normalize(raw);
      if (keep(r)) out.push(r);
    }
    logger.log(`[source t-j.ru] ${mealType}: из ручного списка прошло ${out.length}`);
    return out;
  }
};

// Активные источники (порядок = приоритет в пуле). calorizator убран.
// Песочница ходит только на eda; остальные проверяются вживую в CI (открытый интернет).
// nutritional (фильтр по КБЖУ): eda, edimdoma, food.ru. curated: menunedeli, elementaree, t-j(manual).
module.exports = {
  SOURCES: [eda, edimdoma, foodru, menunedeliSrc, elementareeSrc, tjSrc],
  eda, edimdoma, foodru, menunedeli: menunedeliSrc, elementaree: elementareeSrc, tj: tjSrc,
  edaBucket, shuffleByWeek, uniqById, makeSeedSource
};
