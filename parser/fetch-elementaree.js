// parser/fetch-elementaree.js
// Адаптер elementaree.ru — класс CURATED (сервис наборов; КБЖУ на странице НЕТ).
// Страница серверная → CI берёт сырой HTML. JSON-LD/itemprop нет, поэтому парсим ПОСТРОЧНО
//   по стабильным меткам интерфейса: «Что в наборе?» (состав), «Сколько готовить?» (время),
//   «Сколько получится?» (вес), «Как готовить» (шаги). Класс curated → фильтры по белку/КБЖУ
//   не применяются (см. recipe-filters.js).
//
// ЛИСТИНГ: работаем по SEED-списку (parser/seeds-elementaree.json). Авто-кроул каталога — TODO.

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

const decode = (s) => String(s || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ');
// Превращаем HTML в массив текстовых строк (блочные теги → перевод строки).
const toLines = (html) => decode(String(html)
  .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, ' ')
  .replace(/<\s*(br|\/p|\/div|\/li|\/h\d|\/section)\s*[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' '))
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

// Разбивка по запятым ВЕРХНЕГО уровня (запятые внутри скобок игнорируем).
const splitTopComma = (s) => {
  const out = []; let depth = 0, cur = '';
  for (const ch of String(s)) {
    if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
};

const NON_FOOD = /^(пергамент|зубочистк|шпажк|пакет|форма|перчатк|qr)/i;

const parseRecipeHtml = (html, url, { mealType = 'main' } = {}) => {
  const lines = toLines(html);
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  let title = (h1 ? h1.replace(/<[^>]+>/g, ' ') : '').replace(/\s+/g, ' ').trim();
  if (!title) { // фолбэк из <title>: "Рецепт блюда X по шагам..."
    const t = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    title = decode(t).replace(/^Рецепт блюда\s*/i, '').replace(/\s+по шагам.*$/i, '').trim();
  }

  const after = (label, re) => {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (new RegExp(label, 'i').test(lines[i])) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) { const m = lines[j].match(re); if (m) return m; }
      }
    }
    // запасной поиск по всему тексту
    for (const l of lines) { const m = l.match(re); if (m) return m; }
    return null;
  };

  const timeM = after('Сколько готовить', /(\d+)\s*мин/i) || [null, 0];
  const time = Number(timeM[1]) || 0;
  const weightM = after('Сколько получится', /(\d+)\s*г(?![а-яёa-z])/i) || [null, 0];
  const weight = Number(weightM[1]) || 0;

  // Состав из «Что в наборе?» — берём ПОСЛЕДНюю строку-метку, следом строка с запятыми.
  let compLine = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/Что в наборе/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if ((lines[j].match(/,/g) || []).length >= 2) { compLine = lines[j]; break; }
      }
      if (compLine) break;
    }
  }
  const ingredients = splitTopComma(compLine)
    .map((x) => ({ name: x.replace(/\s*\([^)]*\)/g, '').trim(), amount: 0, unit: '' }))
    .filter((x) => x.name && !NON_FOOD.test(x.name));

  // Шаги: между «Как готовить» и «Сколько получится»/«Если нет духовки»/«Корректируйте».
  const startIdx = lines.findIndex((l) => /^Как готовить/i.test(l));
  const steps = [];
  if (startIdx >= 0) {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^(Сколько получится|Сколько готовить|Что в наборе|Похожие|Если нет духовки|Корректируйте)/i.test(l)) break;
      if (l === '---' || l === '—' || /^СОВЕТ!?/i.test(l) || l.length < 12) continue;
      steps.push({ text: l, timeMin: null });
    }
  }

  const idM = html.match(/\/basket\/\?dishes=(\d+)/) || String(url).match(/recept-([a-z0-9-]+)/i);
  const sourceId = idM ? idM[1] : (String(url).match(/recept-([a-z0-9-]+)/i) || [])[1] || title;

  return {
    id: sourceId,
    sourceId: String(sourceId || ''),
    title,
    image: '',
    time,
    difficulty: time > 60 ? 'Сложно' : time > 30 ? 'Средне' : 'Легко',
    mealType,
    category: { slug: '', name: '' },
    cuisine: { slug: '', name: '' },
    portions: 1, // наборы elementaree — обычно на 1-2 порции; вес блюда в weightG
    weightG: weight,
    ingredients,
    steps: steps.length ? steps : [{ text: 'См. пошаговый рецепт на elementaree.ru', timeMin: null }],
    macros: {}, // curated
    rating: { value: 0, count: 0 },
    tags: [],
    recipeGroups: [],
    source: 'elementaree.ru',
    sourceClass: 'curated',
    sourceUrl: String(url || '').replace(/\/$/, ''),
    fetchedAt: new Date().toISOString()
  };
};

const fetchRecipe = async (url, opts = {}) => parseRecipeHtml(await httpGet(url), url, opts);

module.exports = { fetchRecipe, parseRecipeHtml, toLines, splitTopComma };

if (require.main === module) {
  const url = process.argv[2];
  if (!url) { console.error('Usage: node parser/fetch-elementaree.js <recipe-url>'); process.exit(1); }
  fetchRecipe(url).then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error('Error:', e.message); process.exit(1); });
}
