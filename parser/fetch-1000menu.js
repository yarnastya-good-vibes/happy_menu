// parser/fetch-1000menu.js
// Второй источник рецептов — 1000.menu. Парсит страницу рецепта через schema.org
// Recipe (JSON-LD), с регексп-fallback'ами на случай иной разметки. Возвращает
// рецепт в том же нормализованном виде, что и fetch-recipe.js (eda).
//
// CLI для калибровки (запусти на одном рецепте и проверь вывод):
//   node parser/fetch-1000menu.js https://1000.menu/cooking/74296-farsh-s-syrom-vkusno-i-prosto
//   node parser/fetch-1000menu.js catalog bluda-za-30-minut 1   → список ссылок со страницы каталога

'use strict';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BASE = 'https://1000.menu';

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

// --- Утилиты разбора ---

const num = (v) => {
  if (v == null) return undefined;
  const m = String(v).replace(',', '.').match(/[\d.]+/);
  return m ? Number(m[0]) : undefined;
};

// ISO-8601 длительность ("PT1H30M") → минуты.
const isoDurationToMin = (s) => {
  if (!s || typeof s !== 'string') return 0;
  const m = s.match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return 0;
  return Number(m[1] || 0) * 60 + Number(m[2] || 0);
};

// "Фарш мясной 400 гр" / "400 г фарша" / "Соль по вкусу" → {name, amount, unit}
const parseIngredientString = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return null;
  // Число + единица где-нибудь в строке. \b не работает с кириллицей в JS,
  // поэтому требуем границу через lookahead.
  const m2 = s.match(
    /(\d+[.,]?\d*)\s*(кг|грамм|гр|мл|л|шт|штук[а-яё]*|зубчик[а-яё]*|стакан[а-яё]*|стак|щепот[а-яё]*|пучок|г)(?=$|[\s.,;:)\/])/i
  );
  let amount;
  let unit = '';
  let name = s;
  if (m2) {
    amount = Number(m2[1].replace(',', '.'));
    unit = m2[2].toLowerCase().replace(/\s+/g, '');
    if (unit === 'грамм' || unit === 'гр') unit = 'г';
    name = s.replace(m2[0], ' ').replace(/[-–—:]/g, ' ').replace(/\s+/g, ' ').trim();
  } else if (/по вкусу/i.test(s)) {
    name = s.replace(/по вкусу/i, '').replace(/[-–—:]/g, ' ').trim();
  }
  name = name.replace(/^[\s-–—]+|[\s-–—]+$/g, '');
  if (!name) return null;
  // Капитализация первой буквы
  name = name.charAt(0).toUpperCase() + name.slice(1);
  const out = { name };
  if (typeof amount === 'number' && !Number.isNaN(amount)) out.amount = amount;
  if (unit) out.unit = unit;
  return out;
};

// Достаёт все JSON-LD блоки и находит объект Recipe (в т.ч. внутри @graph).
const extractRecipeJsonLd = (html) => {
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];
  for (const b of blocks) {
    let data;
    try {
      data = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const queue = Array.isArray(data) ? [...data] : [data];
    while (queue.length) {
      const it = queue.shift();
      if (!it || typeof it !== 'object') continue;
      if (Array.isArray(it['@graph'])) queue.push(...it['@graph']);
      const t = it['@type'];
      const isRecipe =
        t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
      if (isRecipe) return it;
    }
  }
  return null;
};

// Fallback БЖУ из видимого текста: "Белки ... 14 г ... Жиры ... 31 г ... 367 ккал"
const parseMacrosFromText = (html) => {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const grab = (label) => {
    // Между меткой и граммами может быть процент ("Белки 31% 14 г") —
    // пропускаем всё, кроме кириллицы (чтобы не залезть в следующую метку).
    const re = new RegExp(
      label + '[а-яё]*[^а-яё]{0,18}?(\\d+[.,]?\\d*)\\s*г(?![а-яё])',
      'i'
    );
    const m = text.match(re);
    return m ? Number(m[1].replace(',', '.')) : undefined;
  };
  const kcalM = text.match(/(\d+[.,]?\d*)\s*ккал/i);
  const macros = {
    protein: grab('Белки'),
    fat: grab('Жиры'),
    carbs: grab('Углевод'),
    kcal: kcalM ? Number(kcalM[1].replace(',', '.')) : undefined
  };
  return macros;
};

const normalizeMacros = (ld, html) => {
  let macros = {};
  if (ld && ld.nutrition && typeof ld.nutrition === 'object') {
    macros = {
      protein: num(ld.nutrition.proteinContent),
      fat: num(ld.nutrition.fatContent),
      carbs: num(ld.nutrition.carbohydrateContent),
      kcal: num(ld.nutrition.calories)
    };
  }
  // Если JSON-LD не дал БЖУ — пробуем из текста.
  if (macros.protein == null && macros.kcal == null) {
    macros = parseMacrosFromText(html);
  }
  // Чистим undefined
  Object.keys(macros).forEach((k) => macros[k] == null && delete macros[k]);
  return macros;
};

const extractSteps = (ld) => {
  if (!ld || !ld.recipeInstructions) return [];
  const ins = Array.isArray(ld.recipeInstructions)
    ? ld.recipeInstructions
    : [ld.recipeInstructions];
  const out = [];
  for (const s of ins) {
    if (typeof s === 'string') {
      const t = s.replace(/\s+/g, ' ').trim();
      if (t) out.push({ text: t });
    } else if (s && typeof s === 'object') {
      // HowToStep или HowToSection
      if (Array.isArray(s.itemListElement)) {
        for (const el of s.itemListElement) {
          const t = (el.text || el.name || '').replace(/\s+/g, ' ').trim();
          if (t) out.push({ text: t });
        }
      } else {
        const t = (s.text || s.name || '').replace(/\s+/g, ' ').trim();
        if (t) out.push({ text: t });
      }
    }
  }
  return out;
};

const firstImage = (img) => {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  return img.url || '';
};

// --- Публичное: один рецепт ---
const fetchRecipe1000 = async (url, { logger = console } = {}) => {
  const html = await httpGet(url);
  const ld = extractRecipeJsonLd(html);

  let time = 0;
  if (ld) {
    time =
      isoDurationToMin(ld.totalTime) ||
      isoDurationToMin(ld.cookTime) ||
      isoDurationToMin(ld.prepTime);
  }
  if (!time) {
    const m = html.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (m) time = isoDurationToMin(m[0]);
  }

  const ingredients =
    ld && Array.isArray(ld.recipeIngredient)
      ? ld.recipeIngredient.map(parseIngredientString).filter(Boolean)
      : [];
  const steps = extractSteps(ld);
  const macros = normalizeMacros(ld, html);
  const title = (
    ld?.name ||
    (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] ||
    ''
  )
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sourceId = (url.match(/\/cooking\/(\d+)/) || [])[1] || '';

  const recipe = {
    title,
    image: firstImage(ld?.image),
    time,
    difficulty: 'Средне', // 1000.menu не даёт сложность — ставим нейтральную
    ingredients,
    steps,
    macros,
    mealType: 'main',
    category: 'main',
    sourceUrl: url,
    sourceId,
    source: '1000menu'
  };
  return recipe;
};

// --- Публичное: ссылки рецептов из каталога ---
// Возвращает кандидатов в формате, совместимом с planSelection/fetchAndFilter.
const fetchCatalogLinks1000 = async (
  slug,
  { pageCount = 1, logger = console } = {}
) => {
  const seen = new Set();
  const out = [];
  for (let page = 1; page <= pageCount; page++) {
    const url =
      page === 1
        ? `${BASE}/catalog/${slug}`
        : `${BASE}/catalog/${slug}?page=${page}`;
    logger.log(`[1000menu] catalog ${url}`);
    let html;
    try {
      html = await httpGet(url);
    } catch (e) {
      logger.warn(`[1000menu] catalog page ${page} failed: ${e.message}`);
      continue;
    }
    const links = [
      ...html.matchAll(/\/cooking\/(\d+)-([a-z0-9-]+)/gi)
    ];
    for (const m of links) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name: '', // имя возьмём при детальном фетче (надёжнее, чем парсить листинг)
        relativeUrl: `/cooking/${m[1]}-${m[2]}`,
        cookingTime: 0,
        preparationTime: 0,
        source: '1000menu',
        // 1000.menu не даёт eda-сигналов качества — нейтральные значения,
        // отбор идёт по питательности (selectFinal), а не по этим полям.
        isEditorChoice: false,
        isGold1000: false,
        isSpecialProject: false,
        hasVideo: false,
        likes: 0,
        dislikes: 0,
        inCookbookCount: 0,
        ratingValue: 0,
        ingredientsCount: 0
      });
    }
  }
  logger.log(`[1000menu] catalog ${slug}: ${out.length} ссылок`);
  return out;
};

module.exports = {
  fetchRecipe1000,
  fetchCatalogLinks1000,
  parseIngredientString,
  isoDurationToMin,
  extractRecipeJsonLd,
  normalizeMacros
};

// --- CLI для калибровки ---
if (require.main === module) {
  const arg = process.argv[2];
  if (arg === 'catalog') {
    const slug = process.argv[3] || 'bluda-za-30-minut';
    const pages = Number(process.argv[4] || 1);
    fetchCatalogLinks1000(slug, { pageCount: pages })
      .then((list) =>
        console.log(JSON.stringify(list.map((r) => r.relativeUrl), null, 2))
      )
      .catch((e) => {
        console.error('Error:', e.message);
        process.exit(1);
      });
  } else if (arg) {
    fetchRecipe1000(arg)
      .then((r) => console.log(JSON.stringify(r, null, 2)))
      .catch((e) => {
        console.error('Error:', e.message);
        process.exit(1);
      });
  } else {
    console.log(
      'Использование:\n  node parser/fetch-1000menu.js <url рецепта>\n  node parser/fetch-1000menu.js catalog <slug> <pages>'
    );
  }
}
