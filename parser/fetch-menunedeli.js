// parser/fetch-menunedeli.js
// Адаптер menunedeli.ru — класс CURATED (КБЖУ нет, только калорийность на 100 г).
// Сайт на WordPress, рецепт размечен микроданными schema.org (itemprop) в СЫРОМ HTML
//   → CI берёт без рендера. Парсим по itemprop: name, recipeIngredient (meta content),
//   recipeYield, totalTime, calories (на 100 г, справочно), recipeInstructions.
// Так как класс curated — фильтры по белку/КБЖУ НЕ применяются (см. recipe-filters.js),
//   нужны только название, ингредиенты, шаги, время, тип блюда.
//
// ЛИСТИНГ: работаем по SEED-списку (parser/seeds-menunedeli.json). Авто-кроул категорий — TODO.

'use strict';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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

const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

// Внутренний HTML первого элемента, чьё открывающее <тег ...> матчит attrRe. Балансный скан тегов.
const innerByAttr = (html, attrRe) => {
  const open = html.search(attrRe);
  if (open < 0) return '';
  // начало тега
  let tagStart = html.lastIndexOf('<', open);
  const tagMatch = html.slice(tagStart).match(/^<([a-z0-9]+)/i);
  if (!tagMatch) return '';
  const tag = tagMatch[1];
  const gtIdx = html.indexOf('>', open);
  if (gtIdx < 0) return '';
  // самозакрытый
  if (html[gtIdx - 1] === '/') return '';
  const reTag = new RegExp(`<\\/?${tag}\\b`, 'gi');
  reTag.lastIndex = gtIdx + 1;
  let depth = 1, m;
  while ((m = reTag.exec(html))) {
    if (m[0][1] === '/') { depth--; if (depth === 0) return html.slice(gtIdx + 1, m.index); }
    else depth++;
  }
  return html.slice(gtIdx + 1);
};

const attrContent = (html, prop) => {
  const m = html.match(new RegExp(`itemprop=["']${prop}["'][^>]*\\scontent=["']([^"']*)["']`, 'i'));
  return m ? m[1].trim() : '';
};

const parseTimeMin = (s) => {
  if (!s) return 0;
  const iso = String(s).match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso && (iso[1] || iso[2])) return Number(iso[1] || 0) * 60 + Number(iso[2] || 0);
  let total = 0; const h = String(s).match(/(\d+)\s*час/i); const mn = String(s).match(/(\d+)\s*мин/i);
  if (h) total += Number(h[1]) * 60; if (mn) total += Number(mn[1]);
  if (!total) { const d = String(s).match(/\d+/); if (d) total = Number(d[0]); }
  return total;
};

// "Филе куриное – 600 г или индейки" → {name, amount, unit}
const parseIngredient = (line) => {
  const raw = String(line || '').replace(/&ndash;/g, '–').replace(/&amp;/g, '&').trim();
  if (!raw) return null;
  const parts = raw.split(/\s[–—-]\s/); // тире-разделитель
  const name = parts[0].trim();
  const tail = (parts[1] || '').trim();
  let amount = 0, unit = tail;
  const am = tail.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (am) { amount = Number(am[1].replace(',', '.')) || 0; unit = (am[2].split(/\s/)[0] || '').trim(); }
  return { name, amount, unit };
};

const parseRecipeHtml = (html, url, { mealType = 'main' } = {}) => {
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const title = stripTags(h1) || attrContent(html, 'name') || '';

  const ingredients = [...html.matchAll(/itemprop=["']recipeIngredient["'][^>]*content=["']([^"']+)["']/gi)]
    .map((m) => parseIngredient(m[1])).filter((x) => x && x.name);

  const instrHtml = innerByAttr(html, /itemprop=["']recipeInstructions["']/i)
    || innerByAttr(html, /class=["'][^"']*instructions-lst[^"']*["']/i);
  let steps = [];
  if (instrHtml) {
    // делим по элементам-шагам, если есть; иначе один общий шаг
    const blocks = instrHtml.split(/<(?:li|div)[^>]*class=["'][^"']*\binstruction\b[^"']*["'][^>]*>/i).map(stripTags).filter((t) => t.length > 15);
    steps = (blocks.length ? blocks : [stripTags(instrHtml)]).filter((t) => t).map((t) => ({ text: t, timeMin: null }));
  }

  const caloriesPer100g = Number((attrContent(html, 'calories') || (html.match(/itemprop=["']calories["'][^>]*>\s*(\d+)/i) || [])[1]) || 0) || 0;
  const portions = Number(attrContent(html, 'recipeYield') || (html.match(/itemprop=["']recipeYield["'][^>]*>\s*(\d+)/i) || [])[1]) || 1;
  const time = parseTimeMin(attrContent(html, 'totalTime') || attrContent(html, 'cookTime')
    || (innerByAttr(html, /itemprop=["']totalTime["']/i)) || '');
  const category = attrContent(html, 'recipeCategory') || stripTags(innerByAttr(html, /itemprop=["']recipeCategory["']/i));
  const sourceId = (String(url).match(/\/recipe\/([a-z0-9-]+)/i) || [])[1] || title;

  return {
    id: sourceId,
    sourceId: String(sourceId || ''),
    title,
    image: '',
    time,
    difficulty: time > 60 ? 'Сложно' : time > 30 ? 'Средне' : 'Легко',
    mealType,
    category: { slug: '', name: category || '' },
    cuisine: { slug: '', name: '' },
    portions,
    ingredients,
    steps,
    macros: {}, // curated: КБЖУ для фильтров нет
    caloriesPer100g, // справочно (на 100 г)
    rating: { value: 0, count: 0 },
    tags: [],
    recipeGroups: [],
    source: 'menunedeli.ru',
    sourceClass: 'curated',
    sourceUrl: String(url || '').replace(/\/$/, ''),
    fetchedAt: new Date().toISOString()
  };
};

const fetchRecipe = async (url, opts = {}) => parseRecipeHtml(await httpGet(url), url, opts);

module.exports = { fetchRecipe, parseRecipeHtml, parseIngredient, parseTimeMin, innerByAttr, stripTags };

if (require.main === module) {
  const url = process.argv[2];
  if (!url) { console.error('Usage: node parser/fetch-menunedeli.js <recipe-url>'); process.exit(1); }
  fetchRecipe(url).then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error('Error:', e.message); process.exit(1); });
}
