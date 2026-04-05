# Archív technických rozhodnutí

## Prečo Next.js API routes a nie samostatný Go backend
Jeden repozitár, jeden deploy, žiadna CORS konfigurácia. Pre single-user personal app
je operačný overhead Go separátneho servera nevýhodný. Go sa oplatí ak chceme
single binary bez Node runtime, alebo ak máme veľmi obmedzený RAM (≤256MB).
Naša Dokploy inštancia má dosť. **Prehodnoť pri V2 ak bude potrebná real-time funkcia.**

## Prečo SQLite a nie PostgreSQL
Nulová konfigurácia, záloha = jeden `cp` príkaz, Prisma to zvláda rovnako.
Postgres je overkill pre <1 používateľa a <50k riadkov. SQLite WAL mode je dostatočne
rýchly. **Prisma umožní migráciu na Postgres zmenou jedného riadku v schema.prisma.**

## Prečo TOTP a nie Passkeys
TOTP sa implementuje za 2 hodiny (otplib + QR kód). Passkeys vyžadujú správu
recovery kľúčov a WebAuthn server logic (~1 deň). Pre self-hosted single-user app
je TOTP bezpečnostne ekvivalentné. Passkeys sú v backlogu ako V2 upgrade.

## Prečo yahoo-finance2 a nie oficiálne API
Conseq/EIC nemajú verejné API vôbec. Yahoo Finance neoficiálne API funguje
spoľahlivo pre ETF/akcie ceny. Alpha Vantage free tier (25 req/deň) je backup.
**Cache 6 hodín v SQLite znižuje počet requestov na minimum.**

## Prečo Prisma a nie raw SQL / Drizzle
Prisma schema-first prístup: jedna definícia = migrácie + TS typy + validácia.
`prisma studio` dáva GUI na priame prezeranie dát bez externého nástroja.
Drizzle je rýchlejší ale menej "batteries included". **Pre tento projekt developer
experience > runtime performance.**

## Snapshot model — prečo null balance je OK
Tomi občas nemá všetky čísla v rovnaký deň. Partial snapshot je lepší ako
žiadny snapshot. Dashboard počíta null ako 0 pri súčtoch, ale zobrazuje
"nezadané" vizuálne odlišne. Dátová integrita > user convenience.

## JOJ modul — separátna tabuľka
JojDetail je špeciálny prípad IncomeEntry — má extra polia (streamCount, ratePerStream,
diff). Namiesto generického JSON blob v IncomeEntry má vlastnú tabuľku.
Ľahšie sa dotazuje, ľahšie sa validuje, ľahšie sa zobrazí špeciálny formulár.

## Custom fields — JSON v note vs separátna tabuľka
Pre jednoduchosť V1: custom field hodnoty uložíme ako JSON blob v `Snapshot.note`.
Ak sa ukáže že treba full-text search alebo agregácie podľa custom pola, migrujeme
na `CustomFieldValue` tabuľku. **Toto rozhodnutie je reverzibilné.**

## Market data cache stratégia
Yahoo Finance rate limit nie je jasne zdokumentovaný. 6-hodinová cache v SQLite
(Settings.data alebo nová MarketCache tabuľka) zabraňuje throttlingu. Manuálny
refresh tlačidlo dáva kontrolu keď treba čerstvé dáta (napr. po veľkom pohybe trhu).
