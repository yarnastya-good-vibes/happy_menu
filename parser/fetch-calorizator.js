// parser/fetch-calorizator.js
// Парсер ядра: calorizator.ru. Server-render, чистый HTML.
//   • листинги категорий: /recipes/category/garnish (вторые), /recipes/category/soups (супы)
//   • КБЖУ берём НА ПОРЦИЮ (строка «1 порция» в таблице), это главное преимущество источника
//   • время — диапазонный тег /recipes/time/X (0-30 / 30-60 / ...), точных минут сайт не даёт
//
// Экспорт:
//   fetchCategoryRecipes(slug, {pageCount}) — массив { id, relativeUrl }
//   fetchRecipe(url, {mealType})            — рецепт в формате приложения
//   parseRecipeHtml(html, url, {mealType})  — чистый парсер (для тестов)
//   extractRecipeLinks(html)                — ссылки из листинга (для тестов)

'use strict';

const { deriveDiet, deriveMeatCategory } = require('./fetch-recipe');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE = 'https://calorizator.ru';

let proxyDispatcher = null;
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
  try {
    const { ProxyAgent } = require('undici');
    proxyDispatcher = new ProxyAgent(proxyUrl);
  } catch {
    /* proxy unavailable */
  }
}

const httpGet = async (url) => {
  const opts = {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow'
  };
  if (proxyDispatcher) opts.dispatcher = proxyDispatcher;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Листинг: собрать ссылки на рецепты ---
const extractRecipeLinks = (html) => {
  const ids = new Set();
  let m;
  const re = /href="(?:https?:\/\/calorizator\.ru)?\/recipes\/(\d+)"/g;
  while ((m = re.exec(html))) ids.add(m[1]);
  return [...ids].map((id) => ({ id, relativeUrl: `/recipes/${id}` }));
};

// --- Хелперы ---
const num = (s) => {
  const v = parseFloat(String(s == null ? '' : s).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(v) ? v : 0;
};

// "Кабачок - 200 гр." → { name:"Кабачок", amount:200, unit:"гр" }
// "Нори (2,5 листа) - 2,5 шт." → { name:"Нори (2,5 листа)", amount:2.5, unit:"шт" }
const parseIngredient = (raw) => {
  const t = String(raw || '').trim().replace(/\.+$/, '');
  if (!t) return null;
  const idx = t.lastIndexOf(' - ');
  let name = t;
  let tail = '';
  if (idx > 0) {
    name = t.slice(0, idx).trim();
    tail = t.slice(idx + 3).trim();
  }
  let amount = 0;
  let unit = tail;
  const am = tail.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (am) {
    amount = num(am[1]);
    unit = am[2].trim().replace(/\.+$/, '');
  }
  return { name, amount, unit };
};

// Время: диапазонный тег сайта → представительные минуты + бакет нашего продукта.
const TIME_MAP = {
  '0-30': { time: 25, bucket: 'quick' },
  '30-60': { time: 45, bucket: 'medium' },
  '60-90': { time: 75, bucket: 'long' },
  '90-180': { time: 120, bucket: 'long' },
  '180': { time: 200, bucket: 'long' }
};

const extractTag = (html, re) => {
  const m = html.match(re);
  return m ? m[1] : '';
};

const decodeEntities = (s) =>
  String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/<[^>]+>/g, '')
    .trim();

// --- Парсер страницы рецепта ---
const parseRecipeHtml = (html, url, { mealType = 'main' } = {}) => {
  const title = decodeEntities(extractTag(html, /<h1[^>]*id="page-title"[^>]*>([\s\S]*?)<\/h1>/));
  if (!title) throw new Error('title не найден');

  const portions = num(extractTag(html, /itemprop="recipeYield">([^<]+)</)) || 1;

  // Ингредиенты — по itemprop (класс у старых рецептов отличается)
  const ingredients = [];
  const ingRe = /itemprop="recipeIngredient"[^>]*>([\s\S]*?)<\/li>/g;
  let im;
  while ((im = ingRe.exec(html))) {
    const ing = parseIngredient(decodeEntities(im[1]));
    if (ing && ing.name) ingredients.push(ing);
  }

  // Шаги — внутри recipeInstructions
  const steps = [];
  const instrBlock = html.match(/itemprop="recipeInstructions"[\s\S]*?<ol>([\s\S]*?)<\/ol>/);
  if (instrBlock) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let sm;
    while ((sm = liRe.exec(instrBlock[1]))) {
      const text = decodeEntities(sm[1]);
      if (text) steps.push({ text, timeMin: null });
    }
  }

  // КБЖУ на порцию — строка «1 порция» в tfoot: [вес, белки, жиры, углеводы, ккал]
  let macros = null;
  const perPortion = html.match(
    /1 порция<\/td>\s*<td[^>]*>[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/
  );
  if (perPortion) {
    macros = {
      protein: num(perPortion[2]),
      fat: num(perPortion[3]),
      carbs: num(perPortion[4]),
      kcal: num(perPortion[5])
    };
  } else {
    // запасной путь: «Итого» / число порций
    const total = html.match(
      /Итого<\/td>\s*<td[^>]*>[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/
    );
    if (total && portions > 0) {
      macros = {
        protein: +(num(total[2]) / portions).toFixed(1),
        fat: +(num(total[3]) / portions).toFixed(1),
        carbs: +(num(total[4]) / portions).toFixed(1),
        kcal: +(num(total[5]) / portions).toFixed(1)
      };
    }
  }
  if (!macros) macros = { protein: 0, fat: 0, carbs: 0, kcal: 0 };

  // Время — диапазонный тег
  const timeRange = extractTag(html, /\/recipes\/time\/([0-9-]+)/);
  const t = TIME_MAP[timeRange] || { time: 0, bucket: null };

  const image = extractTag(html, /<meta property="og:image" content="([^"]+)"/);
  const idm = String(url).match(/\/recipes\/(\d+)/);
  const sourceId = idm ? idm[1] : '';

  // Сложность — простая эвристика (calorizator её не указывает)
  const difficulty =
    ingredients.length > 12 || t.bucket === 'long'
      ? 'Сложно'
      : t.bucket === 'quick' && ingredients.length <= 8
      ? 'Легко'
      : 'Средне';

  return {
    id: Number(sourceId) || 0,
    sourceId,
    title,
    image,
    time: t.time,
    timeBucket: t.bucket, // 'quick' | 'medium' | 'long' | null
    difficulty,
    diet: deriveDiet(ingredients),
    meatCategory: deriveMeatCategory(ingredients),
    mealType, // задаётся источником-листингом (garnish→main, soups→soup)
    category: {
      slug: mealType === 'soup' ? 'soups' : 'garnish',
      name: mealType === 'soup' ? 'Первые блюда' : 'Вторые блюда'
    },
    cuisine: { slug: '', name: '' }, // calorizator кухню не указывает
    portions,
    ingredients,
    steps,
    macros,
    tags: [],
    recipeGroups: [],
    source: 'calorizator.ru',
    sourceUrl: String(url).replace(/\/$/, ''),
    fetchedAt: new Date().toISOString()
  };
};

const fetchRecipe = async (url, opts = {}) => parseRecipeHtml(await httpGet(url), url, opts);

const fetchCategoryRecipes = async (slug, { pageCount = 3, logger = console } = {}) => {
  const seen = new Set();
  const all = [];
  let emptyStreak = 0;
  for (let page = 0; page < pageCount; page++) {
    const url =
      page === 0
        ? `${BASE}/recipes/category/${slug}`
        : `${BASE}/recipes/category/${slug}?page=${page}`;
    logger.log(`[calorizator] fetch ${url}`);
    try {
      const html = await httpGet(url);
      const items = extractRecipeLinks(html);
      let added = 0;
      for (const r of items) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        all.push(r);
        added++;
      }
      logger.log(`[calorizator] page ${page}: +${added} (всего ${all.length})`);
      emptyStreak = added === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 2) break;
    } catch (err) {
      logger.warn(`[calorizator] page ${page} failed: ${err.message}`);
    }
    await sleep(150);
  }
  logger.log(`[calorizator] ${slug}: собрано ${all.length}`);
  return all;
};

module.exports = {
  fetchCategoryRecipes,
  fetchRecipe,
  parseRecipeHtml,
  extractRecipeLinks,
  parseIngredient,
  TIME_MAP
};

// CLI
if (require.main === module) {
  const arg = process.argv[2];
  if (arg && /^\d+$/.test(arg)) {
    fetchRecipe(`${BASE}/recipes/${arg}`, { mealType: 'main' })
      .then((r) => console.log(JSON.stringify(r, null, 2)))
      .catch((e) => { console.error(e.message); process.exit(1); });
  } else {
    fetchCategoryRecipes(arg || 'garnish', { pageCount: 2 })
      .then((l) => console.log(JSON.stringify(l, null, 2)))
      .catch((e) => { console.error(e.message); process.exit(1); });
  }
}
