# ENV Template

Skopíruj do `.env.local` a vyplň hodnoty.

```bash
# ─── NextAuth ──────────────────────────────────────────────────────────────
# Vygeneruj: openssl rand -base64 32
AUTH_SECRET=VYGENERUJ_NAHODNY_STRING_32_ZNAKOV

# URL tvojej appky (bez trailing slash)
NEXTAUTH_URL=https://financie.tvoja-domena.sk

# ─── Databáza ──────────────────────────────────────────────────────────────
# SQLite cesta — v Dockeri bude /data/financie.db
DATABASE_URL="file:./financie.db"

# ─── Admin heslo (prvý login) ──────────────────────────────────────────────
# Toto sa použije v seed skripte na vytvorenie bcrypt hashu
# Po prvom logine toto môžeš z .env odstrániť
ADMIN_PASSWORD=zmen_ma_na_silne_heslo

# ─── Web Push (PWA notifikácie) ────────────────────────────────────────────
# Vygeneruj: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=tvoj_vapid_public_key
VAPID_PRIVATE_KEY=tvoj_vapid_private_key
VAPID_EMAIL=mailto:tomas@example.com

# ─── Market Data (voliteľné) ───────────────────────────────────────────────
# Alpha Vantage free API key: https://www.alphavantage.co/support/#api-key
# Nie je povinné — yahoo-finance2 funguje aj bez kľúča
ALPHA_VANTAGE_KEY=volitelne

# ─── App config ────────────────────────────────────────────────────────────
# Cron notifikácie — zapni v produkcii
ENABLE_CRON=true

# Default savings rate cieľ (%)
DEFAULT_SAVINGS_TARGET=20
```

## Ako vygenerovať hodnoty

```bash
# AUTH_SECRET
openssl rand -base64 32

# VAPID kľúče pre push notifikácie
npx web-push generate-vapid-keys
```

## Docker / Dokploy env

V Dokploy nastav tieto premenné cez Environment UI (nie .env súbor):
- `DATABASE_URL=file:/data/financie.db`
- Všetky ostatné z vyššie

Volume mount: `/data` → persistentný storage pre SQLite.
