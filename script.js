const STORAGE_KEY = "happy-wife-menu-filters-v2";
const RECIPE_CYCLE_STORAGE_KEY = "happy-wife-menu-recipe-cycle-v1";
const pantryExclusions = [
  "соль",
  "перец",
  "подсолнечное масло",
  "растительное масло",
  "оливковое масло"
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

const getMoscowDateParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
};

const getMoscowWeekday = (date = new Date()) => {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    weekday: "short"
  }).format(date);

  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
};

const getCurrentRecipeCycleKey = () => {
  const now = new Date();
  const parts = getMoscowDateParts(now);
  const weekday = getMoscowWeekday(now);
  const daysSinceMonday = (weekday + 6) % 7;

  const cycleStart = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day - daysSinceMonday, 3, 0, 0)
  );

  if (weekday === 1 && parts.hour < 6) {
    cycleStart.setUTCDate(cycleStart.getUTCDate() - 7);
  }

  return cycleStart.toISOString().slice(0, 10);
};

const seededHash = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const sortRecipesByCycle = (allRecipes, cycleKey) =>
  [...allRecipes].sort((left, right) => {
    const leftWeight = seededHash(`${cycleKey}-${left.id}`);
    const rightWeight = seededHash(`${cycleKey}-${right.id}`);
    return leftWeight - rightWeight;
  });

const getNextRecipeRefreshLabel = () => {
  const now = new Date();
  const parts = getMoscowDateParts(now);
  const weekday = getMoscowWeekday(now);
  const daysUntilMonday = weekday === 1 && parts.hour < 6 ? 0 : (8 - weekday) % 7 || 7;
  const nextRefresh = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + daysUntilMonday, 3, 0, 0)
  );

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });

  return formatter.format(nextRefresh);
};

const recipeCycleKey = getCurrentRecipeCycleKey();
const sortedRecipes = sortRecipesByCycle(recipes, recipeCycleKey);

const weekDays = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье"
];

const defaultFilters = {
  ingredient: "",
  excludeIngredient: "",
  difficulty: "all",
  time: "all",
  meat: "all"
};

const state = {
  servings: 2,
  plannedRecipeIds: [],
  filters: { ...defaultFilters },
  activeRecipeId: null,
  isBasketConfirmationOpen: false,
  confirmationBasket: [],
  confirmationSignature: "",
  transferSummary: null
};

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
const basketConfirmation = document.querySelector("#basket-confirmation");
const basketConfirmationCaption = document.querySelector("#basket-confirmation-caption");
const basketConfirmationSummary = document.querySelector("#basket-confirmation-summary");
const basketConfirmationList = document.querySelector("#basket-confirmation-list");
const basketConfirmationResult = document.querySelector("#basket-confirmation-result");
const basketTransferNote = document.querySelector("#basket-transfer-note");
const openBasketConfirmationButton = document.querySelector("#open-basket-confirmation");
const confirmBasketButton = document.querySelector("#confirm-basket-button");
const storeConnector = window.HappyWifeStoreConnector;
const basketMatcher = window.HappyWifeBasketMatcher;

const parseIngredientTokens = (value) =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const getRecipeIngredientNames = (recipe) =>
  recipe.ingredients.map((ingredient) => ingredient.name.toLowerCase());

const isPantryStaple = (ingredientName) => {
  const normalized = ingredientName.toLowerCase();
  return pantryExclusions.some((item) => normalized.includes(item));
};

const buildRecipeSteps = (recipe) => {
  const [first, second, third, fourth] = recipe.ingredients;
  return [
    `Шаг 1. Подготовьте продукты: нарежьте ${first.name.toLowerCase()} и ${second.name.toLowerCase()}, разогрейте рабочую поверхность и отмерьте остальные ингредиенты.`,
    `Шаг 2. Начните основу блюда: приготовьте ${second.name.toLowerCase()} или другую базу рецепта, параллельно обжарьте или запеките ${first.name.toLowerCase()} до полуготовности.`,
    `Шаг 3. Добавьте ${third.name.toLowerCase()} и ${fourth.name.toLowerCase()}, доведите блюдо до вкуса специями и готовьте ещё несколько минут до нужной текстуры.`,
    `Шаг 4. Подавайте сразу: проверьте соль, разложите по тарелкам и завершите блюдо свежими акцентами или соусом из формы.`
  ];
};

const loadFilters = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.filters = {
      ingredient: typeof parsed.ingredient === "string" ? parsed.ingredient : "",
      excludeIngredient:
        typeof parsed.excludeIngredient === "string" ? parsed.excludeIngredient : "",
      difficulty: parsed.difficulty || "all",
      time: parsed.time || "all",
      meat: parsed.meat || "all"
    };
  } catch {
    state.filters = { ...defaultFilters };
  }
};

const saveFilters = () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.filters));
};

const resetFilters = () => {
  state.filters = { ...defaultFilters };
  saveFilters();
  render();
};

const formatAmount = (amount) => {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const getTimeLabel = (minutes) => {
  if (minutes <= 20) return "до 20 мин";
  if (minutes <= 40) return "20-40 мин";
  return "более 40 мин";
};

const syncFilterControls = () => {
  ingredientFilter.value = state.filters.ingredient;
  excludeIngredientFilter.value = state.filters.excludeIngredient;
  difficultyFilter.value = state.filters.difficulty;
  meatFilter.value = state.filters.meat;
  timeFilters.forEach((filter) => {
    filter.checked = filter.value === state.filters.time;
  });
};

const matchesFilters = (recipe) => {
  const ingredientNames = getRecipeIngredientNames(recipe);
  const includeTokens = parseIngredientTokens(state.filters.ingredient);
  const excludeTokens = parseIngredientTokens(state.filters.excludeIngredient);

  const includeMatch =
    includeTokens.length === 0 ||
    includeTokens.every((token) =>
      ingredientNames.some((ingredientName) => ingredientName.includes(token))
    );

  const excludeMatch =
    excludeTokens.length === 0 ||
    excludeTokens.every(
      (token) => !ingredientNames.some((ingredientName) => ingredientName.includes(token))
    );

  const difficultyMatch =
    state.filters.difficulty === "all" || recipe.difficulty === state.filters.difficulty;

  const timeMatch =
    state.filters.time === "all" ||
    (state.filters.time === "20" && recipe.time <= 20) ||
    (state.filters.time === "20-40" && recipe.time > 20 && recipe.time <= 40) ||
    (state.filters.time === "40+" && recipe.time > 40);

  const meatMatch =
    state.filters.meat === "all" ||
    (state.filters.meat === "no-red-meat" && recipe.meatCategory !== "red-meat") ||
    (state.filters.meat === "vegetarian" && recipe.diet === "vegetarian") ||
    (state.filters.meat === "vegan" && recipe.diet === "vegan");

  return includeMatch && excludeMatch && difficultyMatch && timeMatch && meatMatch && !state.plannedRecipeIds.includes(recipe.id);
};

const getScaledMacro = (value) => Math.round((value / 2) * state.servings);
const getConfirmationSignature = () => `${state.servings}|${state.plannedRecipeIds.join(",")}`;
const getStatusLabel = (status) =>
  ({
    found: "Найден",
    "needs-confirmation": "Нужно подтвердить",
    "not-found": "Не найден",
    excluded: "Исключён"
  })[status] || "Не найден";

const syncBodyScrollLock = () => {
  document.body.style.overflow =
    state.activeRecipeId !== null || state.isBasketConfirmationOpen ? "hidden" : "";
};

const openRecipeViewer = (recipeId) => {
  state.activeRecipeId = recipeId;
  renderRecipeViewer();
};

const closeRecipeViewer = () => {
  state.activeRecipeId = null;
  renderRecipeViewer();
};

const ensureConfirmationBasket = (force = false) => {
  if (!storeConnector || !basketMatcher) return;

  const nextSignature = getConfirmationSignature();
  if (!force && state.confirmationSignature === nextSignature && state.confirmationBasket.length > 0) {
    return;
  }

  state.confirmationBasket = basketMatcher.buildConfirmableBasket({
    plannedRecipeIds: state.plannedRecipeIds,
    recipes: sortedRecipes,
    servings: state.servings,
    pantryExclusions,
    connector: storeConnector
  });
  state.confirmationSignature = nextSignature;
};

const openBasketConfirmation = () => {
  ensureConfirmationBasket();
  state.isBasketConfirmationOpen = true;
  renderBasketConfirmation();
};

const closeBasketConfirmation = () => {
  state.isBasketConfirmationOpen = false;
  renderBasketConfirmation();
};

const renderRecipes = () => {
  const filteredRecipeList = sortedRecipes.filter(matchesFilters);

  if (filteredRecipeList.length === 0) {
    recipesGrid.innerHTML = `
      <div class="empty-state">
        По текущим фильтрам сейчас ничего не подходит. Попробуйте убрать часть условий или вернуть рецепт из недельного меню.
      </div>
    `;
    return;
  }

  recipesGrid.innerHTML = filteredRecipeList
    .map(
      (recipe, index) => `
        <article class="recipe-card" style="animation-delay: ${index * 50}ms">
          <div class="recipe-card__image">
            <img src="${recipe.image}" alt="${recipe.title}" />
            <span class="recipe-card__badge">${getTimeLabel(recipe.time)}</span>
          </div>
          <div class="recipe-card__body">
            <h3 class="recipe-card__title">${recipe.title}</h3>

            <div class="recipe-card__meta">
              <div class="meta-pill">
                <strong>Время</strong>
                <span>${recipe.time} минут</span>
              </div>
              <div class="meta-pill">
                <strong>Сложность</strong>
                <span>${recipe.difficulty}</span>
              </div>
            </div>

            <div class="recipe-card__macros">
              <div class="macro-pill">
                <strong>Белки</strong>
                <span>${getScaledMacro(recipe.macros.protein)} г</span>
              </div>
              <div class="macro-pill">
                <strong>Жиры</strong>
                <span>${getScaledMacro(recipe.macros.fat)} г</span>
              </div>
              <div class="macro-pill">
                <strong>Углеводы</strong>
                <span>${getScaledMacro(recipe.macros.carbs)} г</span>
              </div>
            </div>

            <ul class="recipe-card__ingredients">
              ${recipe.ingredients.map((ingredient) => `<li>${ingredient.name}</li>`).join("")}
            </ul>

            <div class="recipe-card__actions">
              <button
                class="add-button"
                type="button"
                data-action="toggle-plan"
                data-recipe-id="${recipe.id}"
                ${state.plannedRecipeIds.length >= 7 ? "disabled" : ""}
              >
                Добавить в меню
              </button>
              <button
                class="ghost-button"
                type="button"
                data-action="show-ingredients"
                data-recipe-id="${recipe.id}"
              >
                Рецепт
              </button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
};

const renderWeeklyPlan = () => {
  weeklyPlan.innerHTML = weekDays
    .map((day, index) => {
      const recipeId = state.plannedRecipeIds[index];
      const recipe = sortedRecipes.find((item) => item.id === recipeId);

      if (!recipe) {
        return `
          <div class="day-card">
            <div class="day-card__index">${index + 1}</div>
            <div>
              <p class="day-card__title">${day}</p>
              <p class="day-card__note">Свободный вечер. Выберите рецепт из каталога.</p>
            </div>
          </div>
        `;
      }

      return `
        <div class="day-card">
          <div class="day-card__index">${index + 1}</div>
          <div>
            <p class="day-card__title">${day}</p>
            <p class="day-card__note">${recipe.title} • ${recipe.time} мин • ${recipe.difficulty}</p>
          </div>
          <button type="button" data-action="remove-plan" data-recipe-id="${recipe.id}">
            Убрать
          </button>
        </div>
      `;
    })
    .join("");
};

const buildShoppingItems = () => {
  const multiplier = state.servings / 2;
  const basket = new Map();

  state.plannedRecipeIds.forEach((recipeId) => {
    const recipe = sortedRecipes.find((item) => item.id === recipeId);
    if (!recipe) return;

    recipe.ingredients.forEach((ingredient) => {
      if (isPantryStaple(ingredient.name)) return;

      const key = `${ingredient.name}-${ingredient.unit}`;
      const previous = basket.get(key) || {
        name: ingredient.name,
        unit: ingredient.unit,
        amount: 0
      };
      previous.amount += ingredient.amount * multiplier;
      basket.set(key, previous);
    });
  });

  return Array.from(basket.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
};

const renderShoppingList = () => {
  const items = buildShoppingItems();
  cartCount.textContent = String(items.length);

  if (items.length === 0) {
    shoppingList.innerHTML = `
      <div class="empty-state">
        Корзина появится после выбора рецептов. Базовые ингредиенты вроде соли, перца и масла мы сюда не добавляем.
      </div>
    `;
    return;
  }

  shoppingList.innerHTML = items
    .map(
      (item) => `
        <div class="shopping-item">
          <div class="shopping-item__meta">
            <div>
              <strong>${item.name}</strong>
              <span>На ${state.servings} персон</span>
            </div>
          </div>
          <div class="shopping-item__actions">
            <strong>${formatAmount(item.amount)} ${item.unit}</strong>
          </div>
        </div>
      `
    )
    .join("");
};

const renderRecipeViewer = () => {
  if (!recipeViewer) return;

  const recipe = sortedRecipes.find((item) => item.id === state.activeRecipeId);

  if (!recipe) {
    recipeViewer.hidden = true;
    syncBodyScrollLock();
    return;
  }

  recipeViewer.hidden = false;
  syncBodyScrollLock();

  recipeViewerImage.src = recipe.image;
  recipeViewerImage.alt = recipe.title;
  recipeViewerTitle.textContent = recipe.title;
  recipeViewerTime.textContent = `${recipe.time} минут`;
  recipeViewerDifficulty.textContent = recipe.difficulty;
  recipeViewerServings.textContent = `${state.servings}`;

  recipeViewerMacros.innerHTML = `
    <div class="macro-pill">
      <strong>Белки</strong>
      <span>${getScaledMacro(recipe.macros.protein)} г</span>
    </div>
    <div class="macro-pill">
      <strong>Жиры</strong>
      <span>${getScaledMacro(recipe.macros.fat)} г</span>
    </div>
    <div class="macro-pill">
      <strong>Углеводы</strong>
      <span>${getScaledMacro(recipe.macros.carbs)} г</span>
    </div>
  `;

  recipeViewerIngredients.innerHTML = recipe.ingredients
    .map(
      (ingredient) => `
        <li>
          <span>${ingredient.name}</span>
          <strong>${formatAmount((ingredient.amount / 2) * state.servings)} ${ingredient.unit}</strong>
        </li>
      `
    )
    .join("");

  recipeViewerSteps.innerHTML = buildRecipeSteps(recipe)
    .map((step) => `<li>${step}</li>`)
    .join("");
};

const renderBasketConfirmation = () => {
  if (!basketConfirmation || !basketConfirmationList || !confirmBasketButton) return;

  basketConfirmation.hidden = !state.isBasketConfirmationOpen;
  syncBodyScrollLock();

  if (!state.isBasketConfirmationOpen) {
    return;
  }

  ensureConfirmationBasket();

  const confirmedItems = state.confirmationBasket.filter((item) => item.selectedProductId);
  const needsAttention = state.confirmationBasket.filter(
    (item) => item.status === "needs-confirmation" || item.status === "not-found"
  );

  basketConfirmationCaption.textContent =
    state.confirmationBasket.length === 0
      ? "Сначала выберите блюда на неделю. Затем здесь появится список ингредиентов и кандидатов товаров."
      : `Магазин: ${storeConnector.name}. Проверьте найденные товары, подтвердите нужные варианты и затем откройте подтверждённый список.`;

  basketConfirmationSummary.innerHTML = `
    <span class="basket-summary-pill">Ингредиентов: ${state.confirmationBasket.length}</span>
    <span class="basket-summary-pill">Подтверждено: ${confirmedItems.length}</span>
    <span class="basket-summary-pill">Требует внимания: ${needsAttention.length}</span>
  `;

  if (state.confirmationBasket.length === 0) {
    basketConfirmationList.innerHTML = `
      <div class="empty-state">
        Добавьте хотя бы один рецепт в недельное меню, чтобы перейти к подтверждаемой корзине.
      </div>
    `;
  } else {
    basketConfirmationList.innerHTML = state.confirmationBasket
      .map(
        (item) => `
          <article class="basket-item-card">
            <div>
              <div class="basket-item-card__head">
                <h3 class="basket-item-card__title">${item.ingredientName}</h3>
                <span class="basket-status basket-status--${item.status}">${getStatusLabel(item.status)}</span>
              </div>
              <p class="basket-item-card__amount">${formatAmount(item.amount)} ${item.unit}</p>
              <p class="basket-item-card__recipes">
                Из рецептов: ${item.recipes.join(", ")}
              </p>
            </div>

            <div class="basket-item-card__product">
                      ${
                item.selectedProductId
                  ? `
                    <div class="basket-product">
                      <div class="basket-product__image">
                        <img src="${item.selectedProductImage}" alt="${item.selectedProductTitle}" />
                      </div>
                      <div class="basket-product__meta">
                        <strong>${item.selectedProductTitle}</strong>
                        <span>${item.selectedProductPrice || "Цена уточняется"}</span>
                        <a href="${item.selectedProductUrl}" target="_blank" rel="noreferrer">Открыть товар</a>
                      </div>
                    </div>
                  `
                  : `
                    <div class="basket-empty-product">
                      ${
                        item.candidates.length > 0
                          ? "Есть несколько подходящих вариантов. Выберите нужный товар ниже."
                          : "Подходящий товар пока не найден. Эту позицию можно пропустить и вернуться к ней позже."
                      }
                    </div>
                  `
              }

              ${
                item.candidates.length > 0
                  ? `
                    <details>
                      <summary>${item.selectedProductId ? "Выбрать или заменить товар" : "Выбрать товар"}</summary>
                      <div class="basket-options">
                        <label class="basket-option">
                          <input
                            type="radio"
                            name="basket-item-${item.id}"
                            value=""
                            data-action="select-basket-product"
                            data-item-id="${item.id}"
                            ${item.selectedProductId ? "" : "checked"}
                          />
                          <span class="basket-option__image"></span>
                          <div class="basket-option__meta">
                            <strong>Не выбирать сейчас</strong>
                            <span>Позиция останется в статусе подтверждения</span>
                          </div>
                        </label>

                        ${item.candidates
                          .map(
                            (candidate) => `
                              <label class="basket-option">
                                <input
                                  type="radio"
                                  name="basket-item-${item.id}"
                                  value="${candidate.id}"
                                  data-action="select-basket-product"
                                  data-item-id="${item.id}"
                                  ${item.selectedProductId === candidate.id ? "checked" : ""}
                                />
                                <div class="basket-option__image">
                                  <img src="${candidate.image}" alt="${candidate.title}" />
                                </div>
                                <div class="basket-option__meta">
                                  <strong>${candidate.title}</strong>
                                  <span>${candidate.price}</span>
                                  <a href="${candidate.url}" target="_blank" rel="noreferrer">Открыть в магазине</a>
                                </div>
                              </label>
                            `
                          )
                          .join("")}
                      </div>
                    </details>
                  `
                  : ""
              }
            </div>
          </article>
        `
      )
      .join("");
  }

  confirmBasketButton.disabled = confirmedItems.length === 0;
  basketConfirmationResult.textContent = state.transferSummary
    ? `Подтверждено товаров: ${state.transferSummary.confirmedCount}. Выбранные позиции сохранены, ссылки на товары можно открывать точечно из карточек.`
    : "Подтверждённые позиции будут сохранены. Товары можно открывать вручную по ссылкам из карточек, без массового открытия вкладок.";
};

const renderSummary = () => {
  servingsValue.textContent = String(state.servings);
  servingsNote.textContent = `База рецептов рассчитана на 2 персоны. Сейчас показан пересчёт на ${state.servings}.`;
  selectedCount.textContent = String(state.plannedRecipeIds.length);
  if (basketTransferNote) {
    basketTransferNote.textContent = state.transferSummary
      ? `Для ${state.transferSummary.storeName} сохранено ${state.transferSummary.confirmedCount} подтверждённых товаров.`
      : "После выбора меню откройте подтверждаемую корзину, проверьте подбор и сохраните подтверждённые товары.";
  }
  if (catalogRefreshNote) {
    catalogRefreshNote.textContent = `Каталог обновляется каждый понедельник в 06:00 по Москве. Следующее обновление: ${getNextRecipeRefreshLabel()}.`;
  }
};

const render = () => {
  ensureConfirmationBasket();
  syncFilterControls();
  renderSummary();
  renderRecipes();
  renderWeeklyPlan();
  renderShoppingList();
  renderRecipeViewer();
  renderBasketConfirmation();
};

document.querySelector("#increase-servings").addEventListener("click", () => {
  state.servings = Math.min(8, state.servings + 1);
  render();
});

document.querySelector("#decrease-servings").addEventListener("click", () => {
  state.servings = Math.max(1, state.servings - 1);
  render();
});

ingredientFilter.addEventListener("input", (event) => {
  state.filters.ingredient = event.target.value;
  saveFilters();
  renderRecipes();
});

excludeIngredientFilter.addEventListener("input", (event) => {
  state.filters.excludeIngredient = event.target.value;
  saveFilters();
  renderRecipes();
});

difficultyFilter.addEventListener("change", (event) => {
  state.filters.difficulty = event.target.value;
  saveFilters();
  renderRecipes();
});

meatFilter.addEventListener("change", (event) => {
  state.filters.meat = event.target.value;
  saveFilters();
  renderRecipes();
});

timeFilters.forEach((filter) => {
  filter.addEventListener("change", (event) => {
    state.filters.time = event.target.value;
    saveFilters();
    renderRecipes();
  });
});

if (resetFiltersButton) {
  resetFiltersButton.addEventListener("click", () => {
    resetFilters();
  });
}

recipesGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const recipeId = Number(button.dataset.recipeId);
  const recipe = sortedRecipes.find((item) => item.id === recipeId);
  if (!recipe) return;

  if (button.dataset.action === "toggle-plan") {
    if (state.plannedRecipeIds.includes(recipeId)) return;
    if (state.plannedRecipeIds.length >= 7) return;
    state.plannedRecipeIds.push(recipeId);
    render();
  }

  if (button.dataset.action === "show-ingredients") {
    openRecipeViewer(recipe.id);
  }
});

weeklyPlan.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.dataset.action !== "remove-plan") return;

  const recipeId = Number(button.dataset.recipeId);
  state.plannedRecipeIds = state.plannedRecipeIds.filter((item) => item !== recipeId);
  render();
});

shoppingList.addEventListener("click", (event) => {
  void event;
});

if (openBasketConfirmationButton) {
  openBasketConfirmationButton.addEventListener("click", () => {
    state.transferSummary = null;
    renderSummary();
    openBasketConfirmation();
  });
}

if (basketConfirmation) {
  basketConfirmation.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest('[data-action="close-basket-confirmation"]');
    if (closeTrigger) {
      closeBasketConfirmation();
    }
  });

  basketConfirmation.addEventListener("change", (event) => {
    const input = event.target.closest('[data-action="select-basket-product"]');
    if (!input) return;

    state.confirmationBasket = state.confirmationBasket.map((item) =>
      item.id === input.dataset.itemId
        ? basketMatcher.applyCandidateSelection(item, input.value)
        : item
    );
    state.transferSummary = null;
    renderBasketConfirmation();
  });
}

if (confirmBasketButton) {
  confirmBasketButton.addEventListener("click", () => {
    const confirmedItems = state.confirmationBasket.filter((item) => item.selectedProductId);
    if (confirmedItems.length === 0) return;

    basketMatcher.saveMappings(confirmedItems, storeConnector);
    state.transferSummary = storeConnector.finalizeConfirmedItems(confirmedItems);
    render();
  });
}

if (recipeViewer) {
  recipeViewer.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest('[data-action="close-recipe-viewer"]');
    if (closeTrigger) {
      closeRecipeViewer();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.activeRecipeId !== null) {
    closeRecipeViewer();
  }
  if (event.key === "Escape" && state.isBasketConfirmationOpen) {
    closeBasketConfirmation();
  }
});

loadFilters();
window.localStorage.setItem(RECIPE_CYCLE_STORAGE_KEY, recipeCycleKey);
render();
