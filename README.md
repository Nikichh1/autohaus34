# AutoHaus — cPanel edition

Отделна версия на [Nikichh1/autohaus34](https://github.com/Nikichh1/autohaus34)
за **Namecheap / SuperHosting с Node.js 22 или 24 и Passenger**.
Дизайнът, BG/EN сайтът, админ панелът, Supabase данните, роли и Storage се
запазват. Не се копира и не се reset-ва реалната база.

**Качване стъпка по стъпка: [CPANEL.md](CPANEL.md).**

```sh
npm run build
npm run check
npm test
npm start
```

Локално: `http://127.0.0.1:3217`. В production стартовият файл е **`app.js`**,
управляван от cPanel → Setup Node.js App. Няма production npm зависимости.
Не използвайте `tools/dev-server.js` на хостинга.

```sh
npm run package:cpanel
```

Произвежда `artifacts/cpanel/autohaus34-cnpanel.tar.gz`: готов runtime архив
с precompressed Brotli/gzip assets. Качва се **извън `public_html`**;
HTTP сървърът излага само `dist/` и разрешените API маршрути.
Тайни ключове, SQL, tests и Git metadata не влизат в архива.

`/` и `/index.html` използват същия managed homepage renderer. `/admin` остава
защитен с реална Supabase сесия и текуща активна роля. Автомобилите, снимките,
настройките, екипът, analytics, преводът, sitemap и robots се запазват.

`npm test` проверява cPanel сървъра и dependency-free regression тестовете с
изолирани fixtures/mocked услуги. Optional database/image suites са отделни;
нито един тест не трябва да използва production база или реална поща.
Тестовете не заменят staging deployment и операторско приемане.

Оригиналният `vercel.json` се пази за сравнение/regression checks, но cPanel
**не го чете**. Новото репо не публикува към Vercel, няма auto-deploy hook
и не променя DNS, поща или PHP.

Старата PHP програма не е в това репо и се запазва/мигрира отделно.
Supabase остава отделна услуга със своя регион и абонамент.
