# Financie App — Task Backlog

## Ako používať tento súbor
- Pred každou session povedz Claudovi: "Prečítaj CLAUDE.md a TASKS.md a pokračuj na [task ID]"
- Po dokončení tasku zaškrtni `[x]` a commitni
- Každý task je samostatný — môžeš začať kdekoľvek v rámci fázy

---

## Fáza 0 — Project setup (urobíš sám, 30 min)

- [x] `F0-1` `npx create-next-app@latest financie --typescript --tailwind --app --src-dir`
- [x] `F0-2` `npm install prisma @prisma/client next-auth@beta otplib bcryptjs web-push node-cron yahoo-finance2 recharts`
- [x] `F0-3` `npm install -D @types/bcryptjs @types/web-push`
- [x] `F0-4` `npx prisma init --datasource-provider sqlite`
- [x] `F0-5` Skopíruj schému z CLAUDE.md do `prisma/schema.prisma`
- [x] `F0-6` `npx prisma migrate dev --name init`
- [x] `F0-7` Vytvor `.env.local` podľa `ENV_TEMPLATE.md`
- [x] `F0-8` `npx prisma db seed` — spustí seed so základnými účtami (Tatra, Revolut, Cash, Conseq, EIC, XTB, 2. pilier)

---

## Fáza 1 — Auth & základná kostra (2–3 sessions)

### F1-1: Prisma client + typy
**Súbory**: `src/lib/prisma.ts`, `src/types/index.ts`
**Úloha**: Singleton Prisma client, export všetkých TS typov odvodených zo schémy
**Vstup pre Clauda**: "Implementuj F1-1 — Prisma singleton a typy"
- [x] hotovo

### F1-2: NextAuth config + credentials provider
**Súbory**: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`
**Úloha**: Auth.js v5 s credentials providerom. Heslo uložené bcrypt hash v `Settings`. Session ako JWT. Middleware na ochranu všetkých `/(app)/*` routes.
**Vstup pre Clauda**: "Implementuj F1-2 — NextAuth credentials"
- [x] hotovo

### F1-3: TOTP setup + overenie
**Súbory**: `src/lib/totp.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(app)/settings/totp/page.tsx`
**Úloha**: Pri logine ak je TOTP aktívny → druhá obrazovka s 6-miestnym kódom. V settings: QR kód na zapnutie TOTP (otplib + qrcode). Backup codes (8 kusov, uložené ako bcrypt hash).
**Vstup pre Clauda**: "Implementuj F1-3 — TOTP 2FA"
- [x] hotovo

### F1-4: Layout + navigácia
**Súbory**: `src/app/(app)/layout.tsx`, `src/components/ui/nav.tsx`
**Úloha**: Sidebar navigácia (desktop) + bottom bar (mobil). Položky: Dashboard, Účty, Zárobky, Investície, Záväzky, Nastavenia. Badge na JOJ ak je diff > 5€. Dark mode toggle.
**Vstup pre Clauda**: "Implementuj F1-4 — layout a navigácia"
- [x] hotovo

---

## Fáza 2 — Accounts & Snapshots (2–3 sessions)

### F2-1: Accounts CRUD
**Súbory**: `src/app/(app)/accounts/page.tsx`, `src/app/api/accounts/route.ts`
**Úloha**: Zoznam účtov s typom, menou, poradím. Pridať/editovať/deaktivovať (nie mazať). Drag & drop poradie (alebo šípky hore/dole). Seed skript vytvorí predvolené účty.
**Vstup pre Clauda**: "Implementuj F2-1 — accounts CRUD"
- [ ] hotovo

### F2-2: Snapshot formulár — mesačné zadávanie
**Súbory**: `src/app/(app)/snapshots/page.tsx`, `src/app/(app)/snapshots/[month]/page.tsx`
**Úloha**: Výber mesiaca (default = aktuálny). Grid všetkých účtov s input poľom pre každý. Null = nezadané (sivé). Uložiť všetky naraz (jedna server action). Vizuálna indikácia: zelená = zadané, sivá = prázdne. Po uložení redirect na dashboard.
**Vstup pre Clauda**: "Implementuj F2-2 — snapshot formulár"
- [ ] hotovo

### F2-3: Custom fields pre snapshots
**Súbory**: `src/app/(app)/settings/custom-fields/page.tsx`, úprava F2-2
**Úloha**: V nastaveniach pridaj/odober vlastné kolonky (label, typ). Objavia sa v snapshot formulári pod štandardnými poľami. Hodnoty uložené ako JSON v `Snapshot.note` (alebo pridaj `CustomFieldValue` tabuľku).
**Vstup pre Clauda**: "Implementuj F2-3 — custom fields"
- [ ] hotovo

### F2-4: Dashboard — net worth prehľad
**Súbory**: `src/app/(app)/dashboard/page.tsx`, `src/components/charts/NetWorthChart.tsx`
**Úloha**: Metric karty (celkový majetok, sporenie, cash, zmena od minulého mesiaca). Line chart: net worth v čase (Recharts). Bar chart: rozloženie majetku podľa účtu. Posledné 3 snapshoty v tabuľke.
**Vstup pre Clauda**: "Implementuj F2-4 — dashboard"
- [ ] hotovo

---

## Fáza 3 — Zárobky & JOJ (1–2 sessions)

### F3-1: Income sources + entries CRUD
**Súbory**: `src/app/(app)/income/page.tsx`, `src/app/api/income/route.ts`
**Úloha**: Zoznam zdrojov zárobkov. Pre každý mesiac: zadaj sumu per zdroj. Celkový súčet mesiaca. Graf: zárobky per zdroj per mesiac (stacked bar).
**Vstup pre Clauda**: "Implementuj F3-1 — income module"
- [ ] hotovo

### F3-2: JOJ detail modul
**Súbory**: `src/app/(app)/income/joj/page.tsx`, `src/app/api/income/joj/route.ts`
**Úloha**: Formulár: počet streamov, €/stream (default 40), TV honorár, bonus → automatický výpočet "malo by prísť". Pole "reálne prijaté". Automatický diff + farebné zvýraznenie (červená ak |diff| > 5€). Štatistiky: priemer streamov/mesiac, €/stream trend, najlepší mesiac, celkovo od začiatku.
**Vstup pre Clauda**: "Implementuj F3-2 — JOJ detail"
- [ ] hotovo

### F3-3: Savings rate štatistiky
**Súbory**: `src/lib/calculations.ts`, úprava dashboard
**Úloha**: Savings rate = investované / príjem × 100. Progress bar voči cieľu (nastaviteľný v settings, default 20%). Mesačný trend. "Investoval si X€ z Y€ príjmu = Z%"
**Vstup pre Clauda**: "Implementuj F3-3 — savings rate"
- [ ] hotovo

---

## Fáza 4 — Investície & market data (2–3 sessions)

### F4-1: Investment positions CRUD
**Súbory**: `src/app/(app)/investments/page.tsx`, `src/app/api/investments/route.ts`
**Úloha**: Zoznam pozícií (ticker, ISIN, platforma, počet kusov, priemerná cena). Pridať/editovať/archivovať. Groupovanie podľa platformy (XTB, Conseq, EIC).
**Vstup pre Clauda**: "Implementuj F4-1 — investment positions"
- [ ] hotovo

### F4-2: Mesačné investičné záznamy
**Súbory**: `src/app/(app)/investments/[month]/page.tsx`
**Úloha**: Pre každý mesiac: koľko kusov pribudlo, za akú sumu, pri akej cene. Celková investovaná suma mesiaca (ide aj do savings rate výpočtu).
**Vstup pre Clauda**: "Implementuj F4-2 — monthly investment entries"
- [ ] hotovo

### F4-3: Market data fetcher
**Súbory**: `src/lib/market.ts`, `src/app/api/investments/refresh/route.ts`
**Úloha**: `yahoo-finance2` fetch pre každý ticker. Cache výsledkov v SQLite (nové pole alebo `Settings.data`). Refresh ak cache > 6h. Endpoint `POST /api/investments/refresh`. Fallback: ak ticker nenájde → zobraziť naposledy known cenu so štítkom "stará cena".
**Vstup pre Clauda**: "Implementuj F4-3 — market data fetcher"
- [ ] hotovo

### F4-4: Portfolio štatistiky + TWRR
**Súbory**: `src/lib/calculations.ts` (TWRR), `src/app/(app)/investments/stats/page.tsx`
**Úloha**: Aktuálna hodnota portfólia (units × current price). Investovaná suma celkom. Nerealizovaný zisk/strata (€ + %). TWRR výpočet (time-weighted return, očistený od nových vkladov). Benchmark: porovnanie s VWCE/SPY ak má ticker (jeden request na benchmark ticker). Graf: hodnota portfólia v čase.
**Vstup pre Clauda**: "Implementuj F4-4 — portfolio štatistiky a TWRR"
- [ ] hotovo

---

## Fáza 5 — Záväzky (1 session)

### F5-1: Liabilities modul
**Súbory**: `src/app/(app)/liabilities/page.tsx`, `src/app/api/liabilities/route.ts`
**Úloha**: Zoznam záväzkov s celkovou sumou, zostatok, dátum splatnosti, kategória. Pridať/editovať/označiť ako splatené. Dashboard: net worth po záväzkoch = net worth - SUM(remaining). Upozornenie pri záväzku s due_date < 30 dní.
**Vstup pre Clauda**: "Implementuj F5-1 — liabilities modul"
- [ ] hotovo

---

## Fáza 6 — PWA & notifikácie (1 session)

### F6-1: PWA setup
**Súbory**: `public/manifest.json`, `public/sw.js`, `next.config.ts`
**Úloha**: manifest.json (name, icons, theme_color, display: standalone). Service worker registrácia. `next-pwa` alebo manuálny SW. Offline fallback stránka.
**Vstup pre Clauda**: "Implementuj F6-1 — PWA manifest a service worker"
- [ ] hotovo

### F6-2: Push notifikácie
**Súbory**: `src/lib/push.ts`, `src/app/api/push/route.ts`, `src/app/(app)/settings/notifications/page.tsx`
**Úloha**: V nastaveniach: tlačidlo "Povoliť notifikácie" → requestPermission → uloží subscription do Settings. `web-push` server-side. Cron `0 9 2 * *` → odošle push s textom "Čas zadať financie za [mesiac]". Klik → `/snapshots?month=YYYY-MM`.
**Vstup pre Clauda**: "Implementuj F6-2 — push notifikácie"
- [ ] hotovo

---

## Fáza 7 — Polish & deploy (1 session)

### F7-1: Seed skript
**Súbory**: `prisma/seed.ts`
**Úloha**: Vytvorí predvolené účty (Tatra BANK, Revolut BANK, Cash CASH, Conseq INVESTMENT, EIC INVESTMENT, XTB INVESTMENT, 2. pilier PENSION). Vytvorí predvolené income sources (JOJ, Zdravé Brusko, Iné). Importuje historické dáta z priloženého CSV (voliteľné).
**Vstup pre Clauda**: "Implementuj F7-1 — seed skript"
- [ ] hotovo

### F7-2: Dockerfile + docker-compose
**Súbory**: `Dockerfile`, `docker-compose.yml`, `.dockerignore`
**Úloha**: Multi-stage build (node:22-alpine). SQLite databáza na volume `/data/financie.db`. ENV premenné zo `.env`. Health check endpoint `/api/health`. Dokploy-ready.
**Vstup pre Clauda**: "Implementuj F7-2 — Docker setup"
- [ ] hotovo

### F7-3: ENV template + dokumentácia
**Súbory**: `ENV_TEMPLATE.md`, `README.md`
**Úloha**: Všetky povinné ENV premenné s popisom. Inštalačný postup (5 krokov). Troubleshooting sekcia.
**Vstup pre Clauda**: "Implementuj F7-3 — ENV template a README"
- [ ] hotovo

---

## Backlog / V2 (nerieš teraz)

- [ ] Open Banking sync pre Tatra a Revolut
- [ ] CSV import z Conseq / EIC exportu
- [ ] XTB xStation WebSocket integrácia
- [ ] Export do PDF / Excel
- [ ] Rozpočet modul (plánované vs skutočné výdavky)
- [ ] Cieľové sporenie (napr. "Emergency fund: 10k€ do Dec 2026")
- [ ] Daňový report (dividendy, realizované zisky pre daňové priznanie)
