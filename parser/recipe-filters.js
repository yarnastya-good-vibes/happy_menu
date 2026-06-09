// parser/recipe-filters.js
// Источник-независимый отбор рецептов по спеке МЕХАНИЗМ_ОТБОРА_рецептов.md.
// Принимает рецепт в нормализованном виде (как отдают fetch-calorizator/fetch-recipe):
//   { title, mealType:'main'|'soup', time, timeBucket, portions,
//     ingredients:[{name,amount,unit}], steps:[...], macros:{protein,fat,carbs,kcal}, cuisine:{name} }
//
// Экспорт: CONFIG, hardFilter, scoreRecipe, primaryProtein, selectWeek

'use strict';

// ===== ЕДИНЫЙ КОНФИГ (крутить тут) =====
const CONFIG = {
  // Пороги жёстких фильтров.
  // «Сытность» меряем источник-независимо: ДОЛЕЙ белка (белок·4/ккал), а не
  // абсолютным белком на порцию — у calorizator порции огромные (белок раздут),
  // у eda реалистичные. Абсолютный порог «25 г» ломал кросс-источник.
  REQUIRE_ANIMAL_PROTEIN: true, // второе должно быть на мясе/птице/рыбе (не сыр/соя)
  MIN_PROTEIN_RATIO: 0.20, // доля белка для вторых (белок·4/ккал)
  MIN_PROTEIN_FLOOR: 12, // и абсолютный пол, г/порция (чтобы не пролезла мелочь)
  MIN_PROTEIN_SOUP: 6, // супы — мягче
  MIN_CARBS_IF_NO_GARNISH: 25, // г/порция
  MAX_INGREDIENTS: 12,
  MAX_STEPS: 12,

  // Квоты недели
  MAIN_TARGET: 25,
  SOUP_TARGET: 5,
  MIN_QUICK: 15, // минимум «быстрых» (≤30 мин) вторых
  PROTEIN_LIMIT_DEFAULT: 4, // макс. блюд на один белок/неделю
  CUISINE_LIMIT: 4, // макс. блюд на одну кухню (если кухня известна)
  HEARTY_PROTEIN: 30, // «сытное» = белок ≥ этого
  HEARTY_FRACTION: 0.7, // целимся, чтобы ≥70% вторых были сытными

  // Лимиты по конкретному белку (0 = исключить). Красное мясо временно выключено.
  PROTEIN_LIMIT_OVERRIDES: { beef: 0, pork: 0 },

  KCAL_BAND: [400, 800] // ккал/порция — бонус скоринга
};

// ===== Списки (regex) =====
// ВАЖНО: в JS `\b` работает только по ASCII и ломается перед кириллицей.
// Поэтому границы слова задаём вручную через lookaround по русским буквам.
const LB = '(?<![а-яёa-z])'; // левая граница слова (кириллица/латиница)
const RB = '(?![а-яёa-z])'; // правая граница
const rx = (src) => new RegExp(src, 'i');

const OFFAL = rx(`(печень|печёнк|печеноч|печёноч|потрох|${LB}язык|сердечк|${LB}сердц|${LB}почк|требух|${LB}мозг|вымя|рубец|желудк|субпродукт|сальник)`);
const EXOTIC = rx(`(перепёл|перепел|оленин|кролик|ягнён|ягнят|${LB}дичь|гравлакс|артишок|каперс|${LB}фуа|улитк|устриц|лягуш|конин)`);
const RED_MEAT = rx(`(говядин|телятин|говяж|свинин|${LB}свин|карбонад|корейк|грудинк|бекон|ветчин|${LB}сало${RB}|окорок|буженин)`);
const NOT_DINNER = rx(`(десерт|торт(?!иль)|пирожн|${LB}пирог|${LB}кекс|маффин|печенье|${LB}блин|${LB}оладь|сырник|вафл|чизкейк|${LB}крем|${LB}мусс|${LB}желе|мороженое|конфет|коктейл|смузи|компот|${LB}морс|варень|${LB}джем|повидл|глазур|сироп|заготовк|консерв)`);
const GARNISH = rx(`(${LB}рис${RB}|рис[а-я]|картоф|картош|макарон|${LB}паста${RB}|спагетт|вермишел|гречк|гречн|булгур|киноа|кускус|кус-кус|${LB}нут${RB}|фасол|чечевиц|перлов|пшено|пшённ|пшенн|лапш|лаваш|тортиль|полент|крупа|${LB}каша|ячнев)`);

// ===== Определение основного белка (для квоты разнообразия) =====
const PROTEIN_PATTERNS = [
  ['fish', rx(`(${LB}рыб|лосос|форел|треск|тунец|сёмг|семг|сельд|скумбри|${LB}окун|судак|${LB}карп|${LB}щук|минтай|${LB}хек|горбуш|${LB}кет[аы]|палтус|дорад|сибас|креветк|кальмар|краб|морепродукт|мидии|икр)`)],
  ['chicken', rx(`(курин|${LB}куриц|цыпл|курятин)`)],
  ['turkey', rx(`(индейк|индюш)`)],
  ['beef', rx(`(говядин|телятин|говяж)`)],
  ['pork', rx(`(свинин|${LB}свин|карбонад|корейк|грудинк|бекон|ветчин|буженин)`)],
  ['mince', rx(`(фарш)`)],
  ['egg_dairy', rx(`(${LB}яйц|творог|${LB}сыр|адыгейск|моцарелл|${LB}фет[аы]|брынз|тофу)`)]
];

const ingredientsText = (recipe) =>
  (recipe.ingredients || []).map((i) => (i.name || '').toLowerCase()).join(' | ');

const primaryProtein = (recipe) => {
  const t = ingredientsText(recipe);
  for (const [name, re] of PROTEIN_PATTERNS) if (re.test(t)) return name;
  return 'other';
};

const hasGarnish = (recipe) => GARNISH.test(ingredientsText(recipe));

// Растительный «белок» — НЕ считается животным (соя/тофу/сейтан и т.п.)
const PLANT_PROTEIN = rx(`(соев|${LB}соя|тофу|сейтан|темпе|растительн|веган)`);
const ANIMAL_SET = new Set(['chicken', 'turkey', 'fish']);
// Второе считается «мясным/рыбным», если основной белок — птица/рыба/морепродукты,
// либо фарш, но НЕ соевый.
const isAnimalProtein = (recipe) => {
  const p = primaryProtein(recipe);
  if (ANIMAL_SET.has(p)) return true;
  if (p === 'mince') return !PLANT_PROTEIN.test(ingredientsText(recipe));
  return false;
};

// ===== Жёсткие фильтры H1..H10 → {pass, reason} =====
const hardFilter = (recipe, { recentIds = new Set(), recentTitles = new Set(), normalizeTitle = (s) => s, config = CONFIG } = {}) => {
  const m = recipe.macros || {};
  const ingText = ingredientsText(recipe);
  const isSoup = recipe.mealType === 'soup';

  // H1: тип блюда
  if (!['main', 'soup'].includes(recipe.mealType)) return { pass: false, reason: 'H1:mealType' };
  if (NOT_DINNER.test(recipe.title || '')) return { pass: false, reason: 'H1:not-dinner-title' };

  // H8: полнота данных
  if (!recipe.ingredients?.length || !recipe.steps?.length) return { pass: false, reason: 'H8:empty' };
  if (!(m.kcal > 0) || !(m.protein > 0)) return { pass: false, reason: 'H8:no-macros' };

  // H10: красное мясо (исключено, пока override=0)
  if ((config.PROTEIN_LIMIT_OVERRIDES.beef === 0 || config.PROTEIN_LIMIT_OVERRIDES.pork === 0) && RED_MEAT.test(ingText))
    return { pass: false, reason: 'H10:red-meat' };

  // H2: субпродукты
  if (OFFAL.test(ingText)) return { pass: false, reason: 'H2:offal' };

  // H3: экзотика
  if (EXOTIC.test(ingText)) return { pass: false, reason: 'H3:exotic' };

  // H7: простота
  if (recipe.ingredients.length > config.MAX_INGREDIENTS) return { pass: false, reason: 'H7:too-many-ingredients' };
  if (recipe.steps.length > config.MAX_STEPS) return { pass: false, reason: 'H7:too-many-steps' };

  // H6: время ≤60 (бакет long = 60-90+ → reject)
  if (recipe.timeBucket === 'long') return { pass: false, reason: 'H6:too-long' };

  if (isSoup) {
    // H5 (суп): мягкий порог белка
    if (m.protein < config.MIN_PROTEIN_SOUP) return { pass: false, reason: 'H5:soup-low-protein' };
  } else {
    // H5a: животный белок (мясо/птица/рыба) — отсекает сыр/соя/овощные «вторые»
    if (config.REQUIRE_ANIMAL_PROTEIN && !isAnimalProtein(recipe))
      return { pass: false, reason: 'H5:not-animal-protein' };
    // H5b: сытность по ДОЛЕ белка (источник-независимо) + абсолютный пол
    if (proteinRatio(m) < config.MIN_PROTEIN_RATIO) return { pass: false, reason: 'H5:low-protein-ratio' };
    if (m.protein < config.MIN_PROTEIN_FLOOR) return { pass: false, reason: 'H5:below-floor' };
    // H4: полноценная тарелка (гарнир ИЛИ углеводы ≥ 25)
    if (!hasGarnish(recipe) && m.carbs < config.MIN_CARBS_IF_NO_GARNISH)
      return { pass: false, reason: 'H4:no-garnish' };
  }

  // H9: без повторов
  if (recentIds.has(Number(recipe.id))) return { pass: false, reason: 'H9:dup-id' };
  if (recentTitles.has(normalizeTitle(recipe.title))) return { pass: false, reason: 'H9:dup-title' };

  return { pass: true, reason: 'ok' };
};

// ===== Мягкий скоринг =====
const kcalOf = (m) => m.kcal || 0;
const proteinRatio = (m) => (kcalOf(m) > 0 ? (m.protein * 4) / kcalOf(m) : 0);
const fatRatio = (m) => (kcalOf(m) > 0 ? (m.fat * 9) / kcalOf(m) : 0);

const seededJitter = (seed, id, max = 10) => {
  let h = 2166136261 >>> 0;
  const s = `${seed}:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % (max + 1);
};

const scoreRecipe = (recipe, { seed = '', config = CONFIG } = {}) => {
  const m = recipe.macros || {};
  let s = 0;

  // Баланс БЖУ
  const pr = proteinRatio(m);
  if (pr >= 0.30) s += 25;
  else if (pr >= 0.25) s += 18;
  else if (pr >= 0.20) s += 10;
  const fr = fatRatio(m);
  if (fr > 0.55) s -= 15;
  else if (fr > 0.45) s -= 7;

  // Сытность
  s += Math.min(m.protein || 0, 60) * 0.8;
  const k = kcalOf(m);
  if (k >= config.KCAL_BAND[0] && k <= config.KCAL_BAND[1]) s += 8;
  else if (k > 0 && k < 300) s -= 6;

  // Простота
  if (recipe.timeBucket === 'quick') s += recipe.time <= 20 ? 12 : 8;
  else if (recipe.timeBucket === 'medium') s += 4;

  // Слой качества (allowlist-автор edimdoma) — выставляется снаружи
  if (recipe.__qualityBonus) s += recipe.__qualityBonus;

  s += seededJitter(seed, recipe.id, 8);
  return s;
};

// ===== Сборка недели под квоты =====
const selectWeek = (pool, { seed = '', config = CONFIG } = {}) => {
  const scored = pool
    .map((r) => ({ ...r, __score: scoreRecipe(r, { seed, config }) }))
    .sort((a, b) => b.__score - a.__score);

  const mains = scored.filter((r) => r.mealType === 'main');
  const soups = scored.filter((r) => r.mealType === 'soup');

  const proteinCount = {};
  const cuisineCount = {};
  const picked = [];
  let quick = 0;

  const limitFor = (p) =>
    p in config.PROTEIN_LIMIT_OVERRIDES ? config.PROTEIN_LIMIT_OVERRIDES[p] : config.PROTEIN_LIMIT_DEFAULT;

  const canTake = (r, ignoreLimits = false) => {
    if (ignoreLimits) return true;
    const p = primaryProtein(r);
    if ((proteinCount[p] || 0) >= limitFor(p)) return false;
    const c = (r.cuisine && r.cuisine.name || '').toLowerCase().trim();
    if (c && (cuisineCount[c] || 0) >= config.CUISINE_LIMIT) return false;
    return true;
  };

  const take = (r) => {
    picked.push(r);
    const p = primaryProtein(r);
    proteinCount[p] = (proteinCount[p] || 0) + 1;
    const c = (r.cuisine && r.cuisine.name || '').toLowerCase().trim();
    if (c) cuisineCount[c] = (cuisineCount[c] || 0) + 1;
    if (r.timeBucket === 'quick') quick++;
  };

  const used = new Set();

  // Фаза 1: добираем «быстрые» вторые до MIN_QUICK
  for (const r of mains) {
    if (quick >= config.MIN_QUICK || picked.length >= config.MAIN_TARGET) break;
    if (used.has(r.id) || r.timeBucket !== 'quick' || !canTake(r)) continue;
    take(r); used.add(r.id);
  }
  // Фаза 2: добиваем вторые по score с соблюдением лимитов
  for (const r of mains) {
    if (picked.length >= config.MAIN_TARGET) break;
    if (used.has(r.id) || !canTake(r)) continue;
    take(r); used.add(r.id);
  }
  // Фаза 3: если лимиты не дали набрать — добираем оставшимися, но каждый раз
  // берём блюдо с наименее представленным белком (чтобы не свалить всё в один).
  while (picked.length < config.MAIN_TARGET) {
    const remaining = mains.filter((r) => !used.has(r.id));
    if (!remaining.length) break;
    remaining.sort((a, b) => {
      const pa = proteinCount[primaryProtein(a)] || 0;
      const pb = proteinCount[primaryProtein(b)] || 0;
      return pa - pb || b.__score - a.__score;
    });
    take(remaining[0]); used.add(remaining[0].id);
  }

  // Супы — по score до SOUP_TARGET
  const soupPicked = [];
  for (const r of soups) {
    if (soupPicked.length >= config.SOUP_TARGET) break;
    soupPicked.push(r);
  }

  const all = [...picked.slice(0, config.MAIN_TARGET), ...soupPicked];

  // Диагностика
  const heartyMains = picked.filter((r) => (r.macros.protein || 0) >= config.HEARTY_PROTEIN).length;
  const stats = {
    mains: Math.min(picked.length, config.MAIN_TARGET),
    soups: soupPicked.length,
    quick,
    heartyFraction: picked.length ? +(heartyMains / picked.length).toFixed(2) : 0,
    proteinMix: proteinCount,
    cuisineMix: cuisineCount
  };
  return { recipes: all, stats };
};

module.exports = {
  CONFIG,
  hardFilter,
  scoreRecipe,
  primaryProtein,
  hasGarnish,
  selectWeek,
  OFFAL, EXOTIC, RED_MEAT, NOT_DINNER, GARNISH
};
