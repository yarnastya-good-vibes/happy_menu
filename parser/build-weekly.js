// parser/build-weekly.js
// Оркестратор недельной подборки. Пулит несколько источников (sources.js) через
// общие фильтры (recipe-filters.js), отбирает 25 вторых + 5 супов по квотам и
// пишет recipes.json / recipes-pending.json.
//
// Запуск:
//   node parser/build-weekly.js            → recipes.json (первая установка)
//   node parser/build-weekly.js --pending  → recipes-pending.json (еженедельная ротация)
//   node parser/build-weekly.js --out <p>  → произвольный путь

'use strict';

const fs = require('fs');
const path = require('path');
const FILTERS = require('./recipe-filters');
const { SOURCES } = require('./sources');

// --- Нормализация названия (для дедупа и исключения повторов прошлых недель) ---
const STOPWORDS = new Set([
  'из', 'с', 'со', 'в', 'во', 'на', 'по', 'под', 'над', 'при',
  'для', 'и', 'или', 'к', 'ко', 'от', 'у', 'о', 'об',
  'традиционное', 'традиционный', 'традиционная', 'блюдо', 'блюда',
  'рецепт', 'рецепта'
]);

const normalizeTitle = (s) => {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[«»"'.,:;!?]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .sort()
    .join(' ');
};

// --- Исключение блюд из прошлых подборок (чтобы ротация менялась) ---
const loadExclusionFromDisk = (logger = console) => {
  const files = ['recipes.json', 'recipes-pending.json'];
  const ids = new Set();
  const titles = new Set();
  for (const f of files) {
    const p = path.resolve(__dirname, '..', f);
    try {
      if (!fs.existsSync(p)) continue;
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      for (const r of data.recipes || []) {
        if (r.id != null) ids.add(Number(r.id));
        const t = normalizeTitle(r.title || r.name);
        if (t) titles.add(t);
      }
    } catch (e) {
      logger.warn(`[build] не удалось прочитать ${f} для исключения: ${e.message}`);
    }
  }
  return { ids, titles };
};

const parseArgs = (argv) => {
  const out = { out: null, pending: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--pending') out.pending = true;
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
};

// --- Основной флоу ---
const buildWeekly = async ({ logger = console, exclude } = {}) => {
  const startedAt = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const weekTag = `${startedAt.toISOString().slice(0, 10)}_${pad(startedAt.getUTCHours())}${pad(startedAt.getUTCMinutes())}`;

  const excl = exclude || loadExclusionFromDisk(logger);
  logger.log(`[build] исключаем прошлые подборки: ${excl.ids.size} id, ${excl.titles.size} названий`);

  // Единый предикат: жёсткие фильтры + счётчик причин отбраковки.
  const rejects = {};
  const keep = (r) => {
    const res = FILTERS.hardFilter(r, {
      recentIds: excl.ids,
      recentTitles: excl.titles,
      normalizeTitle
    });
    if (!res.pass) { rejects[res.reason] = (rejects[res.reason] || 0) + 1; return false; }
    return true;
  };

  // Пулим источники по очереди, пока не наберём target прошедших фильтр.
  const collectAll = async (mealType, target) => {
    const pool = [];
    for (const src of SOURCES) {
      if (pool.length >= target) break;
      try {
        const got = await src.collect(mealType, { keep, need: target - pool.length, weekTag, logger });
        pool.push(...got);
        logger.log(`[build] ${src.name}/${mealType}: +${got.length} (пул ${pool.length}/${target})`);
      } catch (e) {
        logger.warn(`[build] ${src.name}/${mealType} пропущен: ${e.message}`);
      }
    }
    return pool;
  };

  const mains = await collectAll('main', 45); // с запасом для отбора 25 с разнообразием
  const soups = await collectAll('soup', 12); // для отбора 5

  // Дедуп по id и нормализованному названию (в т.ч. между источниками).
  const dedupe = (items) => {
    const ids = new Set();
    const titles = new Set();
    const out = [];
    for (const r of items) {
      if (ids.has(r.id)) continue;
      const t = normalizeTitle(r.title);
      if (titles.has(t)) continue;
      ids.add(r.id); titles.add(t);
      out.push(r);
    }
    return out;
  };
  const pool = dedupe([...mains, ...soups]);
  logger.log(`[build] пул после фильтров: вторые ${pool.filter((r) => r.mealType === 'main').length}, супы ${pool.filter((r) => r.mealType === 'soup').length}`);
  logger.log(`[build] причины отбраковки: ${JSON.stringify(rejects)}`);

  // Отбор недели по квотам (25 вторых + 5 супов, разнообразие белка/кухни и т.п.).
  const { recipes: selected, stats } = FILTERS.selectWeek(pool, { seed: weekTag });
  logger.log(`[build] отбор: ${JSON.stringify(stats)}`);

  // Выносим нашу классификацию в menuCategory (recipe.category у eda — это раздел сайта).
  const clean = selected.map(({ __score, __category, timeBucket, ...rest }) => ({ ...rest, menuCategory: __category }));
  const usedSources = [...new Set(selected.map((r) => r.source).filter(Boolean))];

  return {
    generatedAt: startedAt.toISOString(),
    weekTag,
    source: usedSources.join('+') || 'eda.rambler.ru',
    counts: {
      main: selected.filter((r) => r.__category === 'main').length,
      soup: selected.filter((r) => r.__category === 'soup').length,
      veg: selected.filter((r) => r.__category === 'veg').length,
      cheat: selected.filter((r) => r.__category === 'cheat').length,
      total: selected.length,
      byTimeBucket: {
        quick: selected.filter((r) => r.timeBucket === 'quick').length,
        medium: selected.filter((r) => r.timeBucket === 'medium').length,
        long: selected.filter((r) => r.timeBucket === 'long').length
      }
    },
    recipes: clean
  };
};

const main = async () => {
  const args = parseArgs(process.argv);
  const outPath =
    args.out ||
    (args.pending
      ? path.resolve(__dirname, '..', 'recipes-pending.json')
      : path.resolve(__dirname, '..', 'recipes.json'));

  console.log(`[build] target file: ${outPath}`);
  const result = await buildWeekly();

  // Защита от «пустой/тощей ротации»: если источники недоступны или фильтры
  // срезали почти всё — НЕ перезаписываем файл, падаем с ошибкой, сохраняя
  // прошлую рабочую подборку. Лучше прошлая неделя, чем пусто.
  const MIN_ACCEPTABLE = 10;
  if (!result || !result.counts || result.counts.total < MIN_ACCEPTABLE) {
    console.error(
      `[build] FATAL: собрано всего ${result?.counts?.total ?? 0} рецептов ` +
      `(минимум ${MIN_ACCEPTABLE}). Файл НЕ перезаписан — оставляем прошлую подборку.`
    );
    process.exit(1);
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(
    `[build] ✓ ${outPath} — ${result.counts.total} рецептов (вторые=${result.counts.main}, супы=${result.counts.soup}, ` +
    `вегет/гарнир=${result.counts.veg}, чит=${result.counts.cheat}, ` +
    `quick=${result.counts.byTimeBucket.quick}, medium=${result.counts.byTimeBucket.medium}, long=${result.counts.byTimeBucket.long}) ` +
    `источники: ${result.source}`
  );
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[build] FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { buildWeekly, loadExclusionFromDisk, normalizeTitle };
