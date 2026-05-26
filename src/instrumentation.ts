import { syncAiAlarmScheduler } from '@/lib/ai-alarm-scheduler'

export async function register(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.info('[ai-alarm] instrumentation skipped: missing DATABASE_URL')
    return
  }

  try {
    await syncAiAlarmScheduler()
  } catch (error) {
    console.error('[ai-alarm] instrumentation sync failed', {
      error: error instanceof Error ? error.message : error,
    })
  }
}