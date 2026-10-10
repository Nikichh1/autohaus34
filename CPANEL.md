# AutoHaus във Vercel и cPanel

Текущ адрес: **https://autotest.autohaus.bg**.
Одобреният frontend е commit `82bf95aa000d2a8925afca2470d87e367bce47de` в
`Nikichh1/autohaus34`. cPanel repo: `autohausbg-hub/autohaus34-cnpanel`.
Поправките се публикуват в `Nikichh1/autohaus34`, branch
`fix/cpanel-current-admin-20261010`; `main` остава непроменен.
GitHub integration отказва write към прехвърленото cPanel repo с 403,
затова deployment изтегля изрично source repository и тази release версия.

## Причина и поправка на дизайна

Live `/admin/admin.css` беше raw source (28 712 bytes), кеширан за 7 дни.
Правилният bundle е 50 721 bytes: базов CSS + `brand.css` + `brand-fallback.css`.
LiteSpeed сервира съществуващите source файлове преди Passenger; Git history
не показва rollback на admin интерфейса при cPanel адаптацията.

Базовите стилове вече са в `admin/admin-base.css`. И двата build-а генерират
**идентични** `admin/admin.css` и `dist/admin/admin.css` от същите три източника.
Редактирайте source файловете, после build; не редактирайте генерирания bundle.
cPanel admin assets използват content версия. `build-info.json` открива
смесен/остарял runtime преди стартиране.

## Директории и настройки

| cPanel поле | Стойност |
|---|---|
| Node.js | 24.x (поддържа се и 22.x) |
| Application mode | Production |
| Application URL | `https://autotest.autohaus.bg`, път `/` |
| Application root (потвърден от cPanel снимките) | `repositories/autohaus34-cnpanel` |
| Startup file | `app.js` |
| Domains → Document Root (цел; първо проверете текущата стойност) | `/home/autohaus/repositories/autohaus34-cnpanel/public` |

`public/` съдържа само `.htaccess` и евентуално ACME `.well-known/`.
Passenger препраща към Node; Node сервира `dist/`, защитения `/admin` и API.

**Document Root не трябва да е checkout, application root или dist.**
Снимките от 10 октомври потвърждават работещия Node Application root:
`/home/autohaus/repositories/autohaus34-cnpanel`, Git branch `main`, commit
`3e6367b3546eba41cee9d9bd4c2f294f6d8d9b03`. Папките `test-autohaus.bg` и
`test.autohaus.bg` са отделни копия. Не използвайте тях за обновяване на
това приложение. Document Root на `autotest.autohaus.bg` още не е показан;
проверете го в Domains преди промяна. Startup file `app.js`, Production,
Node 24 и PUBLIC_ORIGIN са потвърдени от снимките.
Не публикувайте `.git`, `.env`, SQL, server/API код или runtime архиви.

## Обновяване от GitHub

Първо изпълнете само read-only диагностиката в Terminal и прегледайте
локалните промени. Не изпращайте environment стойности или ключове.

```sh
source /home/autohaus/nodevenv/repositories/autohaus34-cnpanel/24/bin/activate
cd /home/autohaus/repositories/autohaus34-cnpanel
git status --short
git log -1 --format='%h %s'
node --version
```

За следващото обновяване checkout-ът трябва да е проверен и без непазени
промени по tracked файлове. Блокът спира при грешка и пази стария commit
в отделен backup branch. Той не променя GitHub origin/main:

```sh
( 
set -e
source /home/autohaus/nodevenv/repositories/autohaus34-cnpanel/24/bin/activate
cd /home/autohaus/repositories/autohaus34-cnpanel
git diff --quiet
git diff --cached --quiet
git branch "backup/cpanel-$(date +%Y%m%d-%H%M%S)" HEAD
git fetch https://github.com/Nikichh1/autohaus34.git fix/cpanel-current-admin-20261010
git switch -c "deploy/cpanel-$(date +%Y%m%d-%H%M%S)" --no-track FETCH_HEAD
npm ci --ignore-scripts
node tools/cpanel-build.js
node tools/cpanel-public-root.js
node tools/cpanel-doctor.js --document-root "$PWD/public" --origin https://autotest.autohaus.bg
)
```

Ако application root няма `.git`, използвайте runtime архив или нов checkout
в отделна папка. Не правете reset/clean или копиране върху неизвестни локални
промени. За активно обслужван сайт подгответе release в отделна папка, после
сменете Application root; пазете предишния release за rollback.

В **Domains** задайте Document Root към подготвената `public/`.
В **Setup Node.js App** проверете root, URL, startup file и environment.
Натиснете **Save/Restart**, за да се генерира Passenger конфигурацията там.
Скриптът запазва CloudLinux block и отказва да презапише непразна директория.

```sh
mkdir -p tmp
touch tmp/restart.txt
node tools/cpanel-doctor.js --document-root "$PWD/public" --origin https://autotest.autohaus.bg --live
```

`--live` проверява точния build/CSS, cache policy, двата anonymous login
redirects, недостъпността на частни файлове и всички текущо публикувани
Supabase slugs. Използва **само GET/HEAD/SELECT**. Не стартирайте втори daemon
или `npm start` в SSH: Passenger управлява процеса.

## Environment variables — без секретни стойности

| Име | Използване |
|---|---|
| `NODE_ENV` | `production` |
| `PUBLIC_ORIGIN` | Задължително: `https://autotest.autohaus.bg` |
| `ALLOWED_HOSTS` | По избор: допълнителни разрешени host names, със запетая |
| `TRUST_PROXY` | `1` само зад доверения hosting proxy; иначе `0` |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Съществуваща интеграция за запитвания |
| `CLOUDINARY_CLOUD_NAME` | Опционална legacy Cloudinary съвместимост |
| `ADMIN_EMAILS` | Legacy helper; активните роли идват от Supabase RPC/RLS |
| `PORT`, `HOST` | Самостоятелен режим; Passenger избира socket-а |
| `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID` | Автоматично във Vercel; cPanel има build content версия |

Supabase URL и **publishable** key са фиксирани в `server/admin-lib.js`.
Тази интеграция не чете `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` или `VITE_*`. Не копирайте service-role/secret
ключове или временен `VERCEL_OIDC_TOKEN`; admin API използва JWT/RLS.
`.env` не се зарежда автоматично; използвайте cPanel Environment variables.

Липсващ PUBLIC_ORIGIN, неправилен startup file или смесен build могат да
провалят стартирането. Проверявайте Passenger stderr и `/healthz`, не само
Started в cPanel. Healthz връща build ID/source revision; `--live` проверява
базата отделно. Hardcoded TCP port не се използва при Passenger.

## Данни и тестове

Запазват се същият Supabase проект, потребители, роли и Storage.
На 10 октомври: 90 total / 79 published; RLS е включен. Публичният boot
зарежда само авторитетното API, без стар snapshot fallback. При failure
API връща 503, без да представя стари автомобили като актуални.

**Не изпълнявайте schema/reset/seed/bootstrap/import или миграции за
смяната на хостинга.** Тестов домейн към production Supabase не е sandbox.
CRUD, роли и upload се проверяват с изолирани mocks/fixtures.

```sh
node build.js
node tools/cpanel-build.js
npm run check
npm test
npm run package:cpanel
```

Runtime архивът в `artifacts/cpanel/` включва app/API/server/dist, metadata
и празна public папка; няма .env, .git, SQL, tooling или CI. Качва се извън
Document Root; настройките от таблицата остават нужни.

Vercel запазва `node build.js`, dist и същите handlers/rewrites. Няма нов
дизайн или независимо копие на админ логиката. CI проверява двата build-а.

Старият `test.autohaus.bg` връща Cloudflare 526: коригирайте origin SSL
сертификата, ако този адрес ще се използва. Текущият адрес е `autotest.autohaus.bg`.

## Автоматична browser проверка

CI стартира изолиран UI fixture и сравнява 24 screenshots с одобрения commit: dashboard, cars, settings, new на desktop, phone и Fold ширини 673/690/744/768 px. Няма production credentials или writes. За локална проверка с инсталирани Playwright/Chromium:

```sh
node tools/cpanel-ui-verify.js --reference /absolute/path/to/approved-worktree
```
