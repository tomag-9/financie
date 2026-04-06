# Financie

Self-hosted osobna appka na mesacne sledovanie financii (ucty, prijmy, investicie, zavazky).

## Stack
- Next.js App Router + TypeScript
- Prisma + SQLite
- NextAuth credentials + TOTP
- Tailwind CSS
- Recharts
- web-push + service worker

## Lokalny development
1. Nainstaluj dependencies:

```bash
npm install
```

2. Vytvor env subor:

```bash
cp ENV_TEMPLATE.md .env.local
```

3. Nastav `DATABASE_URL` (napr. `file:./financie.db`) a dopln tajne hodnoty.

4. Aplikuj migracie:

```bash
npx prisma migrate deploy
```

5. Napln DB seed datami:

```bash
npm run db:seed
```

6. Spusti appku:

```bash
npm run dev
```

## Seed poznamky
- Seed je idempotentny pre mutable data (upravi existujuce records, nevytvara stale nove).
- Seed normalizuje month na UTC prvy den mesiaca.
- Pri prvom seede sa nacita `ADMIN_PASSWORD` a ulozi sa jeho hash do `Settings.data.password_hash`.

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

## PWA a push
- Manifest: `public/manifest.json`
- Service worker: `public/sw.js`
- SW sa registruje v root layoute.
- Push subscription endpoint: `POST /api/push`
- Cron trigger endpoint: `POST /api/cron`
  - ak je nastaveny `CRON_SECRET`, posli `Authorization: Bearer <CRON_SECRET>`

## Utility prikazy

```bash
npm run lint
npm run build
npx prisma studio
```
