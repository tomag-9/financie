import { redirect } from 'next/navigation'

function toMonthKeyInUtc(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export default function InvestmentsStatsPage() {
  redirect(`/investments/${toMonthKeyInUtc(new Date())}`)
}
