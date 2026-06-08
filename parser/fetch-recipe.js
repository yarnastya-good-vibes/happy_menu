// parser/fetch-recipe.js
// Парсит страницу рецепта eda.rambler.ru через JSON-LD (schema.org/Recipe).
// Сайт в 2026 перешёл на новую вёрстку: __NEXT_DATA__/Apollo больше нет, но
// есть стабильный JSON-LD с полными данными рецепта — на него и опираемся.
//
// Экспортирует:
//   fetchRecipe(url)          — скачать страницу и вернуть рецепт в формате приложения
//   parseRecipeHtml(html,url) — чистый парсер (для тестов на сохранённом HTML)

'use strict';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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

// --- Извлечение всех JSON-LD блоков ---
const extractLdBlocks = (html) => {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const txt = m[1].trim();
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed && parsed['@graph']) out.push(...parsed['@graph']);
      else if (parsed) out.push(parsed);
    } catch {
      /* пропускаем битый блок */
    }
  }
  return out;
};

const typesOf = (x) =>
  !x ? [] : Array.isArray(x['@type']) ? x['@type'] : [x['@type']];

const findByType = (blocks, type) => blocks.find((b) => typesOf(b).includes(type));

// --- Хелперы разбора ---

// "PT120M" / "PT1H30M" → минуты
const parseISODuration = (iso) => {
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/P(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (!m) return 0;
  return Number(m[1] || 0) * 60 + Number(m[2] || 0);
};

// "894 калорий" / "33" → 894 / 33
const toInt = (s) => {
  const m = String(s == null ? '' : s).match(/-?\d+/);
  return m ? Number(m[0]) : 0;
};

// "Куриная печень, 800 г" → { name:"Куриная печень", amount:800, unit:"г" }
// "Соль, по вкусу"        → { name:"Соль", amount:0, unit:"по вкусу" }
const parseIngredient = (line) => {
  const raw = String(line || '').trim();
  if (!raw) return null;
  // Формат eda: "Название, количество единица". Разделитель — ПЕРВАЯ запятая
  // (в названиях запятых нет, а в количестве бывает десятичная: "1,5").
  const idx = raw.indexOf(',');
  let name = raw;
  let tail = '';
  if (idx > 0) {
    name = raw.slice(0, idx).trim();
    tail = raw.slice(idx + 1).trim();
  }
  let amount = 0;
  let unit = tail;
  const am = tail.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (am) {
    amount = Number(am[1].replace(',', '.'));
    unit = am[2].trim();
  }
  if (!Number.isFinite(amount)) amount = 0;
  return { name, amount, unit };
};

// --- Эвристики полей, которых нет в JSON-LD напрямую ---

const MEAT_RE =
  /(говядин|свинин|баранин|телятин|кролик|конин|оленин|фарш|стейк|бекон|ветчин|колбас|сосиск|сардельк|курин|куриц|куриное|цыпл|индейк|утк|гус|перепел|печен|язык|сердц|почк|рыб|лосос|форел|треск|тунец|сёмг|семг|сельд|скумбри|окун|судак|карп|щук|краб|мидии|креветк|кальмар|морепродукт|анчоус|икр)/i;
const RED_MEAT_RE =
  /(говядин|свинин|баранин|телятин|кролик|конин|оленин|бекон|ветчин|сало|корейк|грудинк)/i;
const DAIRY_EGG_RE =
  /(яйц|молок|сливк|сметан|\bсыр|творог|кефир|сливочное масло|масло сливочное|йогурт|ряженк|простокваш|маскарпоне|моцарелл|пармезан|фета|брынз)/i;

const joinNames = (ingredients) =>
  ingredients.map((i) => (i.name || '').toLowerCase()).join(' | ');

const deriveDiet = (ingredients) => {
  const text = joinNames(ingredients);
  if (MEAT_RE.test(text)) return 'meat';
  if (DAIRY_EGG_RE.test(text)) return 'vegetarian';
  return 'vegan';
};

const deriveMeatCategory = (ingredients) =>
  RED_MEAT_RE.test(joinNames(ingredients)) ? 'red-meat' : 'no-red-meat';

const deriveDifficulty = (time, ingCount, stepCount) => {
  let s = 0;
  s += time > 60 ? 2 : time > 30 ? 1 : 0;
  s += ingCount > 12 ? 2 : ingCount > 8 ? 1 : 0;
  s += stepCount > 8 ? 1 : 0;
  if (s <= 1) return 'Легко';
  if (s >= 4) return 'Сложно';
  return 'Средне';
};

const firstImageUrl = (image) => {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const f = image[0];
    return typeof f === 'string' ? f : f?.url || '';
  }
  return image.url || '';
};

const idFromUrl = (url) => {
  const m = String(url || '').match(/-(\d+)\/?(?:[?#].*)?$/);
  return m ? m[1] : '';
};

// --- Главный парсер ---

const parseRecipeHtml = (html, url) => {
  const blocks = extractLdBlocks(html);
  const r = findByType(blocks, 'Recipe');
  if (!r) throw new Error('Recipe JSON-LD не найден');

  const ingredients = (r.recipeIngredient || [])
    .map(parseIngredient)
    .filter((x) => x && x.name);

  const instr = Array.isArray(r.recipeInstructions)
    ? r.recipeInstructions
    : r.recipeInstructions
    ? [r.recipeInstructions]
    : [];
  const steps = instr
    .map((s) => ({
      text:
        typeof s === 'string'
          ? s.trim()
          : s && s.text
          ? String(s.text).trim()
          : '',
      timeMin: null
    }))
    .filter((s) => s.text);

  const n = r.nutrition || {};
  const macros = {
    protein: toInt(n.proteinContent),
    fat: toInt(n.fatContent),
    carbs: toInt(n.carbohydrateContent),
    kcal: toInt(n.calories)
  };

  const time =
    parseISODuration(r.totalTime) ||
    parseISODuration(r.cookTime) ||
    parseISODuration(r.prepTime) ||
    0;

  const sourceId = idFromUrl(url) || idFromUrl(r.mainEntityOfPage);
  const cleanUrl = String(url || '').replace(/\/$/, '');

  return {
    id: Number(sourceId) || 0,
    sourceId: String(sourceId || ''),
    title: (r.name || '').trim(),
    image: firstImageUrl(r.image),
    time,
    difficulty: deriveDifficulty(time, ingredients.length, steps.length),
    diet: deriveDiet(ingredients),
    meatCategory: deriveMeatCategory(ingredients),
    // mealType проставляет build-weekly по категории-источнику (osnovnye-blyuda/supy)
    mealType: 'main',
    category: { slug: '', name: (r.recipeCategory || '').trim() },
    cuisine: { slug: '', name: (r.recipeCuisine || '').trim() },
    portions: toInt(r.recipeYield) || 1,
    ingredients,
    steps,
    macros,
    // сигнал качества для скоринга (build-weekly удалит перед записью)
    rating: {
      value: Number(r.aggregateRating?.ratingValue) || 0,
      count: Number(r.aggregateRating?.ratingCount) || 0
    },
    tags: [],
    recipeGroups: [],
    sourceUrl: cleanUrl,
    fetchedAt: new Date().toISOString()
  };
};

const fetchRecipe = async (url) => {
  const html = await httpGet(url);
  return parseRecipeHtml(html, url);
};

module.exports = {
  fetchRecipe,
  parseRecipeHtml,
  // экспорт хелперов для тестов
  parseISODuration,
  parseIngredient,
  deriveDiet,
  deriveMeatCategory,
  extractLdBlocks
};

// CLI
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node parser/fetch-recipe.js <recipe-url>');
    process.exit(1);
  }
  fetchRecipe(url)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error('Error:', e.message);
      process.exit(1);
    });
}
