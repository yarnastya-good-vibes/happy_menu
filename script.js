const STORAGE_KEY = "happy-wife-menu-filters-v2";
const RECIPE_CYCLE_STORAGE_KEY = "happy-wife-menu-recipe-cycle-v1";
const pantryExclusions = [
  "соль", "перец", "подсолнечное масло", "растительное масло", "оливковое масло"
];

const recipes = [
  {
    id: 1,
    title: "Лосось с киноа и зелёной фасолью",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=80",
    time: 25,
    difficulty: "Легко",
    meatCategory: "no-red-meat",
    diet: "pescatarian",
    macros: { protein: 44, fat: 27, carbs: 32 },
    ingredients: [
      { name: "Филе лосося", amount: 360, unit: "г" },
      { name: "Киноа", amount: 140, unit: "г" },
      { name: "Стручковая фасоль", amount: 220, unit: "г" },
      { name: "Лимон", amount: 1, unit: "шт" },
      { name: "Оливковое масло", amount: 2, unit: "ст. л." }
    ]
  },
  {
    id: 2,
    title: "Паста с курицей и вялеными томатами",
    image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80",
    time: 35,
    difficulty: "Средне",
    meatCategory: "no-red-meat",
    diet: "meat",
    macros: { protein: 41, fat: 22, carbs: 58 },
    ingredients: [
      { name: "Куриное филе", amount: 300, unit: "г" },
      { name: "Паста", amount: 180, unit: "г" },
      { name: "Сливки 10%", amount: 180, unit: "мл" },
      { name: "Вяленые томаты", amount: 80, unit: "г" },
      { name: "Шпинат", amount: 70, unit: "г" }
    ]
  },
  {
    id: 3,
    title: "Тыквенное ризотто с пармезаном",
    image: "https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&w=900&q=80",
    time: 45,
    difficulty: "Посложнее",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 18, fat: 17, carbs: 63 },
    ingredients: [
      { name: "Рис арборио", amount: 180, unit: "г" },
      { name: "Тыква", amount: 320, unit: "г" },
      { name: "Пармезан", amount: 60, unit: "г" },
      { name: "Овощной бульон", amount: 700, unit: "мл" },
      { name: "Лук", amount: 1, unit: "шт" }
    ]
  },
  {
    id: 4,
    title: "Гречневая лапша с говядиной и брокколи",
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
    time: 20,
    difficulty: "Легко",
    meatCategory: "red-meat",
    diet: "meat",
    macros: { protein: 36, fat: 19, carbs: 47 },
    ingredients: [
      { name: "Говядина", amount: 280, unit: "г" },
      { name: "Соба", amount: 180, unit: "г" },
      { name: "Брокколи", amount: 240, unit: "г" },
      { name: "Соевый соус", amount: 3, unit: "ст. л." },
      { name: "Кунжут", amount: 1, unit: "ст. л." }
    ]
  },
  {
    id: 5,
    title: "Шакшука с фетой и тостами",
    image: "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=900&q=80",
    time: 30,
    difficulty: "Легко",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 24, fat: 20, carbs: 29 },
    ingredients: [
      { name: "Яйца", amount: 4, unit: "шт" },
      { name: "Томаты в собственном соку", amount: 400, unit: "г" },
      { name: "Фета", amount: 100, unit: "г" },
      { name: "Болгарский перец", amount: 1, unit: "шт" },
      { name: "Хлеб", amount: 4, unit: "ломтика" }
    ]
  },
  {
    id: 6,
    title: "Индейка в кокосовом карри с рисом",
    image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=900&q=80",
    time: 40,
    difficulty: "Средне",
    meatCategory: "no-red-meat",
    diet: "meat",
    macros: { protein: 39, fat: 24, carbs: 55 },
    ingredients: [
      { name: "Филе индейки", amount: 320, unit: "г" },
      { name: "Рис жасмин", amount: 170, unit: "г" },
      { name: "Кокосовое молоко", amount: 240, unit: "мл" },
      { name: "Паста карри", amount: 2, unit: "ст. л." },
      { name: "Морковь", amount: 2, unit: "шт" }
    ]
  },
  {
    id: 7,
    title: "Овощная лазанья с рикоттой",
    image: "https://images.unsplash.com/photo-1619895092538-128341789043?auto=format&fit=crop&w=900&q=80",
    time: 55,
    difficulty: "Посложнее",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 26, fat: 21, carbs: 49 },
    ingredients: [
      { name: "Листы лазаньи", amount: 180, unit: "г" },
      { name: "Рикотта", amount: 250, unit: "г" },
      { name: "Цукини", amount: 2, unit: "шт" },
      { name: "Томатный соус", amount: 350, unit: "мл" },
      { name: "Моцарелла", amount: 150, unit: "г" }
    ]
  },
  {
    id: 8,
    title: "Тёплый салат с креветками и авокадо",
    image: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80",
    time: 18,
    difficulty: "Легко",
    meatCategory: "no-red-meat",
    diet: "pescatarian",
    macros: { protein: 29, fat: 21, carbs: 18 },
    ingredients: [
      { name: "Креветки", amount: 260, unit: "г" },
      { name: "Авокадо", amount: 1, unit: "шт" },
      { name: "Микс салата", amount: 120, unit: "г" },
      { name: "Черри", amount: 160, unit: "г" },
      { name: "Лайм", amount: 1, unit: "шт" }
    ]
  },
  {
    id: 9,
    title: "Нутовые котлеты с йогуртовым соусом",
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    time: 35,
    difficulty: "Средне",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 22, fat: 14, carbs: 41 },
    ingredients: [
      { name: "Нут", amount: 240, unit: "г" },
      { name: "Лук", amount: 1, unit: "шт" },
      { name: "Йогурт", amount: 140, unit: "г" },
      { name: "Огурец", amount: 1, unit: "шт" },
      { name: "Чеснок", amount: 2, unit: "зубчика" }
    ]
  },
  {
    id: 10,
    title: "Удон с тофу и шиитаке",
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
    time: 25,
    difficulty: "Легко",
    meatCategory: "vegetarian",
    diet: "vegan",
    macros: { protein: 21, fat: 15, carbs: 54 },
    ingredients: [
      { name: "Тофу", amount: 240, unit: "г" },
      { name: "Удон", amount: 220, unit: "г" },
      { name: "Шиитаке", amount: 160, unit: "г" },
      { name: "Соевый соус", amount: 3, unit: "ст. л." },
      { name: "Зелёный лук", amount: 1, unit: "пучок" }
    ]
  },
  {
    id: 11,
    title: "Куриные тефтели с булгуром",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    time: 38,
    difficulty: "Средне",
    meatCategory: "no-red-meat",
    diet: "meat",
    macros: { protein: 37, fat: 16, carbs: 43 },
    ingredients: [
      { name: "Куриный фарш", amount: 320, unit: "г" },
      { name: "Булгур", amount: 170, unit: "г" },
      { name: "Томатный соус", amount: 280, unit: "мл" },
      { name: "Лук", amount: 1, unit: "шт" },
      { name: "Петрушка", amount: 1, unit: "пучок" }
    ]
  },
  {
    id: 12,
    title: "Стейк с бататом и салатом",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
    time: 32,
    difficulty: "Средне",
    meatCategory: "red-meat",
    diet: "meat",
    macros: { protein: 42, fat: 24, carbs: 34 },
    ingredients: [
      { name: "Говяжий стейк", amount: 320, unit: "г" },
      { name: "Батат", amount: 360, unit: "г" },
      { name: "Микс салата", amount: 100, unit: "г" },
      { name: "Черри", amount: 150, unit: "г" },
      { name: "Оливковое масло", amount: 2, unit: "ст. л." }
    ]
  },
  {
    id: 13,
    title: "Ленивое карри из чечевицы",
    image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=900&q=80",
    time: 28,
    difficulty: "Легко",
    meatCategory: "vegetarian",
    diet: "vegan",
    macros: { protein: 19, fat: 11, carbs: 46 },
    ingredients: [
      { name: "Чечевица", amount: 220, unit: "г" },
      { name: "Кокосовое молоко", amount: 240, unit: "мл" },
      { name: "Томаты в собственном соку", amount: 300, unit: "г" },
      { name: "Шпинат", amount: 80, unit: "г" },
      { name: "Паста карри", amount: 1, unit: "ст. л." }
    ]
  },
  {
    id: 14,
    title: "Треска с картофелем и горошком",
    image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80",
    time: 27,
    difficulty: "Легко",
    meatCategory: "no-red-meat",
    diet: "pescatarian",
    macros: { protein: 35, fat: 12, carbs: 33 },
    ingredients: [
      { name: "Филе трески", amount: 340, unit: "г" },
      { name: "Картофель", amount: 360, unit: "г" },
      { name: "Зелёный горошек", amount: 160, unit: "г" },
      { name: "Лимон", amount: 1, unit: "шт" },
      { name: "Укроп", amount: 1, unit: "пучок" }
    ]
  },
  {
    id: 15,
    title: "Грибной орзо со шпинатом",
    image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=900&q=80",
    time: 30,
    difficulty: "Средне",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 17, fat: 15, carbs: 52 },
    ingredients: [
      { name: "Орзо", amount: 180, unit: "г" },
      { name: "Шампиньоны", amount: 260, unit: "г" },
      { name: "Шпинат", amount: 80, unit: "г" },
      { name: "Пармезан", amount: 50, unit: "г" },
      { name: "Лук", amount: 1, unit: "шт" }
    ]
  },
  {
    id: 16,
    title: "Свинина терияки с рисом",
    image: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=900&q=80",
    time: 34,
    difficulty: "Средне",
    meatCategory: "red-meat",
    diet: "meat",
    macros: { protein: 38, fat: 22, carbs: 48 },
    ingredients: [
      { name: "Свинина", amount: 320, unit: "г" },
      { name: "Рис жасмин", amount: 180, unit: "г" },
      { name: "Болгарский перец", amount: 1, unit: "шт" },
      { name: "Соус терияки", amount: 4, unit: "ст. л." },
      { name: "Кунжут", amount: 1, unit: "ст. л." }
    ]
  },
  {
    id: 17,
    title: "Тако с фасолью и кукурузой",
    image: "https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=900&q=80",
    time: 22,
    difficulty: "Легко",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 18, fat: 13, carbs: 49 },
    ingredients: [
      { name: "Красная фасоль", amount: 220, unit: "г" },
      { name: "Кукуруза", amount: 160, unit: "г" },
      { name: "Тортильи", amount: 6, unit: "шт" },
      { name: "Авокадо", amount: 1, unit: "шт" },
      { name: "Лайм", amount: 1, unit: "шт" }
    ]
  },
  {
    id: 18,
    title: "Паэлья с морепродуктами",
    image: "https://images.unsplash.com/photo-1534080564583-6be75777b70a?auto=format&fit=crop&w=900&q=80",
    time: 42,
    difficulty: "Посложнее",
    meatCategory: "no-red-meat",
    diet: "pescatarian",
    macros: { protein: 33, fat: 13, carbs: 51 },
    ingredients: [
      { name: "Рис арборио", amount: 180, unit: "г" },
      { name: "Морепродукты", amount: 320, unit: "г" },
      { name: "Черри", amount: 180, unit: "г" },
      { name: "Болгарский перец", amount: 1, unit: "шт" },
      { name: "Чеснок", amount: 2, unit: "зубчика" }
    ]
  },
  {
    id: 19,
    title: "Запечённая цветная капуста с тахини",
    image: "https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&w=900&q=80",
    time: 26,
    difficulty: "Легко",
    meatCategory: "vegetarian",
    diet: "vegan",
    macros: { protein: 12, fat: 16, carbs: 28 },
    ingredients: [
      { name: "Цветная капуста", amount: 1, unit: "кочан" },
      { name: "Тахини", amount: 3, unit: "ст. л." },
      { name: "Нут", amount: 180, unit: "г" },
      { name: "Лимон", amount: 1, unit: "шт" },
      { name: "Петрушка", amount: 1, unit: "пучок" }
    ]
  },
  {
    id: 20,
    title: "Курица в медово-горчичном соусе",
    image: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=900&q=80",
    time: 33,
    difficulty: "Легко",
    meatCategory: "no-red-meat",
    diet: "meat",
    macros: { protein: 40, fat: 17, carbs: 26 },
    ingredients: [
      { name: "Куриное филе", amount: 320, unit: "г" },
      { name: "Картофель", amount: 340, unit: "г" },
      { name: "Брокколи", amount: 220, unit: "г" },
      { name: "Мёд", amount: 1, unit: "ст. л." },
      { name: "Горчица", amount: 1, unit: "ст. л." }
    ]
  },
  {
    id: 21,
    title: "Рамен с яйцом и кукурузой",
    image: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?auto=format&fit=crop&w=900&q=80",
    time: 24,
    difficulty: "Средне",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 20, fat: 14, carbs: 48 },
    ingredients: [
      { name: "Лапша рамен", amount: 200, unit: "г" },
      { name: "Яйца", amount: 4, unit: "шт" },
      { name: "Кукуруза", amount: 120, unit: "г" },
      { name: "Зелёный лук", amount: 1, unit: "пучок" },
      { name: "Соевый соус", amount: 2, unit: "ст. л." }
    ]
  },
  {
    id: 22,
    title: "Фаршированные перцы с говядиной",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
    time: 50,
    difficulty: "Посложнее",
    meatCategory: "red-meat",
    diet: "meat",
    macros: { protein: 34, fat: 18, carbs: 31 },
    ingredients: [
      { name: "Говяжий фарш", amount: 300, unit: "г" },
      { name: "Болгарский перец", amount: 4, unit: "шт" },
      { name: "Рис арборио", amount: 120, unit: "г" },
      { name: "Томатный соус", amount: 250, unit: "мл" },
      { name: "Лук", amount: 1, unit: "шт" }
    ]
  },
  {
    id: 23,
    title: "Соба с лососем и эдамаме",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=80",
    time: 21,
    difficulty: "Легко",
    meatCategory: "no-red-meat",
    diet: "pescatarian",
    macros: { protein: 34, fat: 19, carbs: 39 },
    ingredients: [
      { name: "Филе лосося", amount: 300, unit: "г" },
      { name: "Соба", amount: 180, unit: "г" },
      { name: "Эдамаме", amount: 160, unit: "г" },
      { name: "Огурец", amount: 1, unit: "шт" },
      { name: "Соевый соус", amount: 2, unit: "ст. л." }
    ]
  },
  {
    id: 24,
    title: "Крем-паста с брокколи и горошком",
    image: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80",
    time: 23,
    difficulty: "Легко",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 16, fat: 14, carbs: 53 },
    ingredients: [
      { name: "Паста", amount: 180, unit: "г" },
      { name: "Брокколи", amount: 220, unit: "г" },
      { name: "Зелёный горошек", amount: 150, unit: "г" },
      { name: "Сливки 10%", amount: 160, unit: "мл" },
      { name: "Пармезан", amount: 40, unit: "г" }
    ]
  },
  {
    id: 25,
    title: "Бургер боул с индейкой",
    image: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=900&q=80",
    time: 29,
    difficulty: "Легко",
    meatCategory: "no-red-meat",
    diet: "meat",
    macros: { protein: 35, fat: 18, carbs: 24 },
    ingredients: [
      { name: "Филе индейки", amount: 300, unit: "г" },
      { name: "Микс салата", amount: 120, unit: "г" },
      { name: "Черри", amount: 160, unit: "г" },
      { name: "Огурец", amount: 1, unit: "шт" },
      { name: "Авокадо", amount: 1, unit: "шт" }
    ]
  },
  {
    id: 26,
    title: "Веганский чили с фасолью",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    time: 36,
    difficulty: "Средне",
    meatCategory: "vegetarian",
    diet: "vegan",
    macros: { protein: 20, fat: 9, carbs: 44 },
    ingredients: [
      { name: "Красная фасоль", amount: 240, unit: "г" },
      { name: "Томаты в собственном соку", amount: 350, unit: "г" },
      { name: "Кукуруза", amount: 160, unit: "г" },
      { name: "Лук", amount: 1, unit: "шт" },
      { name: "Болгарский перец", amount: 1, unit: "шт" }
    ]
  },
  {
    id: 27,
    title: "Кускус с халуми и овощами",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    time: 19,
    difficulty: "Легко",
    meatCategory: "vegetarian",
    diet: "vegetarian",
    macros: { protein: 19, fat: 18, carbs: 42 },
    ingredients: [
      { name: "Кускус", amount: 170, unit: "г" },
      { name: "Халуми", amount: 180, unit: "г" },
      { name: "Цукини", amount: 1, unit: "шт" },
      { name: "Черри", amount: 160, unit: "г" },
      { name: "Лимон", amount: 1, unit: "шт" }
    ]
  },
  {
    id: 28,
    title: "Том ям с креветками",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
    time: 31,
    difficulty: "Посложнее",
    meatCategory: "no-red-meat",
    diet: "pescatarian",
    macros: { protein: 28, fat: 16, carbs: 17 },
    ingredients: [
      { name: "Креветки", amount: 260, unit: "г" },
      { name: "Кокосовое молоко", amount: 200, unit: "мл" },
      { name: "Шампиньоны", amount: 160, unit: "г" },
      { name: "Лайм", amount: 1, unit: "шт" },
      { name: "Чеснок", amount: 2, unit: "зубчика" }
    ]
  },
  {
    id: 29,
    title: "Перловка с грибами и тимьяном",
    image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=900&q=80",
    time: 44,
    difficulty: "Средне",
    meatCategory: "vegetarian",
    diet: "vegan",
    macros: { protein: 14, fat: 8, carbs: 50 },
    ingredients: [
      { name: "Перловка", amount: 180, unit: "г" },
      { name: "Шампиньоны", amount: 260, unit: "г" },
      { name: "Лук", amount: 1, unit: "шт" },
      { name: "Чеснок", amount: 2, unit: "зубчика" },
      { name: "Петрушка", amount: 1, unit: "пучок" }
    ]
  },
  {
    id: 30,
    title: "Кесадилья с курицей и сыром",
    image: "https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=900&q=80",
    time: 18,
    difficulty: "Легко",
    meatCategory: "no-red-meat",
    diet: "meat",
    macros: { protein: 31, fat: 20, carbs: 35 },
    ingredients: [
      { name: "Куриное филе", amount: 260, unit: "г" },
      { name: "Тортильи", amount: 4, unit: "шт" },
      { name: "Сыр", amount: 140, unit: "г" },
      { name: "Кукуруза", amount: 120, unit: "г" },
      { name: "Болгарский перец", amount: 1, unit: "шт" }
    ]
  }
];
;

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
const sortedRecipes = sortRecipesByCycle(recipes, recipeCycleKey);

const weekDays = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

const defaultFilters = { ingredient: "", excludeIngredient: "", difficulty: "all", time: "all", meat: "all" };

const state = {
  servings: 2,
  plannedRecipeIds: [],
  filters: { ...defaultFilters },
  activeRecipeId: null
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

const renderRecipes = () => {
  const list = sortedRecipes.filter(matchesFilters);
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

const CATEGORIES = [
  { id: "meat",    label: "Мясо и рыба",      keys: ["говяд", "свинин", "курин", "индейк", "фарш", "стейк", "лосос", "треск", "креветк", "морепродукт", "тунец", "сёмга", "рыб"] },
  { id: "dairy",   label: "Молочное и яйца",   keys: ["яйц", "сливк", "молок", "сыр", "фет", "рикотт", "моцарелл", "пармезан", "йогурт", "халум", "творог"] },
  { id: "veggie",  label: "Овощи и зелень",    keys: ["лук", "чеснок", "морков", "томат", "черри", "перец", "брокколи", "шпинат", "цукин", "капуст", "батат", "картофел", "баклажан", "авокадо", "огурец", "петрушк", "укроп", "базилик", "зелён", "салат", "тыкв"] },
  { id: "fruit",   label: "Фрукты и ягоды",    keys: ["лимон", "лайм", "яблок", "апельсин", "банан", "ягод"] },
  { id: "grain",   label: "Крупы и паста",     keys: ["рис", "паста", "спагетт", "пенне", "орзо", "булгур", "киноа", "гречк", "перловк", "соба", "удон", "лапш", "рамен", "тортильи", "хлеб", "кускус", "листы лазань"] },
  { id: "canned",  label: "Консервы и соусы",  keys: ["томат в", "томатн", "кокосов", "соевый", "терияк", "карри", "бульон", "вяленые", "красная фасол", "нут", "чечевиц", "фасол", "кукуруз"] },
  { id: "other",   label: "Остальное",         keys: [] }
];

const getCategory = (name) => {
  const n = name.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keys.some((k) => n.includes(k))) return cat.id;
  }
  return "other";
};

const buildShoppingItems = () => {
  const multiplier = state.servings / 2;
  const basket = new Map();
  state.plannedRecipeIds.forEach((recipeId) => {
    const recipe = sortedRecipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    recipe.ingredients.forEach((ingredient) => {
      if (isPantryStaple(ingredient.name)) return;
      const key = `${ingredient.name}-${ingredient.unit}`;
      const prev = basket.get(key) || {
        name: ingredient.name,
        unit: ingredient.unit,
        amount: 0,
        category: getCategory(ingredient.name)
      };
      prev.amount += ingredient.amount * multiplier;
      basket.set(key, prev);
    });
  });
  return Array.from(basket.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
};

const groupByCategory = (items) => {
  const groups = [];
  for (const cat of CATEGORIES) {
    const catItems = items.filter((i) => i.category === cat.id);
    if (catItems.length) groups.push({ ...cat, items: catItems });
  }
  return groups;
};

// Хранилище отмеченных позиций (ключ = название-единица)
const checkedItems = new Set();

const renderShoppingItem = (item) => {
  const key = `${item.name}-${item.unit}`;
  const checked = checkedItems.has(key);
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
  shoppingList.innerHTML = groups.map((group) => `
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

loadFilters();
window.localStorage.setItem(RECIPE_CYCLE_STORAGE_KEY, recipeCycleKey);
render();
