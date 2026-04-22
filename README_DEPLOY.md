# Happy Wife Menu 2.0 — публикация и автоматизация

## Как всё устроено

- **Сайт**: статический (HTML + CSS + JS), хостится на GitHub Pages.
- **Репозиторий**: https://github.com/yarnastya-good-vibes/happy_menu
- **Публичный URL**: https://yarnastya-good-vibes.github.io/happy_menu/
- **Ротация рецептов**: парсер на Node.js каждое воскресенье в 10:00 по Москве тянет 25 основных блюд + 5 супов с eda.rambler.ru и коммитит `recipes-pending.json` в репо. Запускает это GitHub Actions (`.github/workflows/deploy-pages.yml`) — твой Mac для этого включать не нужно.
- **Модалка**: когда в репозитории появляется новый `recipes-pending.json`, фронтенд при следующем открытии сайта показывает тебе модалку «применить / оставить старые».

## Первый пуш (один раз)

1. Открой **Terminal.app** (Cmd+Space → «Terminal»)
2. Выполни:
   ```
   cd "/Users/Anastasia/Downloads/Happy Wife Menu/Happy Wife Menu 2.0"
   bash deploy-to-github.sh
   ```
3. Если git спросит логин/пароль — введи GitHub username и **Personal Access Token** (не обычный пароль). Токен создаётся здесь: https://github.com/settings/tokens (галочка `repo`).

После этого можно забыть про ручное перетаскивание файлов.

## Ручной запуск ротации (для теста)

- Из интерфейса GitHub: Actions → «Deploy & Rotate» → Run workflow.
- Или локально:
  ```
  cd "/Users/Anastasia/Downloads/Happy Wife Menu/Happy Wife Menu 2.0"
  node parser/build-weekly.js --pending
  ```
  И открой `index.html` — увидишь модалку с новой подборкой.

## Файлы

| Файл                          | Что                                                        |
|-------------------------------|------------------------------------------------------------|
| `index.html`, `styles.css`    | Разметка и стили                                            |
| `script.js`                   | Вся UI-логика, модалка ротации, загрузка `recipes.json`    |
| `recipes.json`                | Текущие 30 активных рецептов (база)                         |
| `recipes-pending.json`        | Новая подборка, ждущая подтверждения (создаётся воркфлоу)  |
| `hero-photo.jpeg`             | Главная картинка сайта                                     |
| `parser/fetch-recipe.js`      | Парсер одного рецепта (через `__NEXT_DATA__`)              |
| `parser/fetch-category.js`    | Сборщик URL из категории с пагинацией                      |
| `parser/build-weekly.js`      | Оркестратор: 25 основных + 5 супов → JSON                  |
| `.github/workflows/deploy-pages.yml` | Автодеплой + еженедельная ротация                    |
| `deploy-to-github.sh`         | Ручной скрипт первого пуша                                 |
