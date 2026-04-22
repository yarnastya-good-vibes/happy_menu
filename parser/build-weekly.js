// parser/build-weekly.js
// Еженедельный оркестратор. Тянет 30 рецептов с eda.rambler.ru по заданному
// распределению времени готовки и пишет в JSON. Отсекает гарниры.
//
// Распределение (итог 30 рецептов):
//   ≤20 мин  — 15 шт
//   21–40 мин — 10 шт
//   >40 мин   — 5 шт
// Гарантируется ровно 5 супов (все остальные — основные блюда).
//
// Запуск:
//   node parser/build-weekly.js                → recipes.json (первая установка)
//   node parser/build-weekly.js --pending      → recipes-pending.json (еженедельная ротация)
//   node parser/build-weekly.js --out <path>   → произвольный путь

'use strict';

const fs = require('fs');
const path = require('path');
const { fetchRecipe } = require('./fetch-recipe');
const { fetchCategoryRecipes, isRealDish } = require('./fetch-category');

// --- Параметры ---

const TOTAL_TARGET = 30;
const SOUP_TARGET = 5;
const BUCKET_TARGETS = { quick: 15, medium: 10, long: 5 };

// В листинге быстрых (≤20 мин) рецептов мало — примерно 1-2 на страницу.
// Нужен большой пул, чтобы набрать 15 «до 20 мин» после отсева гарниров.
const MAIN_LISTING_PAGES = 25; // 25 × 14 ≈ 350 кандидатов, ~30-35 быстрых
const SOUP_LISTING_PAGES = 2;  //  2 × 14 ≈ 28

// Минимальный белок в «основных блюдах» — ниже скорее всего гарнир.
// На practice этого хватает: Картофельное пюре 4g, Рататуй 4g, Айдахо 10g → отсекутся,
// а «Макароны с сыром» 14g или «Спагетти путтанеска» 24g пройдут.
const MIN_MAIN_PROTEIN = 12;

// --- Ранжирование по качеству ---
// Все сигналы берём из листинга (ApolloState), детальный фетч не нужен.
//   • isEditorChoice — редакция eda.ru вручную отметила рецепт
//   • isGold1000     — курированный пул «золотая 1000»
//   • inCookbookCount — пользователи добавили в свою кулинарную книгу
//   • likes − dislikes — популярность
//   • hasVideo       — есть видеоролик (мягкий бонус, не обязателен)
//   • isSpecialProject — рекламный/спонсорский → жёсткое исключение

const cookbookBonus = (c) => {
  if (c >= 10000) return 40;
  if (c >= 5000) return 30;
  if (c >= 2000) return 22;
  if (c >= 500) return 14;
  if (c >= 100) return 6;
  return 0;
};

const likeBonus = (likes, dislikes) => {
  const total = likes + dislikes;
  if (total < 5) return 0;
  const ratio = likes / total;
  const net = Math.min(likes - dislikes, 60);
  return Math.round(net * 0.4 + (ratio >= 0.85 ? 6 : 0));
};

const scoreCandidate = (c) => {
  let s = 0;
  if (c.isEditorChoice) s += 50;
  if (c.isGold1000) s += 30;
  if (c.hasVideo) s += 10;
  s += cookbookBonus(c.inCookbookCount);
  s += likeBonus(c.likes, c.dislikes);
  // Рейтинг без reviewCount ненадёжен (в листинге нет reviewCount).
  // Даём лёгкий бонус, только если рейтинг высокий И есть достаточная активность.
  if (c.ratingValue >= 4.5 && c.inCookbookCount >= 200) s += 8;
  else if (c.ratingValue >= 4.0 && c.inCookbookCount >= 100) s += 4;
  return s;
};

// Жёсткий фильтр — выкидываем заведомо плохих кандидатов до планирования.
const passesQualityGate = (c) => {
  if (c.isSpecialProject) return false;
  // Рецепты без какой-либо активности и не отмеченные редакцией — мимо
  if (!c.isEditorChoice && !c.isGold1000 && c.inCookbookCount < 50 && c.likes < 5) {
    return false;
  }
  return true;
};

// Имена-шаблоны, которые почти всегда означают просто гарнир: «Картофель», «Картофельное пюре»,
// «Тушёная капуста». Сработает ТОЛЬКО если в названии нет дополняющих слов (с/из/под/и т.п.)
// и слово всего одно-два.
const looksLikeBareSide = (title) => {
  const t = title.toLowerCase().replace(/[«»"']/g, '').trim();
  // пропускает «с/из/под/по/и/в/на/с грибами/с сыром» — это явно блюдо с чем-то
  if (/\s(с|из|под|по|и|в|на)\s/i.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 2) return false;
  return /^(картофель|картошка|картофельное|пюре|тушеная|овощное|овощи)$/i.test(words[0]);
};

// --- Утилиты ---

const parseArgs = (argv) => {
  const out = { out: null, pending: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--pending') out.pending = true;
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
};

const bucketOf = (minutes) => {
  if (!minutes || minutes <= 0) return null;
  if (minutes <= 20) return 'quick';
  if (minutes <= 40) return 'medium';
  return 'long';
};

const normalizeTitle = (s) =>
  s.toLowerCase().replace(/[«»"'.,\-]/g, ' ').replace(/\s+/g, ' ').trim();

const dedupe = (items) => {
  const seenId = new Set(), seenTitle = new Set(), out = [];
  for (const c of items) {
    if (seenId.has(c.id)) continue;
    const t = normalizeTitle(c.name);
    if (seenTitle.has(t)) continue;
    seenId.add(c.id); seenTitle.add(t);
    out.push(c);
  }
  return out;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isMainSideDish = (recipe) => {
  if (recipe.mealType !== 'main') return false;
  const p = recipe.macros?.protein;
  if (typeof p === 'number' && p < MIN_MAIN_PROTEIN) return true;
  if (looksLikeBareSide(recipe.title)) return true;
  return false;
};

// --- Планирование выборки ---
// Раскладывает кандидатов по бакетам type+bucket, потом оптимально выбирает.

const planSelection = (mainPool, soupPool, logger) => {
  // Навешиваем score и сортируем пулы по убыванию качества — в каждом бакете
  // сначала берутся самые качественные кандидаты.
  const prepareWithScore = (pool) =>
    pool
      .map((c) => ({ ...c, __score: scoreCandidate(c) }))
      .sort((a, b) => b.__score - a.__score);

  const scoredMains = prepareWithScore(mainPool);
  const scoredSoups = prepareWithScore(soupPool);

  const bucketed = {
    main: { quick: [], medium: [], long: [], noTime: [] },
    soup: { quick: [], medium: [], long: [], noTime: [] }
  };
  for (const c of scoredMains) {
    const b = bucketOf(c.cookingTime + c.preparationTime) || 'noTime';
    bucketed.main[b].push(c);
  }
  for (const c of scoredSoups) {
    const b = bucketOf(c.cookingTime + c.preparationTime) || 'noTime';
    bucketed.soup[b].push(c);
  }

  logger.log(
    `[build] listing buckets — mains: quick=${bucketed.main.quick.length}, medium=${bucketed.main.medium.length}, long=${bucketed.main.long.length}, no-time=${bucketed.main.noTime.length}`
  );
  logger.log(
    `[build] listing buckets — soups: quick=${bucketed.soup.quick.length}, medium=${bucketed.soup.medium.length}, long=${bucketed.soup.long.length}, no-time=${bucketed.soup.noTime.length}`
  );

  // remaining — сколько ещё осталось в каждом бакете для финального target.
  const remaining = { ...BUCKET_TARGETS };
  const picks = [];

  // --- Фаза 1: 5 супов в бакетах, где есть место ---
  let soupsPicked = 0;
  for (const b of ['medium', 'long', 'quick']) {
    for (const s of bucketed.soup[b]) {
      if (soupsPicked >= SOUP_TARGET) break;
      if (remaining[b] <= 0) break;
      picks.push({ ...s, __type: 'soup', __bucket: b });
      remaining[b]--;
      soupsPicked++;
    }
    if (soupsPicked >= SOUP_TARGET) break;
  }
  // Если всё ещё не 5 супов — берём из любого бакета (даже если переполним target).
  if (soupsPicked < SOUP_TARGET) {
    for (const b of ['medium', 'long', 'quick']) {
      for (const s of bucketed.soup[b]) {
        if (soupsPicked >= SOUP_TARGET) break;
        if (picks.some((p) => p.id === s.id)) continue;
        picks.push({ ...s, __type: 'soup', __bucket: b });
        soupsPicked++;
      }
      if (soupsPicked >= SOUP_TARGET) break;
    }
  }

  // --- Фаза 2: добиваем основные блюда под бакеты ---
  for (const b of ['quick', 'medium', 'long']) {
    for (const m of bucketed.main[b]) {
      if (remaining[b] <= 0) break;
      picks.push({ ...m, __type: 'main', __bucket: b });
      remaining[b]--;
    }
  }

  // Если какой-то бакет ещё недобран (мало листинг-кандидатов), берём кандидатов без времени.
  for (const b of ['quick', 'medium', 'long']) {
    if (remaining[b] <= 0) continue;
    for (const m of bucketed.main.noTime) {
      if (remaining[b] <= 0) break;
      if (picks.some((p) => p.id === m.id)) continue;
      picks.push({ ...m, __type: 'main', __bucket: b });
      remaining[b]--;
    }
  }

  return picks;
};

// --- Полный фетч с отсевом гарниров ---

const fetchAndFilter = async (picks, { logger = console } = {}) => {
  const results = [];
  const droppedSides = [];
  const droppedEmpty = [];

  for (const pick of picks) {
    const url = `https://eda.rambler.ru${pick.relativeUrl}`;
    try {
      const recipe = await fetchRecipe(url, { logger });
      if (!recipe.ingredients?.length || !recipe.steps?.length) {
        droppedEmpty.push(recipe.title);
        continue;
      }
      if (isMainSideDish(recipe)) {
        droppedSides.push(`${recipe.title} (${recipe.macros?.protein}g protein)`);
        continue;
      }
      recipe.id = Number(recipe.sourceId);
      recipe.__bucket = pick.__bucket;
      results.push(recipe);
      await sleep(120);
    } catch (err) {
      logger.warn(`[build] fetch failed ${url}: ${err.message}`);
    }
  }

  if (droppedSides.length) {
    logger.log(`[build] dropped as sides: ${droppedSides.join('; ')}`);
  }
  if (droppedEmpty.length) {
    logger.log(`[build] dropped empty ingredients/steps: ${droppedEmpty.join('; ')}`);
  }

  return results;
};

// --- Добор после отсева ---
// Если отсеяли несколько — дёргаем следующих кандидатов из листинга, пока не заполним бакет.

// Добирает недостающих кандидатов из backup-пула. Соблюдает:
//   • target-распределение по бакетам (15 / 10 / 5)
//   • лимит 5 супов суммарно (если супов уже 5 — берём только mains)
const topUpAfterFilter = async (
  current,
  mainBackup,
  soupBackup,
  { logger = console } = {}
) => {
  const have = new Set(current.map((r) => r.id));
  const needInBucket = { ...BUCKET_TARGETS };
  for (const r of current) needInBucket[r.__bucket]--;

  const soupCount = () => current.filter((r) => r.mealType === 'soup').length;

  const tryPick = async (candidate, bucket) => {
    if (have.has(Number(candidate.id))) return false;
    try {
      const recipe = await fetchRecipe(
        `https://eda.rambler.ru${candidate.relativeUrl}`,
        { logger }
      );
      if (!recipe.ingredients?.length || !recipe.steps?.length) return false;
      if (isMainSideDish(recipe)) return false;
      recipe.id = Number(recipe.sourceId);
      recipe.__bucket = bucket;
      current.push(recipe);
      have.add(recipe.id);
      needInBucket[bucket]--;
      logger.log(`[build] topped up ${bucket}: ${recipe.title}`);
      await sleep(120);
      return true;
    } catch {
      return false;
    }
  };

  for (const b of ['quick', 'medium', 'long']) {
    if (needInBucket[b] <= 0) continue;

    // 1) Сначала пробуем добрать из mains этого бакета
    const mainBackupInBucket = mainBackup.filter(
      (c) => bucketOf((c.cookingTime || 0) + (c.preparationTime || 0)) === b
    );
    for (const c of mainBackupInBucket) {
      if (needInBucket[b] <= 0) break;
      await tryPick(c, b);
    }

    // 2) Если всё ещё не хватает И супов меньше 5 — можно добрать супом
    const soupBackupInBucket = soupBackup.filter(
      (c) => bucketOf((c.cookingTime || 0) + (c.preparationTime || 0)) === b
    );
    for (const c of soupBackupInBucket) {
      if (needInBucket[b] <= 0) break;
      if (soupCount() >= SOUP_TARGET) break;
      await tryPick(c, b);
    }
  }

  return current;
};

// --- Основной флоу ---

const buildWeekly = async ({ logger = console } = {}) => {
  const startedAt = new Date();

  logger.log('[build] === collecting main dishes listings ===');
  const mainsRaw = await fetchCategoryRecipes('osnovnye-blyuda', {
    pageCount: MAIN_LISTING_PAGES,
    logger
  });
  const mainPoolRaw = dedupe(mainsRaw).filter(isRealDish);
  const mainPool = mainPoolRaw.filter(passesQualityGate);
  logger.log(
    `[build] main listing: ${mainPoolRaw.length} candidates → ${mainPool.length} after quality gate`
  );

  logger.log('[build] === collecting soups listings ===');
  const soupsRaw = await fetchCategoryRecipes('supy', {
    pageCount: SOUP_LISTING_PAGES,
    logger
  });
  const soupPoolRaw = dedupe(soupsRaw).filter(isRealDish);
  const soupPool = soupPoolRaw.filter(passesQualityGate);
  logger.log(
    `[build] soup listing: ${soupPoolRaw.length} candidates → ${soupPool.length} after quality gate`
  );

  const picks = planSelection(mainPool, soupPool, logger);
  logger.log(`[build] planned ${picks.length} candidates for full fetch`);
  logger.log('[build] top-5 planned by score:');
  picks
    .slice()
    .sort((a, b) => (b.__score || 0) - (a.__score || 0))
    .slice(0, 5)
    .forEach((p) =>
      logger.log(
        `   [${p.__score}] ${p.name} — editorChoice=${p.isEditorChoice}, cookbook=${p.inCookbookCount}, video=${p.hasVideo}`
      )
    );

  let fetched = await fetchAndFilter(picks, { logger });
  logger.log(`[build] after filter: ${fetched.length} / ${TOTAL_TARGET}`);

  if (fetched.length < TOTAL_TARGET) {
    logger.log('[build] under target — topping up from backup pool');
    await topUpAfterFilter(fetched, mainPool, soupPool, { logger });
    logger.log(`[build] after top-up: ${fetched.length}`);
  }

  // Дедупликация по id на случай коллизий при добре
  const seen = new Set();
  fetched = fetched.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));

  // Удалить служебное поле __bucket перед записью
  fetched = fetched.map(({ __bucket, ...rest }) => rest);

  const weekTag = startedAt.toISOString().slice(0, 10);
  return {
    generatedAt: startedAt.toISOString(),
    weekTag,
    source: 'eda.rambler.ru',
    counts: {
      main: fetched.filter((r) => r.mealType === 'main').length,
      soup: fetched.filter((r) => r.mealType === 'soup').length,
      total: fetched.length,
      byTimeBucket: {
        quick: fetched.filter((r) => bucketOf(r.time) === 'quick').length,
        medium: fetched.filter((r) => bucketOf(r.time) === 'medium').length,
        long: fetched.filter((r) => bucketOf(r.time) === 'long').length
      }
    },
    recipes: fetched
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
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(
    `[build] ✓ ${outPath} — ${result.counts.total} recipes (main=${result.counts.main}, soup=${result.counts.soup}, quick=${result.counts.byTimeBucket.quick}, medium=${result.counts.byTimeBucket.medium}, long=${result.counts.byTimeBucket.long})`
  );
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[build] FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { buildWeekly, bucketOf };
