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
const { fetchRecipe } = require('./fetch-recipe'); // eda (fallback)
const { fetchCategoryRecipes } = require('./fetch-category'); // eda (fallback)
const calor = require('./fetch-calorizator'); // ядро
const FILTERS = require('./recipe-filters'); // жёсткие фильтры + скоринг + квоты

// Примечание: второй источник 1000.menu отключён — в 2026 у него сменились адреса
// категорий (отдаёт 404). Парсер работает на одном источнике eda.rambler.ru.

// --- Параметры ---

const TOTAL_TARGET = 30;
const SOUP_TARGET = 5;
const BUCKET_TARGETS = { quick: 15, medium: 10, long: 5 };

// Новая вёрстка отдаёт ~6 рецептов на страницу листинга. Чтобы собрать пул
// кандидатов с запасом (фетчим из него до 55 основных / 14 супов), берём много
// страниц. Сбор останавливается раньше, если новые рецепты кончились (emptyStreak).
const MAIN_LISTING_PAGES = 18; // ~18×6 ≈ 108 ссылок → хватает на пул 55 после отсева
const SOUP_LISTING_PAGES = 8; // ~8×6 ≈ 48 ссылок супов

// Минимальный белок в «основных блюдах» — ниже скорее всего гарнир.
// На practice этого хватает: Картофельное пюре 4g, Рататуй 4g, Айдахо 10g → отсекутся,
// а «Макароны с сыром» 14g или «Спагетти путтанеска» 24g пройдут.
const MIN_MAIN_PROTEIN = 15;

// Максимум ингредиентов — рецепты с длиннее списка обычно сложные/ресторанные.
const MAX_INGREDIENTS = 15;

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

// Новая вёрстка eda не отдаёт сигналы листинга (editor's choice, cookbook, likes).
// Единственный доступный сигнал качества — aggregateRating со страницы рецепта
// (recipe.rating = { value, count }). Скорим по нему: ценим высокий рейтинг,
// подкреплённый числом оценок (одинокая «пятёрка» весит меньше многих оценок).
const scoreCandidate = (recipe) => {
  const value = Number(recipe?.rating?.value) || 0;
  const count = Number(recipe?.rating?.count) || 0;
  if (count <= 0) return 0;
  let s = value * 6; // 5★ → 30
  if (count >= 5) s += 8;
  if (count >= 20) s += 8;
  if (count >= 100) s += 6;
  return s;
};

// Жёсткий фильтр — выкидываем заведомо плохих кандидатов до планирования.
const passesQualityGate = (c) => {
  if (c.isSpecialProject) return false;
  // Слишком много ингредиентов — сложный ресторанный рецепт, мимо
  if (c.ingredientsCount && c.ingredientsCount > MAX_INGREDIENTS) return false;
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

// Стоп-слова русского языка, которые не влияют на смысл блюда.
const STOPWORDS = new Set([
  'из', 'с', 'со', 'в', 'во', 'на', 'по', 'под', 'над', 'при',
  'для', 'и', 'или', 'к', 'ко', 'от', 'у', 'о', 'об',
  'традиционное', 'традиционный', 'традиционная', 'блюдо', 'блюда',
  'рецепт', 'рецепта'
]);

// Вычисляет «отпечаток» названия, устойчивый к порядку слов, пунктуации и окончаниям-косметике.
// «Грибной крем-суп» → «грибной крем-суп»
// «Крем-суп грибной» → «грибной крем-суп»     ← совпадает
// «Пибимпап (корейское блюдо)» → «пибимпап»  (parenthetical и stop-words отбрасываются)
const normalizeTitle = (s) => {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/ё/g, 'е') // нормализуем ё/е
    .replace(/\([^)]*\)/g, ' ') // выкидываем скобки с содержимым
    .replace(/[«»"'.,:;!?]/g, ' ') // пунктуация прочь (дефисы оставляем — они часть слова)
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w)) // выкидываем пустые и стоп-слова
    .sort() // порядок слов теперь не важен
    .join(' ');
};

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

// --- Исключение блюд из прошлых подборок ---
// Читаем уже существующие recipes.json и recipes-pending.json и собираем их
// id + нормализованные названия. Новый набор не должен содержать ничего из них —
// иначе ротация «не меняется» (старый баг: 29/30 повторялись каждую неделю).

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

// keepBuckets — бакеты по времени, которые НЕ исключаем (например, «быстрые»:
// их в источнике мало, и полное исключение оставляет почти пустой бакет ≤20 мин).
const applyExclusion = (pool, excl, { keepBuckets = [] } = {}) =>
  pool.filter((c) => {
    if (keepBuckets.length) {
      const b = bucketOf((c.cookingTime || 0) + (c.preparationTime || 0));
      if (keepBuckets.includes(b)) return true;
    }
    return !excl.ids.has(Number(c.id)) && !excl.titles.has(normalizeTitle(c.name));
  });

// --- Недельная вариативность ---
// Детерминированный «джиттер» по (weekTag, id): небольшая добавка к score, чтобы
// среди близких по качеству кандидатов порядок отличался от недели к неделе.
// Топовые editor's choice (+50) всё равно остаются впереди — качество не страдает.

const hashStr = (s) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const seededJitter = (seed, id, max = 14) => hashStr(`${seed}:${id}`) % (max + 1);

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

const planSelection = (mainPool, soupPool, logger, seed = '', opts = {}) => {
  // opts позволяет «переплан» — набрать больше кандидатов, чем нужно, чтобы потом
  // выбрать самые сытные/сбалансированные (selectFinal).
  const bucketTargets = opts.bucketTargets || BUCKET_TARGETS;
  const soupTarget = opts.soupTarget != null ? opts.soupTarget : SOUP_TARGET;

  // Навешиваем score и сортируем пулы по убыванию качества — в каждом бакете
  // сначала берутся самые качественные кандидаты. seededJitter добавляет
  // недельную вариативность среди близких по качеству.
  const prepareWithScore = (pool) =>
    pool
      .map((c) => ({ ...c, __score: scoreCandidate(c) + seededJitter(seed, c.id) }))
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
  const remaining = { ...bucketTargets };
  const picks = [];

  // --- Фаза 1: супы в бакетах, где есть место ---
  let soupsPicked = 0;
  for (const b of ['medium', 'long', 'quick']) {
    for (const s of bucketed.soup[b]) {
      if (soupsPicked >= soupTarget) break;
      if (remaining[b] <= 0) break;
      picks.push({ ...s, __type: 'soup', __bucket: b });
      remaining[b]--;
      soupsPicked++;
    }
    if (soupsPicked >= soupTarget) break;
  }
  // Если всё ещё не добрали супы — берём из любого бакета (даже если переполним target).
  if (soupsPicked < soupTarget) {
    for (const b of ['medium', 'long', 'quick']) {
      for (const s of bucketed.soup[b]) {
        if (soupsPicked >= soupTarget) break;
        if (picks.some((p) => p.id === s.id)) continue;
        picks.push({ ...s, __type: 'soup', __bucket: b });
        soupsPicked++;
      }
      if (soupsPicked >= soupTarget) break;
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

  // Переплан: добиваем до minTotal любыми основными (бакет неважен), по score.
  // Это гарантия, что фетч соберёт достаточно кандидатов для финальных 30,
  // даже если в каком-то бакете (обычно «до 20 мин») почти пусто.
  const minTotal = opts.minTotal || 0;
  if (picks.length < minTotal) {
    const have = new Set(picks.map((p) => p.id));
    for (const c of scoredMains) {
      if (picks.length >= minTotal) break;
      if (have.has(c.id)) continue;
      const b = bucketOf(c.cookingTime + c.preparationTime) || 'medium';
      picks.push({ ...c, __type: 'main', __bucket: b });
      have.add(c.id);
    }
  }

  return picks;
};

// --- Питательность: «сытнее» + «сбалансированное БЖУ» ---
// БЖУ хранятся на порцию: protein/fat/carbs (г) и kcal. Калибровка по реальным
// данным eda.ru: медиана белка у основных ~32 г, доля белка ~0.21.

const kcalOf = (m = {}) =>
  (m.protein || 0) * 4 + (m.carbs || 0) * 4 + (m.fat || 0) * 9;

const proteinRatio = (m = {}) => {
  const c = kcalOf(m);
  return c > 0 ? ((m.protein || 0) * 4) / c : 0;
};

const fatRatio = (m = {}) => {
  const c = kcalOf(m);
  return c > 0 ? ((m.fat || 0) * 9) / c : 0;
};

// «Сытнее»: ценим белок и достаточную (но не экстремальную) калорийность.
const fillingScore = (recipe) => {
  const m = recipe.macros || {};
  let s = Math.min(m.protein || 0, 60) * 1.2;
  const c = kcalOf(m);
  if (c >= 350 && c <= 900) s += 8;
  else if (c > 0 && c < 250) s -= 6;
  return s;
};

// «Сбалансированное БЖУ»: хорошая доля белка, без перекоса в жир.
const balanceScore = (recipe) => {
  const m = recipe.macros || {};
  const pr = proteinRatio(m);
  const fr = fatRatio(m);
  let s = 0;
  if (pr >= 0.25) s += 22;
  else if (pr >= 0.2) s += 16;
  else if (pr >= 0.15) s += 9;
  else if (pr >= 0.1) s += 3;
  if (fr > 0.6) s -= 16;
  else if (fr > 0.52) s -= 8;
  return s;
};

const nutritionScore = (recipe) => fillingScore(recipe) + balanceScore(recipe);

// --- Финальный отбор из переплана ---
// Из расширенного пула (с уже посчитанными БЖУ) выбирает ровно target блюд:
//   • жёстко: ровно soupTarget супов (если есть) и всего target (если хватает пула);
//   • мягко: распределение по времени готовки и питательность (сытно/баланс);
//   • дефицит бакета перераспределяется — меню не остаётся неполным (фикс бага 15/30).
const selectFinal = (
  pool,
  { seed = '', soupTarget = SOUP_TARGET, total = TOTAL_TARGET, bucketTargets = BUCKET_TARGETS } = {}
) => {
  const bucketOfRecipe = (r) => r.__bucket || bucketOf(r.time) || 'medium';
  const rank = (r) =>
    (r.__score || 0) * 0.6 + nutritionScore(r) + seededJitter(seed, r.id, 10);

  const sorted = [...pool].sort((a, b) => rank(b) - rank(a));
  const soups = sorted.filter((r) => r.mealType === 'soup');
  const mains = sorted.filter((r) => r.mealType !== 'soup');

  const picked = [];
  const used = new Set();
  const take = (r, bucket) => {
    if (used.has(r.id)) return;
    used.add(r.id);
    picked.push({ ...r, __bucket: bucket });
  };

  // 1) Супы
  soups.slice(0, soupTarget).forEach((r) => take(r, bucketOfRecipe(r)));

  // 2) Основные по бакетам (target минус уже занятые супами слоты)
  const remain = { ...bucketTargets };
  picked.forEach((r) => {
    if (remain[r.__bucket] != null) remain[r.__bucket]--;
  });
  for (const b of ['quick', 'medium', 'long']) {
    for (const r of mains) {
      if (picked.length >= total) break;
      if (used.has(r.id) || bucketOfRecipe(r) !== b || remain[b] <= 0) continue;
      take(r, b);
      remain[b]--;
    }
  }

  // 3) Перераспределение: добиваем total, предпочитая КОРОТКИЕ блюда
  // (quick → medium → long). Так дефицит уходит в medium, а не плодит длинные >40 мин.
  for (const b of ['quick', 'medium', 'long']) {
    for (const r of mains) {
      if (picked.length >= total) break;
      if (used.has(r.id) || bucketOfRecipe(r) !== b) continue;
      take(r, b);
    }
  }

  // 4) Если основные кончились — добиваем дополнительными супами
  for (const r of soups) {
    if (picked.length >= total) break;
    if (used.has(r.id)) continue;
    take(r, bucketOfRecipe(r));
  }

  return picked.slice(0, total);
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
      if (recipe.ingredients.length > MAX_INGREDIENTS) {
        logger.log(
          `[build] drop too-many-ingredients: ${recipe.title} (${recipe.ingredients.length})`
        );
        continue;
      }
      if (isMainSideDish(recipe)) {
        droppedSides.push(`${recipe.title} (${recipe.macros?.protein}g protein)`);
        continue;
      }
      recipe.id = Number(recipe.sourceId);
      recipe.__bucket = pick.__bucket;
      recipe.__score = pick.__score || 0;
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

const buildWeekly = async ({ logger = console, exclude } = {}) => {
  const startedAt = new Date();
  // weekTag — уникальный идентификатор подборки. Включаем время запуска, чтобы
  // повторная генерация в тот же день не совпала с уже применённой подборкой
  // (иначе фронтенд не покажет модалку «новые рецепты»).
  const pad = (n) => String(n).padStart(2, '0');
  const weekTag = `${startedAt.toISOString().slice(0, 10)}_${pad(
    startedAt.getUTCHours()
  )}${pad(startedAt.getUTCMinutes())}`;

  const excl = exclude || loadExclusionFromDisk(logger);
  logger.log(
    `[build] исключаем прошлые подборки: ${excl.ids.size} id, ${excl.titles.size} названий`
  );

  const uniqById = (arr) => {
    const s = new Set();
    return arr.filter((r) => (s.has(r.id) ? false : s.add(r.id)));
  };
  const shuffleByWeek = (arr) =>
    arr
      .map((r) => ({ r, k: seededJitter(weekTag, r.id, 999999) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.r);

  // Счётчик причин отбраковки — для отладки качества подборки.
  const rejects = {};
  const tally = (reason) => { rejects[reason] = (rejects[reason] || 0) + 1; };

  // Общий сбор: фетч деталей + жёсткие фильтры (FILTERS.hardFilter).
  const collectFromSource = async (sourceName, cands, mealType, fetchOne, cap) => {
    const out = [];
    for (const c of cands) {
      if (out.length >= cap) break;
      let recipe;
      try {
        recipe = await fetchOne(c);
      } catch (e) {
        tally('fetch-error');
        continue;
      }
      if (!recipe) { tally('fetch-empty'); continue; }
      recipe.mealType = mealType;
      recipe.id = Number(recipe.sourceId) || recipe.id;
      const res = FILTERS.hardFilter(recipe, {
        recentIds: excl.ids,
        recentTitles: excl.titles,
        normalizeTitle
      });
      if (!res.pass) { tally(res.reason); continue; }
      out.push(recipe);
      await sleep(120);
    }
    logger.log(
      `[build] ${sourceName}/${mealType}: прошло фильтры ${out.length} (фетчей ~${Math.min(cands.length, cap)})`
    );
    return out;
  };

  // ===== Источник 1: ЯДРО — calorizator.ru =====
  logger.log('[build] === calorizator: сбор ссылок ===');
  const cVtorye = shuffleByWeek(
    uniqById(await calor.fetchCategoryRecipes('garnish', { pageCount: 8, logger }))
  );
  const cSupy = shuffleByWeek(
    uniqById(await calor.fetchCategoryRecipes('soups', { pageCount: 3, logger }))
  );
  logger.log(
    `[build] calorizator кандидатов: вторые ${cVtorye.length}, супы ${cSupy.length}`
  );

  let mains = await collectFromSource(
    'calorizator', cVtorye, 'main',
    (c) => calor.fetchRecipe(`https://calorizator.ru${c.relativeUrl}`, { mealType: 'main' }),
    120
  );
  let soups = await collectFromSource(
    'calorizator', cSupy, 'soup',
    (c) => calor.fetchRecipe(`https://calorizator.ru${c.relativeUrl}`, { mealType: 'soup' }),
    30
  );

  // ===== Источник 2 (fallback): eda.rambler.ru — только если ядро не набрало =====
  const needMains = FILTERS.CONFIG.MAIN_TARGET;
  const needSoups = FILTERS.CONFIG.SOUP_TARGET;
  if (mains.length < needMains || soups.length < needSoups) {
    logger.log('[build] === fallback eda: ядро не добрало, дополняем ===');
    const edaBucket = (min) => (!min ? null : min <= 30 ? 'quick' : min <= 60 ? 'medium' : 'long');
    const edaFetch = (mealType) => async (c) => {
      const r = await fetchRecipe(`https://eda.rambler.ru${c.relativeUrl}`, { logger });
      r.timeBucket = edaBucket(r.time);
      r.source = 'eda.rambler.ru';
      return r;
    };
    try {
      if (mains.length < needMains) {
        const e = shuffleByWeek(uniqById(await fetchCategoryRecipes('osnovnye-blyuda', { pageCount: 12, logger })));
        mains = mains.concat(await collectFromSource('eda', e, 'main', edaFetch('main'), 80));
      }
      if (soups.length < needSoups) {
        const e = shuffleByWeek(uniqById(await fetchCategoryRecipes('supy', { pageCount: 6, logger })));
        soups = soups.concat(await collectFromSource('eda', e, 'soup', edaFetch('soup'), 30));
      }
    } catch (e) {
      logger.warn(`[build] fallback eda пропущен: ${e.message}`);
    }
  }

  // Дедуп по id и нормализованному названию (между источниками тоже).
  const dedupe = (items) => {
    const ids = new Set();
    const titles = new Set();
    const res = [];
    for (const r of items) {
      if (ids.has(r.id)) continue;
      const t = normalizeTitle(r.title);
      if (titles.has(t)) continue;
      ids.add(r.id); titles.add(t);
      res.push(r);
    }
    return res;
  };
  const pool = dedupe([...mains, ...soups]);
  logger.log(
    `[build] пул после фильтров: вторые ${pool.filter((r) => r.mealType === 'main').length}, супы ${pool.filter((r) => r.mealType === 'soup').length}`
  );
  logger.log(`[build] причины отбраковки: ${JSON.stringify(rejects)}`);

  // Отбор недели по квотам (25 вторых + 5 супов, разнообразие белка/кухни и т.д.).
  const { recipes: selected, stats } = FILTERS.selectWeek(pool, { seed: weekTag });
  logger.log(`[build] отбор: ${JSON.stringify(stats)}`);

  // Убираем служебные поля перед записью.
  const clean = selected.map(({ __score, timeBucket, ...rest }) => rest);

  return {
    generatedAt: startedAt.toISOString(),
    weekTag,
    source: 'calorizator.ru',
    counts: {
      main: selected.filter((r) => r.mealType === 'main').length,
      soup: selected.filter((r) => r.mealType === 'soup').length,
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

  // Защита от «пустой ротации»: если источники недоступны (eda.rambler.ru
  // часто блокирует IP дата-центров GitHub Actions), buildWeekly вернёт мало
  // или 0 рецептов. Раньше такой результат всё равно записывался и коммитился,
  // из-за чего на сайте каталог становился пустым после «Применить».
  // Теперь — отказываемся писать файл и падаем с ошибкой, сохраняя
  // предыдущую (рабочую) подборку нетронутой.
  const MIN_ACCEPTABLE = 10;
  if (!result || !result.counts || result.counts.total < MIN_ACCEPTABLE) {
    console.error(
      `[build] FATAL: собрано всего ${result?.counts?.total ?? 0} рецептов ` +
      `(минимум ${MIN_ACCEPTABLE}). Файл НЕ перезаписан — оставляем прошлую подборку. ` +
      `Вероятно, источник недоступен или изменил разметку.`
    );
    process.exit(1);
  }

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

module.exports = {
  buildWeekly,
  bucketOf,
  planSelection,
  selectFinal,
  nutritionScore,
  kcalOf,
  proteinRatio,
  applyExclusion,
  loadExclusionFromDisk,
  normalizeTitle,
  seededJitter
};
