// parser/fetch-edimdoma.js
// Адаптер edimdoma.ru — класс NUTRITIONAL (КБЖУ на порцию).
// Деталь: JSON-LD schema.org/Recipe (полные КБЖУ, время, порции, шаги HowToStep).
//   Особенность: recipeIngredient — это [[{name, value, unitCode}, ...]] (вложенный массив
//   PropertyValue), а не список строк, как у eda.
// Листинг: страницы тегов /retsepty/tags/<slug> (?page=N), серверный HTML; ссылки рецептов
//   вида /retsepty/<id>-<slug>. КБЖУ на edimdoma — НА ПОРЦИЮ (как eda), конвертация не нужна.
//
// Экспорт: fetchRecipe(url), parseRecipeHtml(html,url), fetchListing(tag,{pageCount}), extractListingLinks(html)

'use strict';

const { parseISODuration, deriveDiet, deriveMeatCategory, extractLdBlocks } = require('./fetch-recipe');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE = 'https://www.edimdoma.ru';

let proxyDispatcher = null;
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) { try { const { ProxyAgent } = require('undici'); proxyDispatcher = new ProxyAgent(proxyUrl); } catch {} }

const httpGet = async (url) => {
  const opts = { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' };
  if (proxyDispatcher) opts.dispatcher = proxyDispatcher;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const typesOf = (x) => (!x ? [] : Array.isArray(x['@type']) ? x['@type'] : [x['@type']]);
const findRecipe = (blocks) => blocks.find((b) => typesOf(b).some((t) => /Recipe/i.test(t || '')));

const toInt = (s) => { const m = String(s == null ? '' : s).match(/-?\d+(?:[.,]\d+)?/); return m ? Math.round(Number(m[0].replace(',', '.'))) : 0; };

// recipeIngredient: [[{name,value,unitCode}...]] | [{...}] | ["строка"]
const parseIngredients = (ri) => {
  if (!ri) return [];
  let arr = ri;
  if (Array.isArray(ri) && Array.isArray(ri[0])) arr = ri[0]; // вложенный массив edimdoma
  return arr.map((it) => {
    if (typeof it === 'string') return { name: it.trim(), amount: 0, unit: '' };
    const name = String(it.name || '').trim();
    const unit = String(it.unitCode || '').trim();
    const byTaste = /по вкусу/i.test(unit) || /по вкусу/i.test(String(it.value || ''));
    const amount = byTaste ? 0 : Number(String(it.value || '').replace(',', '.')) || 0;
    return { name, amount, unit: byTaste ? 'по вкусу' : unit };
  }).filter((x) => x.name);
};

const parseSteps = (ri) => {
  const instr = Array.isArray(ri) ? ri : ri ? [ri] : [];
  return instr.map((s) => ({ text: typeof s === 'string' ? s.trim() : String(s && s.text || '').trim(), timeMin: null }))
    .filter((s) => s.text);
};

const firstImageUrl = (image) => {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) { const f = image[0]; return typeof f === 'string' ? f : (f && f.url) || ''; }
  return image.url || '';
};

const idFromUrl = (url) => { const m = String(url || '').match(/\/retsepty\/(\d+)-/); return m ? m[1] : ''; };

const deriveDifficulty = (time, ing, steps) => {
  let s = (time > 60 ? 2 : time > 30 ? 1 : 0) + (ing > 12 ? 2 : ing > 8 ? 1 : 0) + (steps > 8 ? 1 : 0);
  return s <= 1 ? 'Легко' : s >= 4 ? 'Сложно' : 'Средне';
};

const parseRecipeHtml = (html, url, { mealType = 'main' } = {}) => {
  const r = findRecipe(extractLdBlocks(html));
  if (!r) throw new Error('Recipe JSON-LD не найден (edimdoma)');
  const ingredients = parseIngredients(r.recipeIngredient);
  const steps = parseSteps(r.recipeInstructions);
  const n = r.nutrition || {};
  const macros = { protein: toInt(n.proteinContent), fat: toInt(n.fatContent), carbs: toInt(n.carbohydrateContent), kcal: toInt(n.calories) };
  const time = parseISODuration(r.totalTime) || parseISODuration(r.cookTime) || parseISODuration(r.prepTime) || 0;
  const sourceId = idFromUrl(url) || idFromUrl(r.mainEntityOfPage || '');
  return {
    id: Number(sourceId) || 0,
    sourceId: String(sourceId || ''),
    title: (r.name || '').trim(),
    image: firstImageUrl(r.image),
    time,
    difficulty: deriveDifficulty(time, ingredients.length, steps.length),
    diet: deriveDiet(ingredients),
    meatCategory: deriveMeatCategory(ingredients),
    mealType,
    category: { slug: '', name: (r.recipeCategory || '').trim() },
    cuisine: { slug: '', name: (r.recipeCuisine || '').trim() },
    portions: toInt(r.recipeYield) || 1,
    ingredients,
    steps,
    macros,
    rating: { value: Number(r.aggregateRating && r.aggregateRating.ratingValue) || 0, count: Number(r.aggregateRating && r.aggregateRating.ratingCount) || 0 },
    tags: [],
    recipeGroups: [],
    source: 'edimdoma.ru',
    sourceClass: 'nutritional',
    sourceUrl: String(url || '').replace(/\/$/, ''),
    fetchedAt: new Date().toISOString()
  };
};

const fetchRecipe = async (url, opts = {}) => parseRecipeHtml(await httpGet(url), url, opts);

// --- Листинг ---
const REC_RE = /\/retsepty\/(\d+)-[a-z0-9-]+/gi;
const extractListingLinks = (html) => {
  const byId = new Map();
  let m;
  while ((m = REC_RE.exec(html))) {
    const id = m[1];
    if (!byId.has(id)) byId.set(id, { id, relativeUrl: m[0], name: '' });
  }
  return [...byId.values()];
};

const fetchListing = async (tagSlug, { pageCount = 3, logger = console } = {}) => {
  const seen = new Set();
  const all = [];
  let emptyStreak = 0;
  for (let page = 1; page <= pageCount; page++) {
    const url = page === 1 ? `${BASE}/retsepty/tags/${tagSlug}` : `${BASE}/retsepty/tags/${tagSlug}?page=${page}`;
    logger.log(`[edimdoma] fetch ${url}`);
    try {
      const items = extractListingLinks(await httpGet(url));
      let added = 0;
      for (const it of items) { if (seen.has(it.id)) continue; seen.add(it.id); all.push(it); added++; }
      logger.log(`[edimdoma] page ${page}: +${added} (всего ${all.length})`);
      emptyStreak = added === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 2) break;
    } catch (e) { logger.warn(`[edimdoma] page ${page} failed: ${e.message}`); }
    await sleep(150);
  }
  return all;
};

module.exports = { fetchRecipe, parseRecipeHtml, fetchListing, extractListingLinks, parseIngredients };

if (require.main === module) {
  const url = process.argv[2];
  if (!url) { console.error('Usage: node parser/fetch-edimdoma.js <recipe-url>'); process.exit(1); }
  fetchRecipe(url).then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error('Error:', e.message); process.exit(1); });
}
