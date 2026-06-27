export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const { syncAiAlarmScheduler } = await import('@/lib/ai-alarm-scheduler')
  await syncAiAlarmScheduler()
}