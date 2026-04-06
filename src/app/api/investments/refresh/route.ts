import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  void request
  return NextResponse.json(
    { error: 'Market refresh is disabled in this simplified investment mode.' },
    { status: 410 },
  )
}
