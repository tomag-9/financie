# Návod: Ako pracovať s Claudom na tomto projekte

## Zlaté pravidlo — každá session začína rovnako

```
Prečítaj CLAUDE.md, TASKS.md a CALCULATIONS.md.
Potom implementuj [TASK ID] — [názov tasku].
```

Príklad:
```
Prečítaj CLAUDE.md, TASKS.md a CALCULATIONS.md.
Potom implementuj F2-2 — snapshot formulár.
```

Toto ušetrí 3–4 výmeny správ na "čo je projekt, čo sme robili" na začiatku každej session.

---

## Čo urobiť PO každom tasku

1. Zaškrtni task v `TASKS.md`: zmeň `- [ ]` na `- [x]`
2. Otestuj že appka beží: `npm run dev`
3. Commitni: `git commit -am "feat: F2-2 snapshot formulár"`
4. Ak bolo treba niečo zmeniť oproti plánu → zapíš do `DECISIONS.md`

---

## Keď task zahŕňa výpočty

Povedz Claudovi explicitne:
```
Prečítaj aj CALCULATIONS.md pred implementáciou [tasku].
```

CALCULATIONS.md obsahuje presné vzorce — bez neho Claude môže
implementovať TWRR alebo savings rate trochu inak.

---

## Keď chceš zmeniť schému

1. Uprav `prisma/schema.prisma`
2. Spusti `npx prisma migrate dev --name popis_zmeny`
3. Aktualizuj `CLAUDE.md` — sekciu "Databázová schéma"
4. Ak zmena ovplyvní výpočty → aktualizuj `CALCULATIONS.md`

---

## Veľkosť taskov — pravidlo

Každý task by mal zabrať **jednu konverzáciu** (≈ 10–20 správ).
Ak task trvá dlhšie → rozdeľ ho na podtasky a zaznač do TASKS.md.

---

## Keď narazíš na chybu

Skopíruj chybu do Clauda s kontextom:
```
Implementujem F3-2. Dostanem túto chybu pri ukladaní JOJ formulára:
[chyba]

Relevantné súbory: src/app/(app)/income/joj/page.tsx, src/app/api/income/joj/route.ts
```

---

## Štruktúra git commitov

```
feat: F2-2 snapshot formulár
fix: F2-2 oprava null balance validation
refactor: F3-1 presun income výpočtov do lib/calculations
docs: aktualizácia TASKS.md po F3-2
```

---

## Fázy a ich závislosti

```
F0 (setup) → F1 (auth) → F2 (accounts/snapshots) → F2-4 (dashboard)
                       ↘ F3 (income/JOJ) → F3-3 (savings rate)
                       ↘ F4 (investície) → F4-4 (TWRR stats)
                       ↘ F5 (záväzky)
F2 + F3 + F4 + F5 → F6 (PWA/push) → F7 (deploy)
```

F1 musí byť hotová pred všetkým ostatným (auth middleware).
F2-1 pred F2-2 (musíš mať účty pred snapshotmi).
Ostatné fázy môžeš robiť paralelne.
