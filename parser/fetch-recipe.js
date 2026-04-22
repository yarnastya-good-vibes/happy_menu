// parser/fetch-recipe.js
// Парсер одной страницы рецепта eda.rambler.ru.
// Источник данных — <script id="__NEXT_DATA__"> на HTML-странице.
// Весь recipe-объект лежит в data.props.pageProps.recipe. HTML-селекторы не используются.
//
// Использование:
//   node parser/fetch-recipe.js https://eda.rambler.ru/recepty/osnovnye-blyuda/azu-po-tatarski-21751
//   const { fetchRecipe } = require('./parser/fetch-recipe');
//   const r = await fetchRecipe(url);

'use strict';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BASE = 'https://eda.rambler.ru';

// Опциональная поддержка HTTP-прокси (для запуска в песочнице).
// На машине пользователя переменные окружения обычно не выставлены — тогда fetch
// работает напрямую, без лишнего диспатчера.
let proxyDispatcher = null;
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
  try {
    const { ProxyAgent } = require('undici');
    proxyDispatcher = new ProxyAgent(proxyUrl);
  } catch {
    // undici недоступен (Node <18?) — работаем без прокси
  }
}

// ---------------- Таксономия ----------------

// Лёгкое правило «мясо / не-красное мясо / пескетарианец / вегетарианец».
// Смотрим по именам ингредиентов (в lowercase). Приоритет сверху вниз.
// Важно: \b в JS не работает с кириллицей — поэтому матчим по стемам,
// опираясь на однозначность слов-ингредиентов. Тесты — в bottom of file.
const MEAT_MATCHERS = {
  'red-meat': [
    // говядина/говяжий + телятина/телячий
    /говяд/i, /говяж/i, /телят/i, /теляч/i,
    // свинина/свиной и её формы
    /свинин/i, /свино[йяе]/i, /свиные/i,
    // баранина/бараний/барашек; ягнятина/ягнёнок
    /баран/i, /ягн[яёе]/i,
    // экзотика
    /конин/i, /оленин/i, /лосятин/i, /лосин/i, /кролик/i, /крольчат/i,
    // переработка
    /фарш/i, /бекон/i, /шпик/i, /грудинк/i, /корейк/i,
    /колбас/i, /салями/i, /сервелат/i, /ветчин/i, /пастром/i, /солонин/i,
    /буженин/i, /пепперони/i, /прошутт/i, /хамон/i,
    // сало — только как начало слова/отдельное слово
    /(^|\s)сало(\s|$)/i
  ],
  'no-red-meat': [
    /курин/i, /куриц/i, /курочк/i, /курятин/i, /цыпл[её]н/i,
    /индейк/i, /индюш/i, /утк/i, /утин/i, /утя/i, /гус[еёь]/i,
    /перепел/i, /фазан/i,
    // субпродукты из птицы — сюда же
    /куриная\s+печ/i, /куриные\s+сердеч/i, /куриные\s+желудк/i
  ],
  pescatarian: [
    /лосос/i, /форель/i, /горбуш/i, /с[её]мг/i, /кет[ау]/i, /нерк/i,
    /тунец/i, /тунц/i, /треск/i, /хек/i, /палтус/i, /судак/i, /окун/i,
    /щук/i, /сельд/i, /кильк/i, /скумбри/i, /сардин/i, /сайр/i, /анчоус/i,
    /креветк/i, /кальмар/i, /мидии/i, /осьминог/i, /краб/i, /гребешк/i,
    /лангустин/i, /морепродукт/i, /икр[аы]/i,
    /\sрыб/i, /^рыб/i, /филе\s*рыб/i, /дорад/i, /сибас/i, /тилапи/i
  ]
};

const classifyDiet = (composition) => {
  const names = (composition || [])
    .map((c) => c?.ingredient?.name || '')
    .filter(Boolean);

  const hasAny = (regexes) =>
    names.some((n) => regexes.some((re) => re.test(n)));

  if (hasAny(MEAT_MATCHERS['red-meat']))
    return { diet: 'meat', meatCategory: 'red-meat' };
  if (hasAny(MEAT_MATCHERS['no-red-meat']))
    return { diet: 'meat', meatCategory: 'no-red-meat' };
  if (hasAny(MEAT_MATCHERS.pescatarian))
    return { diet: 'pescatarian', meatCategory: 'no-red-meat' };
  return { diet: 'vegetarian', meatCategory: 'vegetarian' };
};

// Сложность по суммарному времени: ≤25 → Легко, 26–50 → Средне, >50 → Посложнее.
const classifyDifficulty = (totalMinutes) => {
  if (!Number.isFinite(totalMinutes)) return 'Средне';
  if (totalMinutes <= 25) return 'Легко';
  if (totalMinutes <= 50) return 'Средне';
  return 'Посложнее';
};

// Тип блюда по slug категории с сайта.
const classifyMealType = (categorySlug) => {
  if (categorySlug === 'supy') return 'soup';
  if (categorySlug === 'osnovnye-blyuda') return 'main';
  if (categorySlug === 'salaty') return 'salad';
  return 'main';
};

// ---------------- HTTP + извлечение __NEXT_DATA__ ----------------

const extractNextData = (html) => {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!m) throw new Error('NEXT_DATA script not found in HTML');
  return JSON.parse(m[1]);
};

const httpGet = async (url) => {
  const opts = {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow'
  };
  if (proxyDispatcher) opts.dispatcher = proxyDispatcher;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
};

// ---------------- Нормализация полей ----------------

const toAbsoluteUrl = (href) => {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  return `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;
};

const normalizeIngredients = (composition) =>
  (composition || []).map((c) => ({
    name: c?.ingredient?.name ?? '',
    amount: typeof c?.amount === 'number' ? c.amount : null,
    unit: c?.measureUnit?.name ?? ''
  }));

const normalizeSteps = (recipeSteps) =>
  (recipeSteps || []).map((s) => ({
    text: (s?.description || '').trim(),
    // На eda.rambler.ru cookingTime на шаге почти всегда null.
    // Сохраняем как есть — фронтенд должен уметь работать с null.
    timeMin: typeof s?.cookingTime === 'number' ? s.cookingTime : null
  }));

const normalizeMacros = (nutritionInfo) => {
  if (!nutritionInfo) return null;
  // nutritionInfo на сайте считается на порцию (проверено на нескольких рецептах,
  // цифры сопоставимы с обычными порционными значениями).
  return {
    protein: Math.round(nutritionInfo.proteins ?? 0),
    fat: Math.round(nutritionInfo.fats ?? 0),
    carbs: Math.round(nutritionInfo.carbohydrates ?? 0),
    kcal: Math.round(nutritionInfo.kilocalories ?? 0)
  };
};

// ---------------- Основная функция ----------------

const fetchRecipe = async (url, { logger = console } = {}) => {
  const absoluteUrl = url.startsWith('http') ? url : `${BASE}${url}`;
  const html = await httpGet(absoluteUrl);
  const nextData = extractNextData(html);

  const recipe = nextData?.props?.pageProps?.recipe;
  if (!recipe) {
    throw new Error(`pageProps.recipe missing for ${absoluteUrl}`);
  }

  // Раннее логирование отсутствующих критичных полей.
  const missing = [];
  if (!recipe.name) missing.push('name');
  if (!recipe.composition?.length) missing.push('composition');
  if (!recipe.recipeSteps?.length) missing.push('recipeSteps');
  if (!recipe.recipeCover?.imageUrl && !recipe.openGraphImageUrl)
    missing.push('image');
  if (missing.length) {
    logger.warn(
      `[fetch-recipe] WARN ${absoluteUrl} missing fields: ${missing.join(', ')}`
    );
  }

  const totalTime =
    (recipe.cookingTime || 0) + (recipe.preparationTime || 0) || null;

  const categorySlug = recipe.recipeCategory?.slug || null;
  const { diet, meatCategory } = classifyDiet(recipe.composition);

  const sourceUrl = recipe.relativeUrl
    ? toAbsoluteUrl(recipe.relativeUrl)
    : absoluteUrl;

  return {
    id: `eda-${recipe.id}`, // id с префиксом, чтобы не коллидировал со старой нумерацией
    sourceId: String(recipe.id),
    title: recipe.name,
    image:
      recipe.recipeCover?.imageUrl ||
      recipe.openGraphImageUrl ||
      null,
    time: totalTime,
    difficulty: classifyDifficulty(totalTime),
    diet,
    meatCategory,
    mealType: classifyMealType(categorySlug),
    category: {
      slug: categorySlug,
      name: recipe.recipeCategory?.name || null
    },
    cuisine: {
      slug: recipe.cuisine?.slug || null,
      name: recipe.cuisine?.name || null
    },
    portions: recipe.portionsCount || null,
    ingredients: normalizeIngredients(recipe.composition),
    steps: normalizeSteps(recipe.recipeSteps),
    macros: normalizeMacros(recipe.nutritionInfo),
    tags: (recipe.navigationTags || []).map((t) => ({
      slug: t.slug,
      name: t.name
    })),
    recipeGroups: (recipe.recipeGroups || []).map((g) => ({
      slug: g.slug,
      name: g.name
    })),
    sourceUrl,
    fetchedAt: new Date().toISOString()
  };
};

module.exports = {
  fetchRecipe,
  classifyDiet,
  classifyDifficulty,
  classifyMealType
};

// CLI: node parser/fetch-recipe.js <url>
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node parser/fetch-recipe.js <recipe-url>');
    process.exit(1);
  }
  fetchRecipe(url)
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
    })
    .catch((err) => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
