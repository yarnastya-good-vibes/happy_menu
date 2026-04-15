(function () {
  const STORE_ID = "perekrestok";
  const STORE_NAME = "Перекрёсток";

  // ID расширения — заменить на реальный после установки в Chrome
  // Найти можно на странице chrome://extensions/ после загрузки расширения
  const EXTENSION_ID = "bkipafhnblhobnifomjalahoonbahajp";

  // ---------- Проверка доступности расширения ----------

  const isExtensionAvailable = () =>
    new Promise((resolve) => {
      if (!chrome?.runtime?.sendMessage) {
        resolve(false);
        return;
      }
      chrome.runtime.sendMessage(EXTENSION_ID, { action: "PING" }, (response) => {
        resolve(!chrome.runtime.lastError && response?.ok === true);
      });
    });

  // ---------- Поиск товаров через расширение ----------

  const searchProducts = async (ingredients) => {
    const available = await isExtensionAvailable();

    if (!available) {
      console.warn("[store-connector] Расширение недоступно. Установите Happy Wife — Перекрёсток.");
      return ingredients.map((ing) => ({
        ingredientName: ing.name,
        normalizedName: ing.name.toLowerCase(),
        amount: ing.amount,
        unit: ing.unit,
        status: "not-found",
        candidates: [],
        selectedProductId: null
      }));
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action: "SEARCH_INGREDIENTS", ingredients },
        (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            console.error("[store-connector] Ошибка поиска:", chrome.runtime.lastError);
            resolve([]);
          } else {
            resolve(response.results);
          }
        }
      );
    });
  };

  // ---------- Отправка корзины в расширение ----------

  const buildCart = (confirmedItems) =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { action: "BUILD_CART", confirmedItems },
        (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            resolve({ ok: false, statuses: [] });
          } else {
            resolve({ ok: true, statuses: response.statuses });
          }
        }
      );
    });

  // ---------- Финализация (для совместимости с basket-matcher) ----------

  const finalizeConfirmedItems = (items) => ({
    storeId: STORE_ID,
    storeName: STORE_NAME,
    confirmedCount: items.length
  });

  window.HappyWifeStoreConnector = {
    id: STORE_ID,
    name: STORE_NAME,
    isExtensionAvailable,
    searchProducts,
    buildCart,
    finalizeConfirmedItems
  };
})();
