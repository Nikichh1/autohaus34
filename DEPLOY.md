# Deploying the cPanel edition

Use [CPANEL.md](CPANEL.md) for the Bulgarian Namecheap / SuperHosting checklist.
This repository does not modify or deploy the original Vercel project.

```sh
npm run build
npm run check
npm test
npm run package:cpanel
```

Upload `artifacts/cpanel/autohaus34-cnpanel.tar.gz` to a private application
directory outside the public document root. Configure **Node 22/24**,
**Production**, startup **app.js**, and the real HTTPS **PUBLIC_ORIGIN**.
Passenger starts the process; do not run a second daemon or the preview server.

Keep Supabase Auth/Postgres/Storage and current permissions intact. No SQL
reset, seed, migration, data copy or service-role key is needed for the host change.
Do not place backend code, credentials, SQL or the entire Git repository in `public_html`.

Local fixture tests are not live integration verification. Test a separate
application, use isolated records for writes and obtain approval before changing
production DNS. Keep Vercel / existing hosting for rollback. PHP and email are
separate migration work, not supplied by this archive.
