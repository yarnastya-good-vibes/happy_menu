// parser/fetch-category.js
// Собирает список URL рецептов из категории eda.rambler.ru с пагинацией.
// Фильтрует явный шум (маринады, соусы, заправки — они встречаются в «Основных блюдах»).
//
// Использование (CLI): node parser/fetch-category.js osnovnye-blyuda 3
//   → соберёт рецепты с 3-х первых страниц категории osnovnye-blyuda.

'use strict';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BASE = 'https://eda.rambler.ru';

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

// Имена-«не блюда», встречающиеся в osnovnye-blyuda.
const NOT_A_DISH = /^(маринад|соус|заправк|паста\s+из|масло\s|пюре\s+из\s+(чеснок|лук)|сироп|глазур|панировк|бульон|специи)/i;

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

const extractNextData = (html) => {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!m) throw new Error('NEXT_DATA not found');
  return JSON.parse(m[1]);
};

// Извлекает базовую инфу о рецептах из Apollo-state (до фактического fetch каждой страницы).
// Каждый элемент Apollo-state с ключом "RecipeModel:ID" и непустым relativeUrl — кандидат.
// Также тянем сигналы качества: editor choice, gold1000, likes, inCookbookCount, рейтинг,
// videoFileId, specialProject — они все уже есть в листинге, детальный фетч не нужен для фильтра.
const extractRecipesFromListing = (nextData) => {
  const apollo = nextData?.props?.pageProps?.__APOLLO_STATE__ || {};
  const recipes = [];
  for (const key of Object.keys(apollo)) {
    if (!key.startsWith('RecipeModel:')) continue;
    const r = apollo[key];
    if (!r?.relativeUrl || !r?.name) continue;
    recipes.push({
      id: String(r.id),
      name: r.name,
      relativeUrl: r.relativeUrl,
      cookingTime: r.cookingTime || 0,
      preparationTime: r.preparationTime || 0,
      // Сигналы качества
      isEditorChoice: Boolean(r.isEditorChoice),
      isGold1000: Boolean(r.isGold1000),
      isSpecialProject: Boolean(r.isSpecialProject),
      hasVideo: Boolean(r.videoFileId),
      likes: Number(r.likes) || 0,
      dislikes: Number(r.dislikes) || 0,
      inCookbookCount: Number(r.inCookbookCount) || 0,
      ratingValue: Number(r.aggregateRating?.ratingValue) || 0,
      ingredientsCount: Array.isArray(r.composition) ? r.composition.length : 0
    });
  }
  // Apollo возвращает в непредсказуемом порядке — сортируем по id desc
  // как proxy на «свежие / новые» (не критично, но стабильно).
  recipes.sort((a, b) => Number(b.id) - Number(a.id));
  return recipes;
};

// Эвристика: это реальное блюдо, а не заготовка/маринад?
const isRealDish = (r) => {
  if (NOT_A_DISH.test(r.name)) return false;
  const total = (r.cookingTime || 0) + (r.preparationTime || 0);
  if (total > 0 && total < 10) return false; // слишком коротко для ужина
  if (total > 180) return false; // 3+ часа — отсекаем экзотику
  return true;
};

// Собирает pageCount страниц категории и возвращает массив кандидатов.
const fetchCategoryRecipes = async (
  categorySlug,
  { pageCount = 3, logger = console } = {}
) => {
  const seen = new Set();
  const all = [];
  for (let page = 1; page <= pageCount; page++) {
    const url =
      page === 1
        ? `${BASE}/recepty/${categorySlug}`
        : `${BASE}/recepty/${categorySlug}?page=${page}`;
    logger.log(`[category] fetch ${url}`);
    try {
      const html = await httpGet(url);
      const nextData = extractNextData(html);
      const items = extractRecipesFromListing(nextData);
      for (const r of items) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        all.push(r);
      }
    } catch (err) {
      logger.warn(`[category] page ${page} failed: ${err.message}`);
    }
  }
  const filtered = all.filter(isRealDish);
  logger.log(
    `[category] ${categorySlug}: collected ${all.length}, after filter ${filtered.length}`
  );
  return filtered;
};

module.exports = {
  fetchCategoryRecipes,
  isRealDish
};

if (require.main === module) {
  const slug = process.argv[2] || 'osnovnye-blyuda';
  const pages = Number(process.argv[3] || 3);
  fetchCategoryRecipes(slug, { pageCount: pages })
    .then((list) => {
      console.log(
        JSON.stringify(
          list.map((r) => ({
            id: r.id,
            name: r.name,
            url: `${BASE}${r.relativeUrl}`,
            time: r.cookingTime + r.preparationTime
          })),
          null,
          2
        )
      );
    })
    .catch((err) => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
