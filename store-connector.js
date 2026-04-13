(function () {
  const STORE_ID = "yandex-lavka";
  const STORE_NAME = "Яндекс Лавка";

  const encodeSvg = (svg) =>
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

  const buildProductImage = (title, accent = "#d06f45") =>
    encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
        <defs>
          <linearGradient id="g" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="${accent}" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#f5d6be" stop-opacity="1" />
          </linearGradient>
        </defs>
        <rect width="480" height="360" rx="28" fill="url(#g)" />
        <rect x="38" y="38" width="404" height="284" rx="24" fill="rgba(255,255,255,0.68)" />
        <text x="240" y="160" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="28" font-weight="700" fill="#402b20">
          ${title.slice(0, 24)}
        </text>
        <text x="240" y="206" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="18" fill="#6e5f55">
          Выбор для корзины
        </text>
      </svg>
    `);

  const buildSearchUrl = (query) =>
    `https://lavka.yandex.ru/search?text=${encodeURIComponent(query)}`;

  const product = ({ id, title, price, query, accent }) => ({
    id,
    title,
    price,
    image: buildProductImage(title, accent),
    url: buildSearchUrl(query || title)
  });

  const explicitCatalog = {
    "хлеб": [
      product({
        id: "bread-grain",
        title: "Хлеб цельнозерновой нарезанный",
        price: "159 ₽",
        query: "хлеб цельнозерновой",
        accent: "#b98256"
      }),
      product({
        id: "bread-brioche",
        title: "Хлеб на закваске",
        price: "189 ₽",
        query: "хлеб на закваске",
        accent: "#c88d52"
      })
    ],
    "сыр": [
      product({
        id: "cheese-gauda",
        title: "Сыр гауда нарезка",
        price: "229 ₽",
        query: "сыр гауда",
        accent: "#f0b24f"
      }),
      product({
        id: "cheese-cheddar",
        title: "Сыр чеддер ломтики",
        price: "249 ₽",
        query: "сыр чеддер",
        accent: "#ea9f34"
      })
    ],
    "сливки 10": [
      product({
        id: "cream-10-200",
        title: "Сливки 10% 200 мл",
        price: "119 ₽",
        query: "сливки 10 200 мл",
        accent: "#f2c7ab"
      }),
      product({
        id: "cream-10-500",
        title: "Сливки 10% 500 мл",
        price: "209 ₽",
        query: "сливки 10 500 мл",
        accent: "#f0bc94"
      })
    ],
    "томаты в собственном соку": [
      product({
        id: "tomato-chopped",
        title: "Томаты резаные в собственном соку",
        price: "149 ₽",
        query: "томаты в собственном соку",
        accent: "#d95c55"
      }),
      product({
        id: "tomato-whole",
        title: "Томаты целые очищенные",
        price: "159 ₽",
        query: "томаты очищенные",
        accent: "#c84f49"
      })
    ],
    "вяленые томаты": [
      product({
        id: "sun-dried",
        title: "Томаты вяленые в масле",
        price: "259 ₽",
        query: "вяленые томаты",
        accent: "#b84f43"
      })
    ],
    "фета": [
      product({
        id: "feta-classic",
        title: "Фета классическая",
        price: "239 ₽",
        query: "фета сыр",
        accent: "#e8e1d6"
      }),
      product({
        id: "feta-salad",
        title: "Сыр для салата в стиле фета",
        price: "199 ₽",
        query: "сыр фета салат",
        accent: "#ddd5cb"
      })
    ],
    "йогурт": [
      product({
        id: "yogurt-greek",
        title: "Йогурт греческий натуральный",
        price: "139 ₽",
        query: "греческий йогурт",
        accent: "#ece8e1"
      }),
      product({
        id: "yogurt-plain",
        title: "Йогурт натуральный без сахара",
        price: "99 ₽",
        query: "натуральный йогурт",
        accent: "#e3dfd7"
      })
    ],
    "рис арборио": [
      product({
        id: "arborio-rice",
        title: "Рис арборио для ризотто",
        price: "219 ₽",
        query: "рис арборио",
        accent: "#e8d5a7"
      })
    ],
    "киноа": [
      product({
        id: "quinoa",
        title: "Киноа белая",
        price: "279 ₽",
        query: "киноа",
        accent: "#d5bf8c"
      })
    ],
    "орзо": [
      product({
        id: "orzo-pasta-classic",
        title: "Паста орзо классическая",
        price: "189 ₽",
        query: "орзо паста",
        accent: "#e3c17b"
      }),
      product({
        id: "orzo-pasta-italian",
        title: "Орзо из твердых сортов пшеницы",
        price: "209 ₽",
        query: "паста орзо",
        accent: "#d8b062"
      })
    ],
    "кокосовое молоко": [
      product({
        id: "coconut-milk",
        title: "Кокосовое молоко",
        price: "239 ₽",
        query: "кокосовое молоко",
        accent: "#efe3c4"
      })
    ],
    "паста": [
      product({
        id: "pasta-penne",
        title: "Паста пенне",
        price: "129 ₽",
        query: "паста пенне",
        accent: "#efc278"
      }),
      product({
        id: "pasta-spaghetti",
        title: "Паста спагетти",
        price: "139 ₽",
        query: "паста спагетти",
        accent: "#e4b869"
      })
    ],
    "томатный соус": [
      product({
        id: "tomato-sauce-pasta",
        title: "Томатный соус для пасты",
        price: "179 ₽",
        query: "томатный соус для пасты соусы",
        accent: "#ce6456"
      }),
      product({
        id: "tomato-sauce-basil",
        title: "Соус томатный с базиликом",
        price: "199 ₽",
        query: "соус томатный базилик соусы",
        accent: "#bc5448"
      })
    ],
    "куриное филе": [
      product({
        id: "chicken-fillet",
        title: "Филе куриной грудки",
        price: "329 ₽",
        query: "куриное филе",
        accent: "#ebb69c"
      })
    ],
    "филе индейки": [
      product({
        id: "turkey-fillet",
        title: "Филе индейки охлажденное",
        price: "389 ₽",
        query: "филе индейки",
        accent: "#d8b3a3"
      })
    ],
    "филе лосося": [
      product({
        id: "salmon-fillet",
        title: "Филе лосося охлажденное",
        price: "769 ₽",
        query: "филе лосося",
        accent: "#e48d72"
      })
    ],
    "шпинат": [
      product({
        id: "spinach",
        title: "Шпинат свежий",
        price: "169 ₽",
        query: "шпинат",
        accent: "#7fb36b"
      }),
      product({
        id: "spinach-mini",
        title: "Мини-шпинат",
        price: "189 ₽",
        query: "мини шпинат",
        accent: "#5c9a5f"
      })
    ],
    "яйца": [
      product({
        id: "eggs-c1",
        title: "Яйца куриные С1 10 шт",
        price: "149 ₽",
        query: "яйца с1",
        accent: "#e6d1a8"
      }),
      product({
        id: "eggs-c0",
        title: "Яйца куриные С0 10 шт",
        price: "179 ₽",
        query: "яйца с0",
        accent: "#dcc08b"
      })
    ]
  };

  const genericSingleKeywords = [
    "лимон",
    "лайм",
    "морковь",
    "брокколи",
    "авокадо",
    "нут",
    "булгур",
    "цукини",
    "рикотта",
    "моцарелла",
    "пармезан",
    "огурец",
    "чеснок",
    "тофу",
    "шиитаке",
    "шампиньоны",
    "картофель",
    "укроп",
    "чечевица",
    "батат",
    "перловка",
    "халуми",
    "эдамаме",
    "креветки",
    "морепродукты",
    "чечевица",
    "треска",
    "свинина",
    "говядина",
    "говяжий стейк"
  ];

  const genericMultipleKeywords = [
    "рис",
    "сыр",
    "томаты",
    "соус",
    "перец",
    "лук",
    "хлеб",
    "паста",
    "лапша",
    "сливки"
  ];

  const makeGenericProducts = (item, quantity = 1) =>
    Array.from({ length: quantity }, (_, index) =>
      product({
        id: `${item.normalizedName}-${index + 1}`,
        title:
          quantity === 1
            ? `${item.ingredientName} для недели`
            : `${item.ingredientName} вариант ${index + 1}`,
        price: `${129 + index * 40} ₽`,
        query: item.normalizedName,
        accent: index === 0 ? "#d06f45" : "#b4c88f"
      })
    );

  const searchProducts = (item) => {
    if (explicitCatalog[item.normalizedName]) {
      return explicitCatalog[item.normalizedName];
    }

    if (item.normalizedName.includes("бульон")) {
      return [];
    }

    if (genericMultipleKeywords.some((keyword) => item.normalizedName.includes(keyword))) {
      return makeGenericProducts(item, 2);
    }

    if (genericSingleKeywords.some((keyword) => item.normalizedName.includes(keyword))) {
      return makeGenericProducts(item, 1);
    }

    return makeGenericProducts(item, 1);
  };

  const finalizeConfirmedItems = (items) => {
    return {
      storeId: STORE_ID,
      storeName: STORE_NAME,
      openedCount: 0,
      confirmedCount: items.length,
      blockedCount: 0
    };
  };

  window.HappyWifeStoreConnector = {
    id: STORE_ID,
    name: STORE_NAME,
    searchProducts,
    finalizeConfirmedItems
  };
})();
