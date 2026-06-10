// parser/fetch-food.js
// Адаптер food.ru — класс NUTRITIONAL. Данные рецепта лежат в <script id="__NEXT_DATA__">
// (Next.js + Effector), доступны в СЫРОМ HTML → CI берёт без рендера браузера.
//   КБЖУ на food.ru даются НА 100 Г (proteins/fats/carbs/calories). Переводим на порцию
//   через суммарный вес ингредиентов и measure_count. (Для фильтров доля белка безразмерна —
//   работает в любом базисе; перевод нужен для корректного отображения «на порцию».)
//   Шаги — в lexical-формате (preparation + cooking, текст в description.children[].content).
//
// ЛИСТИНГ: каталог food.ru рендерится клиентски (API), поэтому авто-кроул не делаем.
//   Источник работает по SEED-СПИСКУ ссылок (parser/seeds-food.json) — детальный парсер
//   тянет каждую и отдаёт с полным КБЖУ. Авто-кроул по их API — TODO.
//
// Экспорт: fetchRecipe(url), parseRecipeNextData(html,url), extractRecipeNode(state)

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

const extractNextData = (html) => {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) throw new Error('__NEXT_DATA__ не найден (food.ru)');
  return JSON.parse(m[1]);
};

// Рекурсивно ищем узел рецепта: есть calories И main_ingredients_block.
const extractRecipeNode = (state) => {
  const seen = new Set();
  let found = null;
  const walk = (o) => {
    if (found || !o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    if (!Array.isArray(o) && 'calories' in o && ('main_ingredients_block' in o || 'proteins' in o) && 'title' in o) { found = o; return; }
    for (const k in o) { try { walk(o[k]); } catch {} }
  };
  walk(state);
  return found;
};

// lexical-документ → плоский текст
const lexicalText = (desc) => {
  const parts = [];
  const walk = (n) => {
    if (!n) return;
    if (typeof n.content === 'string') parts.push(n.content);
    else if (typeof n.text === 'string') parts.push(n.text);
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  walk(desc);
  return parts.join('').trim();
};

const productsOf = (node) => {
  const blocks = [];
  if (node.main_ingredients_block) blocks.push(node.main_ingredients_block);
  if (Array.isArray(node.optional_ingredients_blocks)) blocks.push(...node.optional_ingredients_blocks);
  const out = [];
  for (const b of blocks) for (const p of (b && b.products) || []) out.push(p);
  return out;
};

const parseRecipeNextData = (html, url) => {
  const j = extractNextData(html);
  const state = j && j.props && j.props.pageProps && j.props.pageProps.__EFFECTOR_NEXTJS_INITIAL_STATE__;
  const node = extractRecipeNode(state || j);
  if (!node) throw new Error('Узел рецепта не найден в __NEXT_DATA__ (food.ru)');

  const products = productsOf(node);
  const ingredients = products.map((p) => ({
    name: String(p.title || '').trim(),
    amount: Number(p.custom_measure_count) || 0,
    unit: String(p.custom_measure || '').trim(),
    weight: Number(p.weight) || 0
  })).filter((x) => x.name);

  const steps = []
    .concat(Array.isArray(node.preparation) ? node.preparation : [])
    .concat(Array.isArray(node.cooking) ? node.cooking : [])
    .map((s) => ({ text: lexicalText(s.description) || String(s.title || '').trim(), timeMin: null }))
    .filter((s) => s.text);

  const portions = Number(node.measure_count) || 1;
  const totalWeight = ingredients.reduce((a, x) => a + (x.weight || 0), 0);
  const per100 = { protein: Number(node.proteins) || 0, fat: Number(node.fats) || 0, carbs: Number(node.carbs) || 0, kcal: Number(node.calories) || 0 };
  // На порцию = на100г · (totalWeight/100) / порции. Если веса нет — оставляем на 100 г (доля белка та же).
  const factor = totalWeight > 0 ? (totalWeight / 100) / portions : 1;
  const round1 = (x) => Math.round(x * 10) / 10;
  const macros = {
    protein: round1(per100.protein * factor),
    fat: round1(per100.fat * factor),
    carbs: round1(per100.carbs * factor),
    kcal: Math.round(per100.kcal * factor)
  };

  const time = Number(node.total_cooking_time) || Number(node.active_cooking_time) || 0;
  const cuisine = (Array.isArray(node.cuisines) && node.cuisines[0] && node.cuisines[0].name) || '';
  const sourceId = Number(node.id) || Number(String(url).match(/\/recipes\/(\d+)-/)?.[1]) || 0;

  return {
    id: sourceId,
    sourceId: String(sourceId || ''),
    title: String(node.title || '').trim(),
    image: '',
    time,
    difficulty: time > 60 ? 'Сложно' : time > 30 ? 'Средне' : 'Легко',
    mealType: 'main',
    category: { slug: '', name: '' },
    cuisine: { slug: '', name: cuisine },
    portions,
    ingredients,
    steps,
    macros,
    macrosPer100g: per100, // храним исходный базис на всякий
    rating: { value: 0, count: 0 },
    tags: (node.tags || []).map((t) => t && (t.title || t.name)).filter(Boolean),
    recipeGroups: [],
    source: 'food.ru',
    sourceClass: 'nutritional',
    sourceUrl: String(url || '').replace(/\/$/, ''),
    fetchedAt: new Date().toISOString()
  };
};

const fetchRecipe = async (url) => parseRecipeNextData(await httpGet(url), url);

module.exports = { fetchRecipe, parseRecipeNextData, extractRecipeNode, extractNextData, lexicalText };

if (require.main === module) {
  const url = process.argv[2];
  if (!url) { console.error('Usage: node parser/fetch-food.js <recipe-url>'); process.exit(1); }
  fetchRecipe(url).then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error('Error:', e.message); process.exit(1); });
}
