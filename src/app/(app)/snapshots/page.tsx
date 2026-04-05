import { redirect } from 'next/navigation'

type SnapshotsIndexPageProps = {
  searchParams?: Promise<{
    month?: string
  }>
}

function toMonthKeyInUtc(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function isValidMonthKey(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)
}

export default async function SnapshotsIndexPage({ searchParams }: SnapshotsIndexPageProps) {
  const params = (await searchParams) ?? {}
  const requestedMonth = params.month

  if (isValidMonthKey(requestedMonth)) {
    redirect(`/snapshots/${requestedMonth}`)
  }

  const now = new Date()
  const currentMonth = toMonthKeyInUtc(now)
  redirect(`/snapshots/${currentMonth}`)
}
