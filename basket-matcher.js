(function () {
  const MAPPINGS_STORAGE_KEY = "happy-wife-menu-store-mappings-v1";

  const aliasMap = new Map([
    ["филе куриной грудки", "куриное филе"],
    ["куриная грудка", "куриное филе"],
    ["сыр для салата", "фета"],
    ["мини шпинат", "шпинат"],
    ["томаты консервированные", "томаты в собственном соку"],
    ["сливки 10%", "сливки 10"],
    ["томатный соус", "томаты"],
    ["листы лазаньи", "паста"],
    ["лапша рамен", "лапша"],
    ["рис жасмин", "рис"],
    ["рис арборио", "рис арборио"]
  ]);

  const normalizeIngredientName = (name) => {
    const base = name
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[%.,/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return aliasMap.get(base) || base;
  };

  const loadSavedMappings = () => {
    try {
      const raw = window.localStorage.getItem(MAPPINGS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveMappings = (items, connector) => {
    const current = loadSavedMappings();

    items.forEach((item) => {
      if (!item.selectedProductId) return;

      current[item.normalizedName] = {
        normalizedName: item.normalizedName,
        selectedProductId: item.selectedProductId,
        selectedProductTitle: item.selectedProductTitle,
        selectedProductUrl: item.selectedProductUrl,
        selectedProductPrice: item.selectedProductPrice,
        updatedAt: new Date().toISOString(),
        storeId: connector.id
      };
    });

    window.localStorage.setItem(MAPPINGS_STORAGE_KEY, JSON.stringify(current));
  };

  const buildConfirmableBasket = ({
    plannedRecipeIds,
    recipes,
    servings,
    pantryExclusions,
    connector
  }) => {
    const multiplier = servings / 2;
    const savedMappings = loadSavedMappings();
    const basketMap = new Map();

    plannedRecipeIds.forEach((recipeId) => {
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) return;

      recipe.ingredients.forEach((ingredient) => {
        const loweredName = ingredient.name.toLowerCase();
        if (pantryExclusions.some((item) => loweredName.includes(item))) {
          return;
        }

        const normalizedName = normalizeIngredientName(ingredient.name);
        const key = `${normalizedName}-${ingredient.unit}`;
        const previous = basketMap.get(key) || {
          ingredientName: ingredient.name,
          normalizedName,
          amount: 0,
          unit: ingredient.unit,
          recipes: [],
          status: "not-found",
          selectedProductId: null,
          selectedProductTitle: "",
          selectedProductUrl: "",
          selectedProductPrice: "",
          selectedProductImage: "",
          candidates: []
        };

        previous.amount += ingredient.amount * multiplier;
        if (!previous.recipes.includes(recipe.title)) {
          previous.recipes.push(recipe.title);
        }

        basketMap.set(key, previous);
      });
    });

    return Array.from(basketMap.values())
      .map((item, index) => {
        const candidates = connector.searchProducts(item);
        const saved = savedMappings[item.normalizedName];
        const savedCandidate = saved
          ? candidates.find((candidate) => candidate.id === saved.selectedProductId)
          : null;

        let status = "not-found";
        let selectedProduct = null;

        if (savedCandidate) {
          status = "found";
          selectedProduct = savedCandidate;
        } else if (candidates.length === 1) {
          status = "found";
          selectedProduct = candidates[0];
        } else if (candidates.length > 1) {
          status = "needs-confirmation";
        }

        return {
          ...item,
          id: `${item.normalizedName}-${index + 1}`,
          candidates,
          status,
          selectedProductId: selectedProduct ? selectedProduct.id : null,
          selectedProductTitle: selectedProduct ? selectedProduct.title : "",
          selectedProductUrl: selectedProduct ? selectedProduct.url : "",
          selectedProductPrice: selectedProduct ? selectedProduct.price : "",
          selectedProductImage: selectedProduct ? selectedProduct.image : ""
        };
      })
      .sort((left, right) => left.ingredientName.localeCompare(right.ingredientName, "ru"));
  };

  const applyCandidateSelection = (item, candidateId) => {
    if (!candidateId) {
      return {
        ...item,
        status: item.candidates.length > 0 ? "needs-confirmation" : "not-found",
        selectedProductId: null,
        selectedProductTitle: "",
        selectedProductUrl: "",
        selectedProductPrice: "",
        selectedProductImage: ""
      };
    }

    const candidate = item.candidates.find((option) => option.id === candidateId);
    if (!candidate) {
      return item;
    }

    return {
      ...item,
      status: "found",
      selectedProductId: candidate.id,
      selectedProductTitle: candidate.title,
      selectedProductUrl: candidate.url,
      selectedProductPrice: candidate.price,
      selectedProductImage: candidate.image
    };
  };

  window.HappyWifeBasketMatcher = {
    normalizeIngredientName,
    buildConfirmableBasket,
    applyCandidateSelection,
    loadSavedMappings,
    saveMappings
  };
})();
