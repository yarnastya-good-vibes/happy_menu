// parser/fetch-category.js
// Собирает URL рецептов из категории eda.rambler.ru с пагинацией.
// Новая вёрстка (2026): рецепты в листинге лежат в JSON-LD ItemList (по 6 на
// страницу) — __NEXT_DATA__/Apollo больше нет. Берём ссылки оттуда + фолбэк по
// якорям в HTML.
//
// Экспортирует:
//   fetchCategoryRecipes(slug, {pageCount}) — массив { id, relativeUrl, name }
//   extractRecipeLinks(html, slug)          — чистый парсер (для тестов)
//
// CLI: node parser/fetch-category.js osnovnye-blyuda 3

'use strict';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const BASE = 'https://eda.rambler.ru';

let proxyDispatcher = null;
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
  try {
    const { ProxyAgent } = require('undici');
    proxyDispatcher = new ProxyAgent(proxyUrl);
  } catch {
    /* proxy unavailable */
  }
}

const httpGet = async (url) => {
  const opts = {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow'
  };
  if (proxyDispatcher) opts.dispatcher = proxyDispatcher;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Имена-«не блюда» (на случай, если из URL вытащим slug-намёк). Сейчас название в
// листинге обычно пустое, поэтому фильтр почти всегда пропускает — основной отсев
// идёт уже на этапе детального фетча в build-weekly.
const NOT_A_DISH = /^(marinad|sous|zapravk|maslo|sirop|glazur|panirovk|bulon|specii)/i;

const extractLdBlocks = (html) => {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed && parsed['@graph']) out.push(...parsed['@graph']);
      else if (parsed) out.push(parsed);
    } catch {
      /* skip */
    }
  }
  return out;
};

const RECIPE_URL_RE = /\/recepty\/[a-z0-9-]+\/[a-z0-9-]+-\d+/i;

// Превращает абсолютный/относительный URL рецепта в { id, relativeUrl, name }
const toCandidate = (url, name = '') => {
  let rel = String(url || '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/\/$/, '')
    .replace(/[?#].*$/, '');
  if (!RECIPE_URL_RE.test(rel)) return null;
  const idm = rel.match(/-(\d+)$/);
  if (!idm) return null;
  return { id: idm[1], relativeUrl: rel, name: (name || '').trim() };
};

// Достаёт ссылки на рецепты из одной страницы листинга.
const extractRecipeLinks = (html, slug) => {
  const byId = new Map();
  const add = (cand) => {
    if (cand && !byId.has(cand.id)) byId.set(cand.id, cand);
  };

  // 1) JSON-LD ItemList → ListItem.url
  for (const b of extractLdBlocks(html)) {
    if (!b || b['@type'] !== 'ItemList') continue;
    for (const it of b.itemListElement || []) {
      if (!it) continue;
      const url = it.url || (it.item && (it.item['@id'] || it.item.url));
      const name = it.name || (it.item && it.item.name) || '';
      if (typeof url === 'string') add(toCandidate(url, name));
    }
  }

  // 2) Фолбэк: прямые ссылки в HTML (на случай изменения JSON-LD)
  if (byId.size === 0) {
    const re = new RegExp(`/recepty/${slug}/[a-z0-9-]+-\\d+`, 'gi');
    let m;
    while ((m = re.exec(html))) add(toCandidate(m[0]));
  }

  return [...byId.values()];
};

// Реальное блюдо, а не заготовка/маринад (по slug в URL, имя обычно пустое).
const isRealDish = (r) => {
  const slugTail = String(r.relativeUrl || '').split('/').pop() || '';
  return !NOT_A_DISH.test(slugTail);
};

// Собирает pageCount страниц категории. Возвращает массив кандидатов (dedupe по id).
const fetchCategoryRecipes = async (
  slug,
  { pageCount = 3, logger = console } = {}
) => {
  const seen = new Set();
  const all = [];
  let emptyStreak = 0;

  for (let page = 1; page <= pageCount; page++) {
    const url =
      page === 1
        ? `${BASE}/recepty/${slug}`
        : `${BASE}/recepty/${slug}?page=${page}`;
    logger.log(`[category] fetch ${url}`);
    try {
      const html = await httpGet(url);
      const items = extractRecipeLinks(html, slug);
      let added = 0;
      for (const r of items) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        all.push(r);
        added++;
      }
      logger.log(`[category] page ${page}: +${added} (всего ${all.length})`);
      // Если две страницы подряд не дали новых рецептов — пагинация кончилась.
      emptyStreak = added === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= 2) {
        logger.log('[category] новых рецептов нет 2 страницы подряд — стоп.');
        break;
      }
    } catch (err) {
      logger.warn(`[category] page ${page} failed: ${err.message}`);
    }
    await sleep(150);
  }

  const filtered = all.filter(isRealDish);
  logger.log(
    `[category] ${slug}: собрано ${all.length}, после фильтра ${filtered.length}`
  );
  return filtered;
};

module.exports = {
  fetchCategoryRecipes,
  extractRecipeLinks,
  isRealDish
};

// CLI
if (require.main === module) {
  const slug = process.argv[2] || 'osnovnye-blyuda';
  const pages = Number(process.argv[3] || 3);
  fetchCategoryRecipes(slug, { pageCount: pages })
    .then((list) => console.log(JSON.stringify(list, null, 2)))
    .catch((err) => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
