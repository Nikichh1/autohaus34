# Проверка — 2026-10-10

## Доказателства

- Original HEAD: `82bf95aa000d2a8925afca2470d87e367bce47de`.
  GitHub status: **Vercel success**:
  https://vercel.com/niki27/autohaus34/2Rtth7qAk42GLxPsLw2oE7huhiWN
- cPanel HEAD преди поправката: `3e6367b3546eba41cee9d9bd4c2f294f6d8d9b03`.
  Пет cPanel commits върху същата база; няма rollback на admin CSS/JS/page.
  Разгледани са branch heads и историята на styles/page. По-старите
  backup/unmerged/reverted branches не са избрани за одобрен дизайн.
- Live `autotest.autohaus.bg/admin/admin.css`: **28 712 bytes**,
  SHA-256 prefix `da55b0a95c493e55`: точно raw source.
- Одобрен bundle: **50 721 bytes**, SHA-256 prefix `576a75fe1494fb1f`.
  Липсващата част е brand.css + brand-fallback.css.
- Live headers: LiteSpeed, CSS public cache за 604800 s; source homepage
  също няма dynamic handler headers. Public source файлове заобикалят Passenger.
- Supabase read-only SELECT: **90 total / 79 published**; public RLS включен.
  Live API: 200, authoritative true, **79 cars**. Няма production mutations.
- Browser: live homepage/catalog и redirect към admin login работят.
  Старият test.autohaus.bg връща Cloudflare 526; autotest е текущият адрес.

## Проверка на поправката

- Vercel и cPanel build използват един frontend/API.
- Built admin CSS и admin controller/fixes/advanced/image-sorter/site-media,
  public CSS/JS са **byte-identical** с одобрения commit.
  Промените са в packaging/startup/hashing/error handling, без нов layout.
- **156 автоматизирани теста**: routing, CSRF, login cookies, роли, safe HTTP
  CRUD, sessions, image/translation workflows, cache и stale build detection.
- **183 JavaScript syntax checks**; HTML asset и image variant integrity.
- Public-root скриптът запазва Passenger block и не изтрива чужди файлове.
  Startup проверява build hashes и използва един явен Passenger socket listener.

## Ограничения

Няма автентикирана cPanel/Vercel operator сесия или admin login сесия.
Hosting настройки, production branches и DNS не са променяни.
GitHub Vercel success е проверен; старият alias autohaus34.vercel.app
връща 404 и не е използван като визуален еталон.

Поправеният локален Node adapter премина read-only HTTP smoke test към живия
Supabase: точни 79 published slugs, login redirects, CSS/cache и private-file checks.
Cloud browser провери live homepage/login. Локален Playwright има, но
Chromium липсва и официалният download върна невалиден ZIP. **Не е заявено
успешно screenshot/pixel сравнение** на защитеното табло, live login или upload.
Проверена е точна parity на одобрения frontend код/CSS. Write тестовете
използват само изолирани данни.

Live версията още няма новия build marker. След обновяване/build/Passenger
Restart по CPANEL.md изпълнете cpanel-doctor --live и проверете dashboard,
снимки, filters/pagination и Fold layout с валидна admin сесия.

GitHub integration позволява branch/PR в Nikichh1/autohaus34, но връща
403 Resource not accessible by integration при write в autohausbg-hub/autohaus34-cnpanel.
Deployment командите използват source repo изрично, без промяна на production main.
