import { NextResponse } from 'next/server'

const LOCATION_LABEL = 'Bratislava, Slovakia'

export async function GET() {
  const now = new Date()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return NextResponse.json({
    now: now.toISOString(),
    timeZone,
    location: LOCATION_LABEL,
  })
}
