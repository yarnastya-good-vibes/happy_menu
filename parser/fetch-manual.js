// parser/fetch-manual.js
// Источник MANUAL — ручной список рецептов (t-j.ru и любые другие, которые не парсятся
// автоматически). t-j отдаёт пустые страницы (js-рендер) и не содержит КБЖУ/структур.данных
// (проверено 10.06), поэтому авто-импорт невозможен — рецепты заносятся РУКАМИ в
// parser/manual-recipes.json и попадают в меню только когда заполнены (ready: true).
//
// Класс — curated (КБЖУ для фильтров не нужны). Категорию можно задать явно через
// categoryOverride (напр. "cheat" для шаурмы/буррито).
//
// Формат записи в manual-recipes.json:
//   {
//     "ready": true,                      // false → стоит в очереди, в меню НЕ идёт
//     "sourceUrl": "https://t-j.ru/...",
//     "title": "Шаурма с курицей",
//     "mealType": "main",                 // main | soup
//     "categoryOverride": "cheat",        // необязательно: main|soup|veg|cheat
//     "time": 30,
//     "ingredients": ["Лаваш", "Куриное филе", "Помидор", "Огурец", "Соус", "Капуста"],
//     "steps": ["Обжарить курицу.", "Завернуть начинку в лаваш.", "Подрумянить."]
//   }

'use strict';

const fs = require('fs');
const path = require('path');

const loadManual = (logger = console) => {
  try {
    const p = path.resolve(__dirname, 'manual-recipes.json');
    if (!fs.existsSync(p)) return [];
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return (data.recipes || []).filter((r) => r && r.ready === true && r.title);
  } catch (e) { logger.warn(`[manual] ${e.message}`); return []; }
};

const slugFromUrl = (url) => (String(url || '').match(/\/([a-z0-9-]+)\/?$/i) || [])[1] || '';

const normalize = (raw) => {
  const id = raw.id || slugFromUrl(raw.sourceUrl) || raw.title;
  const ingredients = (raw.ingredients || []).map((x) => (typeof x === 'string' ? { name: x.trim(), amount: 0, unit: '' } : x)).filter((x) => x && x.name);
  const steps = (raw.steps || []).map((x) => (typeof x === 'string' ? { text: x.trim(), timeMin: null } : x)).filter((x) => x && x.text);
  return {
    id,
    sourceId: String(id),
    title: String(raw.title || '').trim(),
    image: raw.image || '',
    time: Number(raw.time) || 0,
    difficulty: (Number(raw.time) || 0) > 60 ? 'Сложно' : (Number(raw.time) || 0) > 30 ? 'Средне' : 'Легко',
    mealType: raw.mealType || 'main',
    categoryOverride: raw.categoryOverride || undefined, // напр. 'cheat'
    category: { slug: '', name: '' },
    cuisine: { slug: '', name: raw.cuisine || '' },
    portions: Number(raw.portions) || 1,
    ingredients,
    steps,
    macros: raw.macros || {}, // обычно нет (curated)
    rating: { value: 0, count: 0 },
    tags: raw.tags || [],
    recipeGroups: [],
    source: raw.source || 't-j.ru',
    sourceClass: 'curated',
    sourceUrl: String(raw.sourceUrl || '').replace(/\/$/, ''),
    fetchedAt: new Date().toISOString()
  };
};

module.exports = { loadManual, normalize, slugFromUrl };
