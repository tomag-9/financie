import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{
    month: string
  }>
}

export default async function InvestmentsMonthPage({ params }: PageProps) {
  const resolved = await params
  redirect(`/investments?month=${resolved.month}`)
}
