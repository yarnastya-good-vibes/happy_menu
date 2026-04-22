const STORAGE_KEY = "happy-wife-menu-filters-v2";
const RECIPE_CYCLE_STORAGE_KEY = "happy-wife-menu-recipe-cycle-v1";
// pantryExclusions временно пуст — добавим на следующей итерации.
const pantryExclusions = [];

// Активные рецепты загружаются из recipes.json в bootstrap()
// (или из localStorage, если пользователь принял еженедельную ротацию).
let recipes = [];

// ---------- Цикл рецептов по неделям ----------

const getMoscowDateParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) };
};

const getMoscowWeekday = (date = new Date()) => {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Moscow", weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
};

const getCurrentRecipeCycleKey = () => {
  const now = new Date();
  const parts = getMoscowDateParts(now);
  const weekday = getMoscowWeekday(now);
  const daysSinceMonday = (weekday + 6) % 7;
  const cycleStart = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - daysSinceMonday, 3, 0, 0));
  if (weekday === 1 && parts.hour < 6) cycleStart.setUTCDate(cycleStart.getUTCDate() - 7);
  return cycleStart.toISOString().slice(0, 10);
};

const seededHash = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
};

const sortRecipesByCycle = (allRecipes, cycleKey) =>
  [...allRecipes].sort((a, b) => seededHash(`${cycleKey}-${a.id}`) - seededHash(`${cycleKey}-${b.id}`));

const getNextRecipeRefreshLabel = () => {
  const now = new Date();
  const parts = getMoscowDateParts(now);
  const weekday = getMoscowWeekday(now);
  const daysUntilMonday = weekday === 1 && parts.hour < 6 ? 0 : (8 - weekday) % 7 || 7;
  const nextRefresh = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysUntilMonday, 3, 0, 0));
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit"
  }).format(nextRefresh);
};

const recipeCycleKey = getCurrentRecipeCycleKey();
let sortedRecipes = [];  // вычисляется в bootstrap() после загрузки рецептов

const weekDays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

const defaultFilters = { ingredient: "", excludeIngredient: "", difficulty: "all", time: "all", meat: "all" };

const state = {
  servings: 2,
  plannedRecipeIds: [],
  filters: { ...defaultFilters },
  activeRecipeId: null,
  selectedStore: "perekrestok"
};

// ---------- DOM refs ----------

const recipesGrid = document.querySelector("#recipes-grid");
const weeklyPlan = document.querySelector("#weekly-plan");
const shoppingList = document.querySelector("#shopping-list");
const servingsValue = document.querySelector("#servings-value");
const servingsNote = document.querySelector("#servings-note");
const selectedCount = document.querySelector("#selected-count");
const cartCount = document.querySelector("#cart-count");
const catalogRefreshNote = document.querySelector("#catalog-refresh-note");
const catalogCount = document.querySelector("#catalog-count");
const ingredientFilter = document.querySelector("#ingredient-filter");
const excludeIngredientFilter = document.querySelector("#exclude-ingredient-filter");
const difficultyFilter = document.querySelector("#difficulty-filter");
const meatFilter = document.querySelector("#meat-filter");
const timeFilters = document.querySelectorAll('input[name="time-filter"]');
const resetFiltersButton = document.querySelector("#reset-filters");
const recipeViewer = document.querySelector("#recipe-viewer");
const recipeViewerImage = document.querySelector("#recipe-viewer-image");
const recipeViewerTitle = document.querySelector("#recipe-viewer-title");
const recipeViewerTime = document.querySelector("#recipe-viewer-time");
const recipeViewerDifficulty = document.querySelector("#recipe-viewer-difficulty");
const recipeViewerServings = document.querySelector("#recipe-viewer-servings");
const recipeViewerMacros = document.querySelector("#recipe-viewer-macros");
const recipeViewerIngredients = document.querySelector("#recipe-viewer-ingredients");
const recipeViewerSteps = document.querySelector("#recipe-viewer-steps");
const copyListBtn = document.querySelector("#copy-list-btn");

// ---------- Утилиты ----------

const parseIngredientTokens = (value) =>
  value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

const getRecipeIngredientNames = (recipe) =>
  recipe.ingredients.map((i) => i.name.toLowerCase());

const isPantryStaple = (name) =>
  pantryExclusions.some((p) => name.toLowerCase().includes(p));

const buildRecipeSteps = (recipe) => {
  // Если у рецепта есть настоящие пошаговые инструкции (из eda.rambler.ru) — используем их.
  // Шаблон ниже остаётся как fallback для старых/ручных рецептов без поля steps.
  if (Array.isArray(recipe.steps) && recipe.steps.length > 0) {
    return recipe.steps.map((step, i) => {
      const text = typeof step === "string" ? step : step.text || "";
      const timing = typeof step === "object" && step.timeMin
        ? ` (≈ ${step.timeMin} мин)` : "";
      return `Шаг ${i + 1}. ${text}${timing}`;
    });
  }
  const [first, second, third, fourth] = recipe.ingredients;
  return [
    `Шаг 1. Подготовьте продукты: нарежьте ${first.name.toLowerCase()} и ${second.name.toLowerCase()}, разогрейте рабочую поверхность.`,
    `Шаг 2. Начните основу блюда: приготовьте ${second.name.toLowerCase()}, параллельно обжарьте ${first.name.toLowerCase()} до полуготовности.`,
    `Шаг 3. Добавьте ${third?.name.toLowerCase() || "остальные ингредиенты"} и ${fourth?.name.toLowerCase() || "специи"}, доведите до вкуса.`,
    `Шаг 4. Подавайте сразу: проверьте соль, разложите по тарелкам и украсьте свежей зеленью.`
  ];
};

const loadFilters = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.filters = {
      ingredient: typeof parsed.ingredient === "string" ? parsed.ingredient : "",
      excludeIngredient: typeof parsed.excludeIngredient === "string" ? parsed.excludeIngredient : "",
      difficulty: parsed.difficulty || "all",
      time: parsed.time || "all",
      meat: parsed.meat || "all"
    };
  } catch { state.filters = { ...defaultFilters }; }
};

const saveFilters = () => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.filters));
const resetFilters = () => { state.filters = { ...defaultFilters }; saveFilters(); render(); };

const formatAmount = (amount) => {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const getTimeLabel = (minutes) =>
  minutes <= 20 ? "до 20 мин" : minutes <= 40 ? "20-40 мин" : "более 40 мин";

const syncFilterControls = () => {
  ingredientFilter.value = state.filters.ingredient;
  excludeIngredientFilter.value = state.filters.excludeIngredient;
  difficultyFilter.value = state.filters.difficulty;
  meatFilter.value = state.filters.meat;
  timeFilters.forEach((f) => { f.checked = f.value === state.filters.time; });
};

const matchesFilters = (recipe) => {
  const names = getRecipeIngredientNames(recipe);
  const includeTokens = parseIngredientTokens(state.filters.ingredient);
  const excludeTokens = parseIngredientTokens(state.filters.excludeIngredient);

  const includeMatch = includeTokens.length === 0 ||
    includeTokens.every((t) => names.some((n) => n.includes(t)));
  const excludeMatch = excludeTokens.length === 0 ||
    excludeTokens.every((t) => !names.some((n) => n.includes(t)));
  const difficultyMatch = state.filters.difficulty === "all" || recipe.difficulty === state.filters.difficulty;
  const timeMatch = state.filters.time === "all" ||
    (state.filters.time === "20" && recipe.time <= 20) ||
    (state.filters.time === "20-40" && recipe.time > 20 && recipe.time <= 40) ||
    (state.filters.time === "40+" && recipe.time > 40);
  const meatMatch = state.filters.meat === "all" ||
    (state.filters.meat === "no-red-meat" && recipe.meatCategory !== "red-meat") ||
    (state.filters.meat === "vegetarian" && recipe.diet === "vegetarian") ||
    (state.filters.meat === "vegan" && recipe.diet === "vegan");

  return includeMatch && excludeMatch && difficultyMatch && timeMatch && meatMatch &&
    !state.plannedRecipeIds.includes(recipe.id);
};

const getScaledMacro = (value) => Math.round((value / 2) * state.servings);

const syncBodyScrollLock = () => {
  document.body.style.overflow = state.activeRecipeId !== null ? "hidden" : "";
};

const openRecipeViewer = (recipeId) => { state.activeRecipeId = recipeId; renderRecipeViewer(); };
const closeRecipeViewer = () => { state.activeRecipeId = null; renderRecipeViewer(); };

// ---------- Рендер ----------

const hasActiveCatalogFilters = () => {
  const f = state.filters;
  return Boolean(
    (f.ingredient && f.ingredient.trim()) ||
    (f.excludeIngredient && f.excludeIngredient.trim()) ||
    (f.difficulty && f.difficulty !== "all") ||
    (f.time && f.time !== "all") ||
    (f.meat && f.meat !== "all")
  );
};

const renderCatalogCount = (visibleCount, availableCount) => {
  if (!catalogCount) return;
  const pluralize = (n, one, few, many) => {
    const mod100 = n % 100;
    const mod10 = n % 10;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  };
  const word = (n) => pluralize(n, "рецепт", "рецепта", "рецептов");
  if (hasActiveCatalogFilters()) {
    catalogCount.innerHTML = `Найдено <span class="catalog-count__filtered">${visibleCount}</span> ${word(visibleCount)} из ${availableCount}`;
  } else {
    catalogCount.textContent = `В каталоге ${availableCount} ${word(availableCount)}`;
  }
};

const renderRecipes = () => {
  const list = sortedRecipes.filter(matchesFilters);
  const available = sortedRecipes.filter((r) => !state.plannedRecipeIds.includes(r.id)).length;
  renderCatalogCount(list.length, available);
  if (!list.length) {
    recipesGrid.innerHTML = `<div class="empty-state">По текущим фильтрам ничего не найдено. Попробуйте изменить условия или убрать рецепт из плана.</div>`;
    return;
  }
  recipesGrid.innerHTML = list.map((recipe, index) => `
    <article class="recipe-card" style="animation-delay: ${index * 50}ms">
      <div class="recipe-card__image">
        <img src="${recipe.image}" alt="${recipe.title}" />
        <span class="recipe-card__badge">${getTimeLabel(recipe.time)}</span>
      </div>
      <div class="recipe-card__body">
        <h3 class="recipe-card__title">${recipe.title}</h3>
        <div class="recipe-card__meta">
          <div class="meta-pill"><strong>Время</strong><span>${recipe.time} минут</span></div>
          <div class="meta-pill"><strong>Сложность</strong><span>${recipe.difficulty}</span></div>
        </div>
        <div class="recipe-card__macros">
          <div class="macro-pill"><strong>Белки</strong><span>${getScaledMacro(recipe.macros.protein)} г</span></div>
          <div class="macro-pill"><strong>Жиры</strong><span>${getScaledMacro(recipe.macros.fat)} г</span></div>
          <div class="macro-pill"><strong>Углеводы</strong><span>${getScaledMacro(recipe.macros.carbs)} г</span></div>
        </div>
        <ul class="recipe-card__ingredients">
          ${recipe.ingredients.map((i) => `<li>${i.name}</li>`).join("")}
        </ul>
        <div class="recipe-card__actions">
          <button class="add-button" type="button" data-action="toggle-plan" data-recipe-id="${recipe.id}"
            ${state.plannedRecipeIds.length >= 7 ? "disabled" : ""}>
            Добавить в меню
          </button>
          <button class="ghost-button" type="button" data-action="show-ingredients" data-recipe-id="${recipe.id}">
            Рецепт
          </button>
        </div>
      </div>
    </article>`).join("");
};

const renderWeeklyPlan = () => {
  weeklyPlan.innerHTML = weekDays.map((day, index) => {
    const recipeId = state.plannedRecipeIds[index];
    const recipe = sortedRecipes.find((r) => r.id === recipeId);
    if (!recipe) return `
      <div class="day-card">
        <div class="day-card__index">${index + 1}</div>
        <div><p class="day-card__title">${day}</p><p class="day-card__note">Свободный вечер. Выберите рецепт из каталога.</p></div>
      </div>`;
    return `
      <div class="day-card">
        <div class="day-card__index">${index + 1}</div>
        <div>
          <p class="day-card__title">${day}</p>
          <p class="day-card__note">${recipe.title} · ${recipe.time} мин · ${recipe.difficulty}</p>
        </div>
        <button type="button" data-action="remove-plan" data-recipe-id="${recipe.id}">Убрать</button>
      </div>`;
  }).join("");
};

// ---------- Категории ингредиентов ----------

// Порядок важен — ищется первое совпадение по substring. Specific раньше general.
// "Куриный бульон" должен матчнуться canned раньше, чем meat "курин".
// "Стручковая фасоль" — veggie раньше, чем canned "фасоль консерв".
const CATEGORIES = [
  { id: "seasoning", label: "Специи и приправы", keys: [
    "мускат", "корица", "гвоздик", "лавровый", "лавров лист", "кардамон",
    "зира", "зиру", "тмин", "паприк", "куркум", "анис", "бадьян",
    "ваниль", "ванильн", "сумах", "хмели", "барбарис", "шафран",
    "молотый перец", "чёрный перец", "черный перец", "белый перец",
    "душистый перец", "перец горошком", "перец молотый", "красный молотый",
    "чили порошок", "порошок чили", "сушен", "специи"
  ]},
  { id: "dairy", label: "Молочное и яйца", keys: [
    "яйц", "сливк", "молок", "молочн",
    "сыр", "фет", "рикотт", "моцарелл", "пармезан", "грюйер", "маскарпон",
    "бри", "камамбер", "рокфор", "голуб",
    "йогурт", "халум", "творог", "сметан", "кефир", "ряженк", "простокваш",
    "сливочное масло"
  ]},
  { id: "canned", label: "Консервы и соусы", keys: [
    // Специфичные помидорные продукты (не путать со свежими).
    // Важно учитывать окончания: «томатная паста», а не «томатн паста».
    "томатная паста", "томатной пасты", "томатная пюре", "томатное пюре",
    "томатный соус", "томатного соуса", "томатный сок", "томатного сока",
    "томатный кетчуп", "томатная заправ",
    "томаты в собствен", "томаты в соб", "помидоры в собствен",
    "консерв томат", "томат в банк",
    // Консервы бобовых — только специфичные формы (сухие/свежие идут в veggie)
    "фасоль консерв", "красная фасол", "белая фасол", "нут консерв",
    "горошек консерв", "кукуруза консерв", "консервирован",
    // Соусы и основы
    "кокосовое молоко", "кокосовый", "соев", "терияк", "карри паст",
    "бульон", "вялен", "сок лимона", "сок лайма",
    "горчиц", "майонез", "кетчуп", "уксус", "вустерш", "сладкий соус",
    "рыбный соус", "устричный соус"
  ]},
  { id: "oils", label: "Масла и жиры", keys: [
    "оливковое масло", "растительное масло", "подсолнечное масло",
    "кунжутное масло", "кокосовое масло", "льняное масло",
    "масло extra virgin", "топлёное масло", "гхи"
  ]},
  { id: "veggie", label: "Овощи и зелень", keys: [
    // овощи — стручков должен матчнуться раньше (canned already ran с "фасоль консерв")
    "стручков", "зелёная стручковая", "стручковая фасоль",
    "картофел", "картошк", "помидор", "томат", "черри",
    "чеснок", "морков", "шпинат", "капуст", "цукин", "кабачок",
    "баклажан", "батат", "авокадо", "огурец", "огурцы", "огурц",
    "редис", "свекл", "репа", "сельдере", "спарж", "брокколи",
    "сладкий перец", "болгарский перец", "перец болгар", "перец чили", "перец острый",
    "зелёный горошек", "зеленый горошек",
    "цветная капуст", "брюссельск", "пекинск", "фенхел", "артишок",
    "лук-порей", "лук порей", "зелёный лук", "зеленый лук", "репчатый лук",
    "шалот",
    // зелень
    "петрушк", "укроп", "базилик", "кинза", "зелён", "салат", "руккол",
    "мят", "черемш", "тимьян", "розмарин", "эстрагон", "шалфей",
    // тыквенные
    "тыкв",
    // общий лук (fallback в самом конце)
    "лук"
  ]},
  { id: "meat", label: "Мясо и рыба", keys: [
    // мясо и птица
    "говяд", "говяж", "телят", "теляч",
    "свинин", "свиной", "свиная", "свиные",
    "барани", "баранье", "баранья", "ягн",
    "курин", "куриц", "курочк", "курятин", "цыпл",
    "индейк", "индюш", "утк", "утин", "утя", "гус", "перепел", "кролик",
    "фарш", "стейк", "бекон", "ветчин", "колбас", "салями",
    "грудинк", "корейк", "буженин", "пастром", "прошутт", "хамон", "шпик",
    // рыба и морепродукты
    "лосос", "форель", "горбуш", "сёмг", "семг", "кет", "нерк",
    "тунец", "тунц", "треск", "хек", "палтус", "судак", "окун", "щук",
    "сельд", "кильк", "скумбри", "сардин", "сайр", "анчоус",
    "креветк", "кальмар", "мидии", "осьминог", "краб", "гребешк", "лангустин",
    "морепродукт", "икр", "дорад", "сибас", "тилапи"
  ]},
  { id: "grain", label: "Крупы, паста, мука", keys: [
    "рис", "паста", "спагетт", "пенне", "пенны", "орзо", "фарфалле", "фузилли",
    "феттучин", "тальятелл", "ригатон", "макарон", "вермишел",
    "булгур", "киноа", "гречк", "перловк", "соба", "удон", "лапш", "рамен",
    "тортиль", "хлеб", "кускус", "кус-кус", "лазан", "лист лазань",
    "мук", "толокн", "овсянк", "крупа", "манк", "кукурузн крупа"
  ]},
  { id: "fruit", label: "Фрукты и ягоды", keys: [
    "лимон", "лайм", "яблок", "апельсин", "мандарин", "грейпфрут", "банан",
    "клубник", "малин", "черник", "голубик", "смородин", "виноград",
    "груш", "персик", "абрикос", "слив", "манго", "ананас", "ягод",
    "изюм", "курага", "чернослив", "оливк", "маслин"
  ]},
  { id: "other", label: "Остальное", keys: [] }
];

const getCategory = (name) => {
  const n = name.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keys.some((k) => n.includes(k))) return cat.id;
  }
  return "other";
};

// --- Объединение одинаковых ингредиентов с конвертацией единиц ---
// "Куриный бульон 1л" + "Куриный бульон 700мл" → "Куриный бульон 1.7 л"
// "Говядина 500г" + "Говядина 0.3кг" → "Говядина 800 г"
// Если единицы разные и несовместимые (напр. штуки и граммы) — остаются отдельными позициями.

const VOLUME_UNITS_TO_ML = {
  "мл": 1,
  "миллилитр": 1,
  "миллилитра": 1,
  "миллилитров": 1,
  "л": 1000,
  "литр": 1000,
  "литра": 1000,
  "литров": 1000,
  "стакан": 200,
  "стакана": 200,
  "стаканов": 200,
  "столовая ложка": 15,
  "столовых ложек": 15,
  "столовые ложки": 15,
  "ст. л.": 15,
  "ст.л.": 15,
  "чайная ложка": 5,
  "чайных ложек": 5,
  "чайные ложки": 5,
  "ч. л.": 5,
  "ч.л.": 5,
  "десертная ложка": 10,
  "десертных ложек": 10
};

const WEIGHT_UNITS_TO_G = {
  "г": 1,
  "грамм": 1,
  "грамма": 1,
  "граммов": 1,
  "кг": 1000,
  "килограмм": 1000,
  "килограмма": 1000,
  "килограммов": 1000
};

// Разбирает единицу → { family, factor } для дальнейшей конвертации в канонические.
const classifyUnit = (unit) => {
  const u = (unit || "").toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(VOLUME_UNITS_TO_ML, u)) {
    return { family: "volume", factor: VOLUME_UNITS_TO_ML[u], originalUnit: u };
  }
  if (Object.prototype.hasOwnProperty.call(WEIGHT_UNITS_TO_G, u)) {
    return { family: "weight", factor: WEIGHT_UNITS_TO_G[u], originalUnit: u };
  }
  // "штука", "головка", "зубчик", "пучок", "по вкусу", ... — не конвертируем, мерджим по точной единице.
  return { family: "count", factor: 1, originalUnit: u };
};

// Подбирает красивую единицу для отображения после слияния.
const formatMergedAmount = (family, amountBase, fallbackUnit) => {
  if (family === "volume") {
    if (amountBase >= 1000) return { amount: amountBase / 1000, unit: "л" };
    return { amount: amountBase, unit: "мл" };
  }
  if (family === "weight") {
    if (amountBase >= 1000) return { amount: amountBase / 1000, unit: "кг" };
    return { amount: amountBase, unit: "г" };
  }
  return { amount: amountBase, unit: fallbackUnit };
};

const canonicalIngredientKey = (name) => name.toLowerCase().trim();

const buildShoppingItems = () => {
  const multiplier = state.servings / 2;
  const basket = new Map();

  state.plannedRecipeIds.forEach((recipeId) => {
    const recipe = sortedRecipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    recipe.ingredients.forEach((ingredient) => {
      if (isPantryStaple(ingredient.name)) return;
      const { family, factor, originalUnit } = classifyUnit(ingredient.unit);
      // Для volume и weight — мерджим по названию независимо от единицы.
      // Для count — мерджим только по точному совпадению единицы (штуки с штуками).
      const key =
        family === "count"
          ? `${canonicalIngredientKey(ingredient.name)}|count|${originalUnit}`
          : `${canonicalIngredientKey(ingredient.name)}|${family}`;

      const existing = basket.get(key);
      const addition = (Number(ingredient.amount) || 0) * factor * multiplier;

      if (existing) {
        existing.amountBase += addition;
      } else {
        basket.set(key, {
          key,
          name: ingredient.name, // берём оригинальное имя из первого вхождения
          family,
          originalUnit,
          amountBase: addition,
          category: getCategory(ingredient.name)
        });
      }
    });
  });

  return Array.from(basket.values())
    .map((it) => {
      const { amount, unit } = formatMergedAmount(it.family, it.amountBase, it.originalUnit);
      return {
        key: it.key,
        name: it.name,
        amount,
        unit,
        category: it.category
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
};

const groupByCategory = (items) => {
  const groups = [];
  for (const cat of CATEGORIES) {
    const catItems = items.filter((i) => i.category === cat.id);
    if (catItems.length) groups.push({ ...cat, items: catItems });
  }
  return groups;
};


// ---------- Магазины ----------

const STORES = {
  perekrestok: {
    id: "perekrestok",
    label: "Перекрёсток",
    searchUrl: (q) => `https://www.perekrestok.ru/cat/search?search=${encodeURIComponent(q)}`
  },
  lavka: {
    id: "lavka",
    label: "Яндекс Лавка",
    searchUrl: (q) => `https://lavka.yandex.ru/search?text=${encodeURIComponent(q)}`
  },
  vkusvill: {
    id: "vkusvill",
    label: "ВкусВилл",
    searchUrl: (q) => `https://vkusvill.ru/search/?q=${encodeURIComponent(q)}`
  }
};

const getStoreSearchUrl = (ingredientName) =>
  STORES[state.selectedStore].searchUrl(ingredientName);

// Хранилище отмеченных позиций (ключ = название-единица)
const checkedItems = new Set();

const renderShoppingItem = (item) => {
  const key = item.key;
  const checked = checkedItems.has(key);
  const searchUrl = getStoreSearchUrl(item.name);
  return `
    <div class="shopping-item shopping-item--checkable ${checked ? "shopping-item--checked" : ""}"
         data-action="toggle-check" data-key="${key}">
      <div class="shopping-item__check">
        <div class="check-circle ${checked ? "check-circle--done" : ""}">
          ${checked ? `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ""}
        </div>
      </div>
      <div class="shopping-item__meta">
        <strong class="shopping-item__name">${item.name}</strong>
        <span>На ${state.servings} ${state.servings === 1 ? "персону" : "персоны"}</span>
      </div>
      <div class="shopping-item__actions">
        <strong>${formatAmount(item.amount)} ${item.unit}</strong>
        ${!checked ? `<a class="find-in-store-btn" href="${searchUrl}" target="_blank" rel="noreferrer" data-action="find-in-store">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5h8M5.5 1.5l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Найти
        </a>` : ""}
      </div>
    </div>`;
};

const renderShoppingList = () => {
  const items = buildShoppingItems();
  cartCount.textContent = String(items.length);
  if (!items.length) {
    shoppingList.innerHTML = `<div class="empty-state">Список появится после выбора рецептов. Базовые ингредиенты — соль, перец, масло — не включаем.</div>`;
    return;
  }
  const groups = groupByCategory(items);
  const unchecked = items.filter((i) => !checkedItems.has(i.key));
  const storeName = STORES[state.selectedStore].label;

  shoppingList.innerHTML = `
    <div class="store-picker">
      ${Object.values(STORES).map((s) => `
        <button class="store-tab ${s.id === state.selectedStore ? "store-tab--active" : ""}"
                data-action="select-store" data-store="${s.id}" type="button">
          ${s.label}
        </button>`).join("")}
    </div>
    ${unchecked.length > 0 ? `
    <button class="open-all-btn" id="open-all-btn" type="button">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 7h11M7 1.5l5.5 5.5L7 12.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Открыть всё в ${storeName} (${unchecked.length})
    </button>` : ""}
  ` + groups.map((group) => `
    <div class="shopping-category">
      <p class="shopping-category__label">${group.label}</p>
      ${group.items.map(renderShoppingItem).join("")}
    </div>`).join("") + `
    <div class="shopping-export">
      <button class="shopping-export__btn" id="export-categories-btn" type="button">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4.5h12M2 8h8M2 11.5h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        Скопировать по категориям
      </button>
      <button class="shopping-export__btn" id="export-telegram-btn" type="button">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8l11-5-3.5 11-2.5-3.5L4 9l-2-1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
        Отправить в Telegram
      </button>
    </div>`;

  document.getElementById("export-categories-btn")?.addEventListener("click", exportByCategories);
  document.getElementById("export-telegram-btn")?.addEventListener("click", exportToTelegram);
  document.getElementById("open-all-btn")?.addEventListener("click", openAllInStore);
};

const renderRecipeViewer = () => {
  if (!recipeViewer) return;
  const recipe = sortedRecipes.find((r) => r.id === state.activeRecipeId);
  if (!recipe) { recipeViewer.hidden = true; syncBodyScrollLock(); return; }

  recipeViewer.hidden = false;
  syncBodyScrollLock();
  recipeViewerImage.src = recipe.image;
  recipeViewerImage.alt = recipe.title;
  recipeViewerTitle.textContent = recipe.title;
  recipeViewerTime.textContent = `${recipe.time} минут`;
  recipeViewerDifficulty.textContent = recipe.difficulty;
  recipeViewerServings.textContent = `${state.servings}`;
  recipeViewerMacros.innerHTML = `
    <div class="macro-pill"><strong>Белки</strong><span>${getScaledMacro(recipe.macros.protein)} г</span></div>
    <div class="macro-pill"><strong>Жиры</strong><span>${getScaledMacro(recipe.macros.fat)} г</span></div>
    <div class="macro-pill"><strong>Углеводы</strong><span>${getScaledMacro(recipe.macros.carbs)} г</span></div>`;
  recipeViewerIngredients.innerHTML = recipe.ingredients.map((i) => `
    <li><span>${i.name}</span><strong>${formatAmount((i.amount / 2) * state.servings)} ${i.unit}</strong></li>`).join("");
  recipeViewerSteps.innerHTML = buildRecipeSteps(recipe).map((s) => `<li>${s}</li>`).join("");
};

const renderSummary = () => {
  servingsValue.textContent = String(state.servings);
  servingsNote.textContent = `База рецептов рассчитана на 2 персоны. Сейчас показан пересчёт на ${state.servings}.`;
  selectedCount.textContent = String(state.plannedRecipeIds.length);
  if (catalogRefreshNote) {
    catalogRefreshNote.textContent = `Каталог обновляется каждый понедельник в 06:00 по Москве. Следующее: ${getNextRecipeRefreshLabel()}.`;
  }
};

const render = () => {
  syncFilterControls();
  renderSummary();
  renderRecipes();
  renderWeeklyPlan();
  renderShoppingList();
  renderRecipeViewer();
};

// ---------- Экспорт списка ----------

const exportByCategories = () => {
  const items = buildShoppingItems();
  if (!items.length) return;
  const groups = groupByCategory(items);
  const text = `Список покупок на ${state.servings} персон:\n\n` +
    groups.map((g) =>
      `${g.label}:\n` + g.items.map((i) => `• ${i.name} — ${formatAmount(i.amount)} ${i.unit}`).join("\n")
    ).join("\n\n");
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("export-categories-btn");
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.textContent = "Скопировано!";
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });
};

const exportToTelegram = () => {
  const items = buildShoppingItems();
  if (!items.length) return;
  const groups = groupByCategory(items);
  const text = `Список покупок на ${state.servings} персон:\n\n` +
    groups.map((g) =>
      `*${g.label}*\n` + g.items.map((i) => `• ${i.name} — ${formatAmount(i.amount)} ${i.unit}`).join("\n")
    ).join("\n\n");
  window.open("https://t.me/share/url?url=%20&text=" + encodeURIComponent(text), "_blank");
};

const copyShoppingList = exportByCategories;

const openAllInStore = () => {
  const items = buildShoppingItems();
  const unchecked = items.filter((i) => !checkedItems.has(i.key));
  if (!unchecked.length) return;
  unchecked.forEach((item) => {
    window.open(getStoreSearchUrl(item.name), "_blank", "noreferrer");
  });
};

// ---------- События ----------

document.querySelector("#increase-servings").addEventListener("click", () => {
  state.servings = Math.min(8, state.servings + 1); render();
});
document.querySelector("#decrease-servings").addEventListener("click", () => {
  state.servings = Math.max(1, state.servings - 1); render();
});

ingredientFilter.addEventListener("input", (e) => { state.filters.ingredient = e.target.value; saveFilters(); renderRecipes(); });
excludeIngredientFilter.addEventListener("input", (e) => { state.filters.excludeIngredient = e.target.value; saveFilters(); renderRecipes(); });
difficultyFilter.addEventListener("change", (e) => { state.filters.difficulty = e.target.value; saveFilters(); renderRecipes(); });
meatFilter.addEventListener("change", (e) => { state.filters.meat = e.target.value; saveFilters(); renderRecipes(); });
timeFilters.forEach((f) => f.addEventListener("change", (e) => { state.filters.time = e.target.value; saveFilters(); renderRecipes(); }));

if (resetFiltersButton) resetFiltersButton.addEventListener("click", resetFilters);
if (copyListBtn) copyListBtn.addEventListener("click", copyShoppingList);

recipesGrid.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  const recipeId = Number(button.dataset.recipeId);
  const recipe = sortedRecipes.find((r) => r.id === recipeId);
  if (!recipe) return;
  if (button.dataset.action === "toggle-plan") {
    if (state.plannedRecipeIds.includes(recipeId) || state.plannedRecipeIds.length >= 7) return;
    state.plannedRecipeIds.push(recipeId); render();
  }
  if (button.dataset.action === "show-ingredients") openRecipeViewer(recipe.id);
});

weeklyPlan.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button || button.dataset.action !== "remove-plan") return;
  state.plannedRecipeIds = state.plannedRecipeIds.filter((id) => id !== Number(button.dataset.recipeId));
  render();
});

shoppingList.addEventListener("click", (e) => {
  // Не перехватываем клики по ссылкам "Найти"
  if (e.target.closest("[data-action=\"find-in-store\"]")) return;

  const storeBtn = e.target.closest("[data-action=\"select-store\"]");
  if (storeBtn) {
    state.selectedStore = storeBtn.dataset.store;
    renderShoppingList();
    return;
  }

  const item = e.target.closest("[data-action=\"toggle-check\"]");
  if (!item) return;
  const key = item.dataset.key;
  if (checkedItems.has(key)) {
    checkedItems.delete(key);
  } else {
    checkedItems.add(key);
  }
  renderShoppingList();
});

if (recipeViewer) {
  recipeViewer.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="close-recipe-viewer"]')) closeRecipeViewer();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.activeRecipeId !== null) closeRecipeViewer();
});

// ---------- Инициализация ----------

const ACTIVE_RECIPES_LS_KEY = "happy-wife-menu-active-recipes-v1";
const SKIPPED_PENDING_LS_KEY = "happy-wife-menu-skipped-pending-v1";

const safeFetchJson = async (url) => {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const readActiveFromLS = () => {
  try {
    const raw = window.localStorage.getItem(ACTIVE_RECIPES_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.recipes)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeActiveToLS = (payload) => {
  try {
    window.localStorage.setItem(ACTIVE_RECIPES_LS_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Can\'t persist active recipes:", err);
  }
};

const readSkippedWeekTag = () => {
  try { return window.localStorage.getItem(SKIPPED_PENDING_LS_KEY); }
  catch { return null; }
};

const writeSkippedWeekTag = (tag) => {
  try { window.localStorage.setItem(SKIPPED_PENDING_LS_KEY, tag); }
  catch {}
};

// --- Модалка ротации ---

const buildRotationModal = (pending, active, plannedOldCount) => new Promise((resolve) => {
  const overlay = document.createElement("div");
  overlay.className = "rotation-modal";
  overlay.style.cssText = [
    "position:fixed", "inset:0", "z-index:9999",
    "background:rgba(24,28,38,0.55)", "display:flex",
    "align-items:center", "justify-content:center", "padding:16px"
  ].join(";");

  const box = document.createElement("div");
  box.style.cssText = [
    "background:#fff", "border-radius:14px", "max-width:480px", "width:100%",
    "padding:28px", "box-shadow:0 20px 60px rgba(0,0,0,0.25)",
    "font-family:inherit", "color:#222"
  ].join(";");

  const planLine = plannedOldCount > 0
    ? `<p style="margin:0 0 16px;color:#555">В твоём плане на неделю <strong>${plannedOldCount}</strong> ${plannedOldCount === 1 ? "рецепт" : "рецептов"} из старой подборки. Что с ним делать?</p>`
    : `<p style="margin:0 0 16px;color:#555">План на неделю пуст, можно безопасно применить новые рецепты.</p>`;

  box.innerHTML = `
    <h3 style="margin:0 0 12px;font-size:22px">Новая подборка рецептов готова</h3>
    <p style="margin:0 0 8px;color:#555">
      Парсер собрал <strong>${pending.counts?.total ?? pending.recipes.length}</strong> свежих рецептов с eda.ru (${pending.weekTag}).
    </p>
    ${planLine}
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:20px">
      <button data-act="skip"  style="padding:10px 16px;border:1px solid #ccc;background:#f5f5f7;border-radius:8px;cursor:pointer">Оставить старую</button>
      ${plannedOldCount > 0 ? '<button data-act="apply-keep" style="padding:10px 16px;border:1px solid #ccc;background:#fff;border-radius:8px;cursor:pointer">Применить, план оставить</button>' : ''}
      <button data-act="apply-clear" style="padding:10px 16px;border:none;background:#e86a3c;color:#fff;border-radius:8px;cursor:pointer;font-weight:600">Применить${plannedOldCount > 0 ? " и очистить план" : ""}</button>
    </div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    overlay.remove();
    resolve(act);
  });
});

// --- Нормализация формата рецепта (на случай старого кэша) ---

const ensureRecipeShape = (r) => ({
  ...r,
  macros: r.macros || { protein: 0, fat: 0, carbs: 0 }
});

// --- Bootstrap ---

const bootstrap = async () => {
  window.localStorage.setItem(RECIPE_CYCLE_STORAGE_KEY, recipeCycleKey);

  const [pendingRaw, activeFromFile] = await Promise.all([
    safeFetchJson("./recipes-pending.json"),
    safeFetchJson("./recipes.json")
  ]);
  const activeFromLS = readActiveFromLS();

  // "Активная" подборка — из localStorage (если пользователь принял ротацию)
  // или из recipes.json (первая установка).
  let active = activeFromLS || activeFromFile;
  if (!active) {
    console.error("recipes.json не найден и localStorage пуст — рендерим пустой интерфейс");
    active = { recipes: [], weekTag: "unknown" };
  }

  // Показать модалку, если есть свежий pending, не совпадающий с active и не пропущенный.
  if (
    pendingRaw &&
    Array.isArray(pendingRaw.recipes) &&
    pendingRaw.weekTag &&
    pendingRaw.weekTag !== active.weekTag &&
    pendingRaw.weekTag !== readSkippedWeekTag()
  ) {
    const plannedInActive = state.plannedRecipeIds.filter(
      (id) => active.recipes.some((r) => r.id === id)
    ).length;
    const choice = await buildRotationModal(pendingRaw, active, plannedInActive);
    if (choice === "apply-clear" || choice === "apply-keep") {
      active = pendingRaw;
      writeActiveToLS({
        weekTag: pendingRaw.weekTag,
        generatedAt: pendingRaw.generatedAt,
        recipes: pendingRaw.recipes
      });
      if (choice === "apply-clear") {
        state.plannedRecipeIds = [];
      } else {
        // оставить только те id, что есть в новой подборке
        state.plannedRecipeIds = state.plannedRecipeIds.filter(
          (id) => pendingRaw.recipes.some((r) => r.id === id)
        );
      }
      // сбросить «пропущено» — пользователь принял
      try { window.localStorage.removeItem(SKIPPED_PENDING_LS_KEY); } catch {}
    } else {
      writeSkippedWeekTag(pendingRaw.weekTag);
    }
  }

  recipes = (active.recipes || []).map(ensureRecipeShape);
  sortedRecipes = sortRecipesByCycle(recipes, recipeCycleKey);

  loadFilters();
  render();
};

bootstrap();
