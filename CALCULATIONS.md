# Špecifikácia výpočtov

Tento súbor slúži ako referencia pre `src/lib/calculations.ts`.
Claude si ho prečíta pred implementáciou aby sa vyhol chybám.

---

## Net worth

```
netWorth(month) = SUM(snapshot.balance WHERE account.isActive = true AND snapshot.month = month AND balance IS NOT NULL)

netWorthAfterLiabilities(month) = netWorth(month) - SUM(liability.remaining WHERE liability.isActive = true)

monthlyDelta(month) = netWorth(month) - netWorth(previousMonth)

monthlyDeltaPct(month) = monthlyDelta(month) / netWorth(previousMonth) * 100
```

---

## Zárobky & savings rate

```
totalIncome(month) = SUM(incomeEntry.amount WHERE month = month)

totalInvested(month) = SUM(investmentEntry.amountAdded WHERE month = month)

savingsRate(month) = totalInvested(month) / totalIncome(month) * 100
  -- ak totalIncome = 0, vráť null (nie 0 ani Infinity)

savingsRateYTD(year) = SUM(totalInvested za rok) / SUM(totalIncome za rok) * 100
```

---

## JOJ výpočty

```
jojExpected(month) = jojDetail.streamCount * jojDetail.ratePerStream
                   + jojDetail.tvHonorar
                   + jojDetail.bonus

jojDiff(month) = jojDetail.receivedTotal - jojExpected(month)
  -- kladné = preplatok, záporné = nedoplatok
  -- alert ak Math.abs(diff) > 5 (EUR)

jojAvgStreams = AVG(streamCount) za všetky mesiace kde streamCount > 0

jojEurPerStream(month) = jojExpected(month) / streamCount
  -- len pre mesiace kde streamCount > 0
```

---

## Investície — TWRR (Time-Weighted Rate of Return)

TWRR eliminuje vplyv nových vkladov — meria čisto výkonnosť portfólia.

```
Pre každé obdobie medzi vkladmi:
  subPeriodReturn(i) = (endValue_i - beginValue_i - cashFlow_i) / (beginValue_i + cashFlow_i)

TWRR = PRODUCT(1 + subPeriodReturn_i for all i) - 1

Kde:
  endValue_i   = hodnota portfólia na konci obdobia i
  beginValue_i = hodnota portfólia na začiatku obdobia i  
  cashFlow_i   = čistý prílev/odlev hotovosti v období i (InvestmentEntry.amountAdded)
```

**Zjednodušená mesačná implementácia** (V1):
```typescript
function calculateTWRR(entries: MonthlyEntry[]): number {
  // entries: [{ month, portfolioValue, cashFlow }] zoradené podľa mesiaca
  let twrr = 1;
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const beginValue = prev.portfolioValue + curr.cashFlow; // adjustovaná základňa
    if (beginValue === 0) continue;
    const subReturn = curr.portfolioValue / beginValue;
    twrr *= subReturn;
  }
  return twrr - 1; // ako desatinné číslo, napr. 0.127 = 12.7%
}
```

---

## Hodnota portfólia

```
positionValue(investment) = investment.units * currentPrice(investment.ticker)
  -- currentPrice z market data cache

totalPortfolioValue = SUM(positionValue) pre všetky aktívne investície

unrealizedGain(investment) = positionValue - (investment.units * investment.avgPrice)
unrealizedGainPct(investment) = unrealizedGain / (investment.units * investment.avgPrice) * 100

totalCostBasis = SUM(investment.units * investment.avgPrice)
totalUnrealizedGain = totalPortfolioValue - totalCostBasis
```

---

## Priemer nákupnej ceny (average cost basis)

Pri každom novom nákupe:
```
newAvgPrice = (existingUnits * existingAvgPrice + newUnits * purchasePrice)
            / (existingUnits + newUnits)
```

---

## Zobrazovanie

Všetky sumy: `Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })`

Percentá: `value.toFixed(2) + ' %'` (medzera pred %)

TWRR: rovnaký formát ako percentá

Delta: prefix `+` ak kladné, `-` ak záporné, zafarbenie zelená/červená
