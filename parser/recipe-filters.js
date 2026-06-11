// parser/recipe-filters.js
// Источник-независимый отбор рецептов. Критерии v2 (см. КРИТЕРИИ_v2_по_примерам.md, 10.06.2026):
// собраны по реальным примерам пользователя, а не по диетическим эвристикам.
//
// Рецепт (нормализованный, как отдают адаптеры sources.js):
//   { title, mealType:'main'|'soup', time(мин), timeBucket, portions,
//     ingredients:[{name,amount,unit}], steps:[...],
//     macros:{protein,fat,carbs,kcal},   // у curated может НЕ быть (или только kcal)
//     cuisine:{name}, source, sourceClass:'nutritional'|'curated'|'manual' }
//
// КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ v2:
//  - 5 категорий блюд (классификация ниже), у каждой свои пороги и квоты:
//      main (второе на животном белке), soup, veg (вегетарианское/гарнир), cheat (чит-мил).
//  - Класс источника: nutritional (фильтр по КБЖУ) | curated (без фильтра по белку:
//      elementaree/menunedeli — на странице нет Б/Ж/У) | manual (ручной список, t-j).
//  - Красное мясо РАЗРЕШЕНО (общий недельный лимит, не reject).
//  - Штраф за жирность УБРАН (пользователь любит сытное: альфредо, гратен, крем-супы).
//  - Ингредиентов до 16; время мягче (veg без лимита, гарнир/вегет. бывают долгими).
//  - Доля белка для вторых снижена до 0.15 (иначе резало альфредо 0.18).
//
// Экспорт: CONFIG, classifyCategory, hardFilter, scoreRecipe, primaryProtein, selectWeek

'use strict';

// ===== ЕДИНЫЙ КОНФИГ (крутить тут) =====
const CONFIG = {
  // Сытность вторых меряем источник-НЕЗАВИСИМО долей белка (белок·4/ккал) —
  // это безразмерно и работает и для «на порцию» (eda/edimdoma), и для «на 100 г» (food.ru).
  MIN_PROTEIN_RATIO: 0.15, // доля белка для категории main (0.18 у альфредо → порог 0.15)
  MIN_PROTEIN_FLOOR: 0,    // абсолютный пол отключён (несовместим с «на 100 г»)
  MIN_PROTEIN_SOUP: 0,     // супы: достаточно, что белок присутствует (>0); крем-супы ок

  // Гарнир МЯГКИЙ: жёстко режем только «голый белок» (для main) — без гарнира И почти без углеводов.
  MIN_CARBS_BARE: 10,
  GARNISH_BONUS: 12,

  MAX_INGREDIENTS: 16,     // было 14 (гунбао 14, бывает 15)
  MAX_STEPS: 16,
  HARD_MAX_TIME: 120,      // мин; жёсткий потолок для main/soup/cheat. Для veg лимита нет.
  LONG_TIME: 60,           // > этого — «долго» (мягкий штраф в скоринге)
  VLONG_TIME: 90,          // > этого — сильнее штраф

  // Квоты недели. ВАЖНО: WEEK_TARGET — это ОБЩЕЕ число блюд; категории распределяются
  // ВНУТРИ него (а не добавляются сверху). 30 = ~20 вторых + 5 супов + 3 вегет/гарнир + 2 чит.
  WEEK_TARGET: 30,        // всего блюд в неделю
  SOUP_TARGET: 5,         // супов
  VEG_TARGET: 3,          // вегетарианские + гарниры (макс)
  CHEAT_TARGET: 2,        // чит-милы (макс)
  MIN_QUICK: 12,          // целевой минимум «быстрых» вторых (≤30 мин)
  PROTEIN_LIMIT_DEFAULT: 4,
  CUISINE_LIMIT: 4,
  SOURCE_LIMIT: 7,         // макс. блюд из одного источника/нед (разнообразие площадок)
  RED_MEAT_LIMIT: 5,       // говядина+свинина суммарно/нед (запрет снят 10.06.2026)
  HEARTY_PROTEIN: 30,
  HEARTY_FRACTION: 0.7,

  KCAL_BAND: [400, 800],   // ккал — бонус скоринга (для main/soup)
  CURATED_BASE: 22         // базовый балл curated-рецептов (у них нет КБЖУ для скоринга)
};

// ===== Списки (regex). `\b` в JS ломается на кириллице → границы вручную. =====
const LB = '(?<![а-яёa-z])';
const RB = '(?![а-яёa-z])';
const rx = (src) => new RegExp(src, 'i');

const OFFAL = rx(`(печень|печёнк|печеноч|печёноч|потрох|${LB}язык|сердечк|${LB}сердц|${LB}почк|требух|${LB}мозг|вымя|рубец|желудк|субпродукт|сальник)`);
const EXOTIC = rx(`(перепёл|перепел|оленин|кролик|ягнён|ягнят|${LB}дичь|гравлакс|артишок|каперс|${LB}фуа|улитк|устриц|лягуш|конин)`);
const RED_MEAT = rx(`(говядин|телятин|говяж|свинин|${LB}свин|карбонад|корейк|грудинк|бекон|ветчин|${LB}сало${RB}|окорок|буженин)`);
// Десерты/выпечка/напитки/заготовки — НЕ ужин. (Применяется к НЕ-супам: «крем-суп» легитимен.)
const NOT_DINNER = rx(`(десерт|торт(?!иль)|пирожн|${LB}пирог|${LB}кекс|маффин|печенье|${LB}блин|${LB}оладь|сырник|вафл|чизкейк|мороженое|конфет|коктейл|смузи|компот|${LB}морс|варень|${LB}джем|повидл|глазур|сироп|заготовк|консерв)`);
const GARNISH = rx(`(${LB}рис${RB}|рис[а-я]|картоф|картош|макарон|${LB}паста${RB}|спагетт|вермишел|гречк|гречн|булгур|киноа|кускус|кус-кус|${LB}нут${RB}|фасол|чечевиц|перлов|пшено|пшённ|пшенн|лапш|лаваш|тортиль|полент|крупа|${LB}каша|ячнев)`);
// Чит-мил по названию (шаурма/бургер/буррито/кесадилья/пицца/наггетсы/тако…)
const CHEAT = rx(`(шаурм|шаверм|шаварм|бургер|чизбургер|буррито|кесадиль|кесадиц|${LB}тако${RB}|начос|пицц|наггетс|нагетс|хот-?дог|кебаб|донер|шаорма)`);

// ===== Основной белок (для квоты разнообразия) =====
const PROTEIN_PATTERNS = [
  ['fish', rx(`(${LB}рыб|лосос|форел|треск|тунец|сёмг|семг|сельд|скумбри|${LB}окун|судак|${LB}карп|${LB}щук|минтай|${LB}хек|горбуш|${LB}кет[аы]|палтус|дорад|сибас|креветк|кальмар|краб|морепродукт|мидии|икр)`)],
  ['chicken', rx(`(курин|${LB}куриц|цыпл|курятин)`)],
  ['turkey', rx(`(индейк|индюш)`)],
  ['beef', rx(`(говядин|телятин|теляч|говяж|оссобуко|голяшк)`)],
  ['pork', rx(`(свинин|${LB}свин|карбонад|корейк|грудинк|бекон|ветчин|буженин)`)],
  ['lamb', rx(`(баранин|барань|бараш|${LB}ягнятин)`)],
  ['mince', rx(`(фарш)`)],
  ['egg_dairy', rx(`(${LB}яйц|творог|${LB}сыр|адыгейск|моцарелл|${LB}фет[аы]|брынз|тофу)`)]
];

const ingredientsText = (recipe) =>
  (recipe.ingredients || []).map((i) => (i.name || '').toLowerCase()).join(' | ');

const fullText = (recipe) =>
  `${(recipe.title || '').toLowerCase()} | ${ingredientsText(recipe)}`;

const primaryProtein = (recipe) => {
  const t = ingredientsText(recipe);
  for (const [name, re] of PROTEIN_PATTERNS) if (re.test(t)) return name;
  return 'other';
};

const hasGarnish = (recipe) => GARNISH.test(ingredientsText(recipe));

// Растительный «белок» — НЕ животный.
const PLANT_PROTEIN = rx(`(соев|${LB}соя|тофу|сейтан|темпе)`);
const ANIMAL_SET = new Set(['chicken', 'turkey', 'fish', 'beef', 'pork', 'lamb']);
const isAnimalProtein = (recipe) => {
  const p = primaryProtein(recipe);
  if (ANIMAL_SET.has(p)) return true;
  if (p === 'mince') return !PLANT_PROTEIN.test(ingredientsText(recipe));
  return false;
};
const isRedMeat = (recipe) => ['beef', 'pork'].includes(primaryProtein(recipe)) || RED_MEAT.test(ingredientsText(recipe));

// ===== Классификация категории =====
// 'cheat' (по названию) → 'soup' (от источника) → 'main' (животный белок) → 'veg' (всё остальное горячее).
const classifyCategory = (recipe) => {
  if (recipe.categoryOverride) return recipe.categoryOverride; // явное переопределение (ручной импорт)
  if (CHEAT.test(recipe.title || '')) return 'cheat';
  if (recipe.mealType === 'soup') return 'soup';
  return isAnimalProtein(recipe) ? 'main' : 'veg';
};

// ===== Жёсткие фильтры → {pass, reason} =====
const hardFilter = (recipe, { recentIds = new Set(), recentTitles = new Set(), normalizeTitle = (s) => s, config = CONFIG } = {}) => {
  const m = recipe.macros || {};
  const ingText = ingredientsText(recipe);
  const cls = recipe.sourceClass || 'nutritional';
  const cat = classifyCategory(recipe);
  recipe.__category = cat; // фиксируем для скоринга/отбора (recipe.category у eda занято разделом сайта)
  const isSoup = cat === 'soup';
  const macroDriven = cls === 'nutritional';

  // H1: тип/назначение. Десерты-выпечку режем по названию (но не у супов: «крем-суп» легитимен).
  if (!isSoup && NOT_DINNER.test(recipe.title || '')) return { pass: false, reason: 'H1:not-dinner-title' };

  // H8: полнота данных. Шаги/ингредиенты нужны всегда. КБЖУ — только для nutritional.
  if (!recipe.ingredients?.length || !recipe.steps?.length) return { pass: false, reason: 'H8:empty' };
  if (macroDriven && !(m.kcal > 0)) return { pass: false, reason: 'H8:no-kcal' };

  // H2/H3: субпродукты и экзотика (для всех источников, по ингредиентам).
  if (OFFAL.test(ingText)) return { pass: false, reason: 'H2:offal' };
  if (EXOTIC.test(ingText)) return { pass: false, reason: 'H3:exotic' };

  // H7: простота. Кол-во ингредиентов — всем; шаги — только nutritional (у наборов шагов больше).
  if (recipe.ingredients.length > config.MAX_INGREDIENTS) return { pass: false, reason: 'H7:too-many-ingredients' };
  if (macroDriven && recipe.steps.length > config.MAX_STEPS) return { pass: false, reason: 'H7:too-many-steps' };

  // H6: время. Жёсткий потолок для main/soup/cheat; для veg (гарнир/вегет.) лимита нет (ньокки 120 мин).
  if (cat !== 'veg' && recipe.time && recipe.time > config.HARD_MAX_TIME) return { pass: false, reason: 'H6:too-long' };

  // H5/H4: сытность — ТОЛЬКО для main и ТОЛЬКО у nutritional. veg/cheat/soup не фильтруем по белку.
  if (macroDriven && cat === 'main') {
    if (proteinRatio(m) < config.MIN_PROTEIN_RATIO) return { pass: false, reason: 'H5:low-protein-ratio' };
    if (config.MIN_PROTEIN_FLOOR > 0 && m.protein > 0 && m.protein < config.MIN_PROTEIN_FLOOR)
      return { pass: false, reason: 'H5:below-floor' };
    if (!hasGarnish(recipe) && (m.carbs || 0) < config.MIN_CARBS_BARE)
      return { pass: false, reason: 'H4:bare-protein' };
  }

  // H9: без повторов прошлых недель.
  if (recentIds.has(Number(recipe.id))) return { pass: false, reason: 'H9:dup-id' };
  if (recentTitles.has(normalizeTitle(recipe.title))) return { pass: false, reason: 'H9:dup-title' };

  return { pass: true, reason: 'ok' };
};

// ===== Мягкий скоринг =====
const kcalOf = (m) => m.kcal || 0;
const proteinRatio = (m) => (kcalOf(m) > 0 && m.protein > 0 ? (m.protein * 4) / kcalOf(m) : 0);

const seededJitter = (seed, id, max = 10) => {
  let h = 2166136261 >>> 0;
  const s = `${seed}:${id}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % (max + 1);
};

const scoreRecipe = (recipe, { seed = '', config = CONFIG } = {}) => {
  const m = recipe.macros || {};
  const cat = recipe.__category || classifyCategory(recipe);
  const hasMacros = kcalOf(m) > 0;
  let s = hasMacros ? 0 : config.CURATED_BASE; // curated без КБЖУ: стартуем с базы

  if (hasMacros) {
    // Баланс по доле белка (ШТРАФ ЗА ЖИР УБРАН — пользователь любит сытное).
    const pr = proteinRatio(m);
    if (pr >= 0.30) s += 25;
    else if (pr >= 0.25) s += 18;
    else if (pr >= 0.20) s += 10;
    else if (pr >= 0.15) s += 5;
    // Сытность
    if (m.protein) s += Math.min(m.protein, 60) * 0.8;
    const k = kcalOf(m);
    if (k >= config.KCAL_BAND[0] && k <= config.KCAL_BAND[1]) s += 8;
    // штраф за <300 ккал НЕ применяем к veg (гарниры по природе лёгкие)
    else if (cat !== 'veg' && k > 0 && k < 300) s -= 6;
  }

  // Полная тарелка — поощряем (для main)
  if (cat === 'main' && (hasGarnish(recipe) || (m.carbs || 0) >= 25)) s += config.GARNISH_BONUS;

  // Время: бонус за быстрое, мягкий штраф за долгое (кроме veg)
  if (recipe.timeBucket === 'quick' || (recipe.time && recipe.time <= 30)) s += recipe.time && recipe.time <= 20 ? 12 : 8;
  else if (recipe.timeBucket === 'medium' || (recipe.time && recipe.time <= config.LONG_TIME)) s += 4;
  if (cat !== 'veg' && recipe.time) {
    if (recipe.time > config.VLONG_TIME) s -= 8;
    else if (recipe.time > config.LONG_TIME) s -= 3;
  }

  if (recipe.__qualityBonus) s += recipe.__qualityBonus;
  s += seededJitter(seed, recipe.id, 8);
  return s;
};

// ===== Сборка недели под квоты =====
const selectWeek = (pool, { seed = '', config = CONFIG } = {}) => {
  const scored = pool
    .map((r) => ({ ...r, __category: r.__category || classifyCategory(r), __score: scoreRecipe(r, { seed, config }) }))
    .sort((a, b) => b.__score - a.__score);

  const byCat = (c) => scored.filter((r) => r.__category === c);
  const mains = byCat('main');
  const soups = byCat('soup');
  const vegs = byCat('veg');
  const cheats = byCat('cheat');

  const proteinCount = {};
  const cuisineCount = {};
  const sourceCount = {};
  let redMeat = 0;
  let quick = 0;
  const used = new Set();
  const cuisineName = (r) => ((r.cuisine && r.cuisine.name) || '').toLowerCase().trim();
  const sourceName = (r) => (r.source || 'unknown').toLowerCase().trim();
  const isQuick = (r) => r.timeBucket === 'quick' || (r.time && r.time <= 30);

  const limitFor = (p) => (p in config.PROTEIN_LIMIT_OVERRIDES ? config.PROTEIN_LIMIT_OVERRIDES[p] : config.PROTEIN_LIMIT_DEFAULT);

  // Лимит красного мяса — ВСЕГДА жёсткий (даже при доборе). Лимит источника — жёсткий на
  // обычных фазах, но ослабляется при финальном доборе (relaxSrc), иначе при одном доступном
  // источнике меню не набрать. Разнообразие (белок/кухня) ослабляется флагом relaxDiv.
  const canTake = (r, { relaxDiv = false, relaxSrc = false } = {}) => {
    if (isRedMeat(r) && redMeat >= config.RED_MEAT_LIMIT) return false;
    if (!relaxSrc && (sourceCount[sourceName(r)] || 0) >= config.SOURCE_LIMIT) return false;
    if (relaxDiv) return true;
    const p = primaryProtein(r);
    if ((proteinCount[p] || 0) >= limitFor(p)) return false;
    const c = cuisineName(r);
    if (c && (cuisineCount[c] || 0) >= config.CUISINE_LIMIT) return false;
    return true;
  };
  // countDiversity=true только для ВТОРЫХ: лимит «N на белок/кухню» — про разнообразие вторых,
  // он НЕ должен блокировать суп/чит/гарнир (напр. куриный суп не должен «съедать» квоту курицы).
  // Лимит красного мяса (redMeat) — общий для всех категорий.
  const take = (r, bucket, countDiversity = false) => {
    bucket.push(r); used.add(r.id);
    if (isRedMeat(r)) redMeat++;
    if (isQuick(r)) quick++;
    sourceCount[sourceName(r)] = (sourceCount[sourceName(r)] || 0) + 1; // лимит источника — по всем категориям
    if (countDiversity) {
      const p = primaryProtein(r);
      proteinCount[p] = (proteinCount[p] || 0) + 1;
      const c = cuisineName(r);
      if (c) cuisineCount[c] = (cuisineCount[c] || 0) + 1;
    }
  };

  // Сначала фиксированные категории (внутри общего WEEK_TARGET): супы, чит, вегет.
  // Для них проверяем только лимит красного мяса (canTake с relax=true), без лимита разнообразия.
  const soupPicked = [];
  for (const r of soups) { if (soupPicked.length >= config.SOUP_TARGET) break; if (used.has(r.id) || !canTake(r, { relaxDiv: true })) continue; take(r, soupPicked, false); }
  const cheatPicked = [];
  for (const r of cheats) { if (cheatPicked.length >= config.CHEAT_TARGET) break; if (used.has(r.id) || !canTake(r, { relaxDiv: true })) continue; take(r, cheatPicked, false); }
  const vegPicked = [];
  for (const r of vegs) { if (vegPicked.length >= config.VEG_TARGET) break; if (used.has(r.id) || !canTake(r, { relaxDiv: true })) continue; take(r, vegPicked, false); }

  // Вторые добивают остаток до общего лимита недели.
  const mainTarget = Math.max(0, config.WEEK_TARGET - soupPicked.length - cheatPicked.length - vegPicked.length);
  const mainPicked = [];
  // Фаза 1: быстрые вторые до MIN_QUICK
  for (const r of mains) {
    if (mainPicked.length >= mainTarget || quick >= config.MIN_QUICK) break;
    if (used.has(r.id) || !isQuick(r) || !canTake(r)) continue;
    take(r, mainPicked, true);
  }
  // Фаза 2: вторые по score с лимитами разнообразия
  for (const r of mains) {
    if (mainPicked.length >= mainTarget) break;
    if (used.has(r.id) || !canTake(r)) continue;
    take(r, mainPicked, true);
  }
  // Фаза 3: добор. Разнообразие белок/кухня ОСЛАБЛЯЕМ, но лимиты красного мяса и источника
  // остаются жёсткими (если из-за них неделя недобрана — лучше короче, чем 10 блюд из 1 сайта).
  while (mainPicked.length < mainTarget) {
    const remaining = mains.filter((r) => !used.has(r.id) && canTake(r, { relaxDiv: true, relaxSrc: false }));
    if (!remaining.length) break;
    remaining.sort((a, b) => {
      const pa = proteinCount[primaryProtein(a)] || 0;
      const pb = proteinCount[primaryProtein(b)] || 0;
      return pa - pb || b.__score - a.__score;
    });
    take(remaining[0], mainPicked, true);
  }

  // Гарнирам с низким белком (или без КБЖУ) ставим пометку «добавьте белок».
  for (const r of vegPicked) {
    const p = (r.macros && r.macros.protein) || 0;
    if (p > 0 && p < 12) r.note = r.note || 'гарнир — добавьте белок (рыба/индейка/тефтели)';
  }

  const picked = mainPicked; // для статистики ниже
  const all = [...mainPicked, ...soupPicked, ...vegPicked, ...cheatPicked];

  const heartyMains = picked.filter((r) => (r.macros && r.macros.protein || 0) >= config.HEARTY_PROTEIN).length;
  const stats = {
    total: all.length,
    mains: mainPicked.length,
    soups: soupPicked.length,
    veg: vegPicked.length,
    cheat: cheatPicked.length,
    quick,
    redMeat,
    heartyFraction: picked.length ? +(heartyMains / picked.length).toFixed(2) : 0,
    proteinMix: proteinCount,
    cuisineMix: cuisineCount,
    sourceMix: sourceCount
  };
  return { recipes: all, stats };
};

// PROTEIN_LIMIT_OVERRIDES оставляем как механизм (сейчас пуст — красное мясо разрешено через RED_MEAT_LIMIT).
CONFIG.PROTEIN_LIMIT_OVERRIDES = {};

module.exports = {
  CONFIG,
  classifyCategory,
  hardFilter,
  scoreRecipe,
  primaryProtein,
  isAnimalProtein,
  isRedMeat,
  hasGarnish,
  selectWeek,
  OFFAL, EXOTIC, RED_MEAT, NOT_DINNER, GARNISH, CHEAT
};
