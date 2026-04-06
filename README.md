# Financie

Self-hosted osobna appka na mesacne sledovanie financii (ucty, prijmy, investicie, zavazky).

## Stack
- Next.js App Router + TypeScript
- Prisma + SQLite
- NextAuth credentials + TOTP
- Tailwind CSS
- Recharts
- web-push + service worker

## Co aplikacia robi
- Mesacne snapshots uctov a net worth.
- Evidencia prijmov, JOJ detailov, investicii a zavazkov.
- PWA instalacia, offline fallback a push pripomienky.

## Rychly start
1. Naklonuj repo a nainstaluj dependencies.

```bash
npm install
```

2. Skopiruj env template.

```bash
cp ENV_TEMPLATE.md .env.local
```

3. Vypln povinne hodnoty v `.env.local`.

4. Spusti migracie a seed.

```bash
npx prisma migrate deploy
npm run db:seed
```

5. Spusti aplikaciu.

```bash
npm run dev
```

## Lokalny development
Ak chces ist krok po kroku, postupuj podla sekcie Rychly start.

## Seed poznamky
- Seed je idempotentny pre mutable data (upravi existujuce records, nevytvara stale nove).
- Seed normalizuje month na UTC prvy den mesiaca.
- Pri prvom seede sa nacita `ADMIN_PASSWORD` a ulozi sa jeho hash do `Settings.data.password_hash`.

## Environment
Povinne minimalne:
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `ADMIN_PASSWORD`

PWA a push:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

Volitelne:
- `ALPHA_VANTAGE_KEY`
- `ENABLE_CRON`
- `CRON_SECRET`
- `DEFAULT_SAVINGS_TARGET`

## Produkcny deploy (Docker / Dokploy)

### Build a run cez Docker Compose

```bash
docker compose up -d --build
```

Compose automaticky:
- mountne persistent volume na `/data`
- pouzije `DATABASE_URL=file:/data/financie.db`
- pred startom appky spusti `prisma migrate deploy`

### Dokploy odporucanie
- Source: tento repo
- Build: `Dockerfile`
- Persistent volume: mount na `/data`
- Env: nastav v UI (necommituj `.env.local`)

## Troubleshooting
- Ak login hlasi missing password, skontroluj `ADMIN_PASSWORD` a znovu spusti seed.
- Ak push notifikacie neidu, skontroluj VAPID kluce a ci ma prehliadac povolene notifikacie.
- Ak Docker start padne na migracii, over `DATABASE_URL=file:/data/financie.db` a ci je volume pripojene.
- Ak aplikacia nevie najst DB lokalne, skontroluj, ze sqlite subor existuje po migracii.

## PWA a push
- Manifest: `public/manifest.json`
- Service worker: `public/sw.js`
- SW sa registruje v root layoute.
- Push subscription endpoint: `POST /api/push`
- Cron trigger endpoint: `POST /api/cron`
  - ak je nastaveny `CRON_SECRET`, posli `Authorization: Bearer <CRON_SECRET>`
- Health check endpoint: `GET /api/health`

## Utility prikazy

```bash
npm run lint
npm run build
npx prisma studio
```
