import cron from 'node-cron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/push'

const execAsync = promisify(exec)

const globalForScheduler = globalThis as unknown as {
  aiAlarmSchedulerStarted?: boolean
}

const DEFAULT_CLAUDE_COMMAND = 'docker exec -i claude-cli claude -p "Say, hello"'
const DEFAULT_CODEX_COMMAND = 'docker exec -i codex-cli codex -p "Say, hello"'

function timeKey(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

function isSameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function daysToSet(value: string | null): Set<number> {
  if (!value) return new Set()
  return new Set(
    value
      .split(',')
      .map((part) => Number(part))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  )
}

function wasTriggeredThisMinute(lastTriggeredAt: Date | null, now: Date): boolean {
  if (!lastTriggeredAt) return false
  return isSameLocalDate(lastTriggeredAt, now) && timeKey(lastTriggeredAt) === timeKey(now)
}

function formatBratislavaTime(date: Date): string {
  return new Intl.DateTimeFormat('sk-SK', {
    timeZone: 'Europe/Bratislava',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildTargetLabel(runClaude: boolean, runCodex: boolean): string {
  if (runClaude && runCodex) return 'Claude + Codex'
  if (runClaude) return 'Claude'
  if (runCodex) return 'Codex'
  return 'AI'
}

async function runCommand(command: string): Promise<void> {
  await execAsync(command, { timeout: 120_000 })
}

function normalizeCommand(command: string): string {
  const trimmed = command.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

async function runDueAlarms() {
  const now = new Date()
  const currentTime = timeKey(now)

  const alarms = await prisma.aiAlarm.findMany({
    where: {
      isEnabled: true,
      time: currentTime,
    },
  })

  console.info('[ai-alarm] tick', {
    now: now.toISOString(),
    currentTime,
    dueCount: alarms.length,
  })

  for (const alarm of alarms) {
    if (wasTriggeredThisMinute(alarm.lastTriggeredAt, now)) continue
    if (!alarm.runClaude && !alarm.runCodex) continue

    if (alarm.isRepeat) {
      const days = daysToSet(alarm.days)
      if (days.size === 0 || !days.has(now.getDay())) continue
    } else if (alarm.date && !isSameLocalDate(alarm.date, now)) {
      continue
    }

    const commands: string[] = []
    if (alarm.runClaude) {
      commands.push(process.env.CLAUDE_ALARM_COMMAND ?? DEFAULT_CLAUDE_COMMAND)
    }
    if (alarm.runCodex) {
      commands.push(process.env.CODEX_ALARM_COMMAND ?? DEFAULT_CODEX_COMMAND)
    }

    let didAttempt = false
    for (const command of commands) {
      console.info('[ai-alarm] sending command to container', {
        alarmId: alarm.id,
        label: alarm.label,
        command,
      })
      try {
        didAttempt = true
        await runCommand(normalizeCommand(command))
      } catch (error) {
        console.error('[ai-alarm] command failed', {
          alarmId: alarm.id,
          label: alarm.label,
          command,
          error: error instanceof Error ? error.message : error,
        })
      }
    }

    if (didAttempt) {
      console.info('[ai-alarm] commands completed', {
        alarmId: alarm.id,
        label: alarm.label,
      })

      const runTime = formatBratislavaTime(now)
      const closeTime = formatBratislavaTime(new Date(now.getTime() + 5 * 60 * 60 * 1000))
      const targetLabel = buildTargetLabel(alarm.runClaude, alarm.runCodex)
      const title = alarm.label ? `Alarm: ${alarm.label}` : 'AI alarm ran'
      const body = `Alarm ran on ${targetLabel} at ${runTime}. Window closes at ${closeTime}.`

      console.info('[ai-alarm] sending push notification', {
        alarmId: alarm.id,
        label: alarm.label,
      })

      const pushOk = await sendPushNotification({
        title,
        body,
        url: '/ai-alarm',
      })

      if (pushOk) {
        console.info('[ai-alarm] push notification sent', {
          alarmId: alarm.id,
          label: alarm.label,
        })
      } else {
        console.warn('[ai-alarm] push notification not sent', {
          alarmId: alarm.id,
          label: alarm.label,
        })
      }

      try {
        await prisma.aiAlarm.update({
          where: { id: alarm.id },
          data: {
            lastTriggeredAt: now,
            isEnabled: alarm.isRepeat ? alarm.isEnabled : false,
          },
        })
        console.info('[ai-alarm] alarm updated', {
          alarmId: alarm.id,
          label: alarm.label,
        })
      } catch (error) {
        console.error('[ai-alarm] failed to update alarm', {
          alarmId: alarm.id,
          label: alarm.label,
          error: error instanceof Error ? error.message : error,
        })
      }
    }
  }
}

export function startAiAlarmScheduler(): void {
  if (globalForScheduler.aiAlarmSchedulerStarted) return
  globalForScheduler.aiAlarmSchedulerStarted = true

  console.info('[ai-alarm] scheduler started')

  cron.schedule('* * * * *', () => {
    void runDueAlarms().catch(() => {
      // Ignore scheduler errors to avoid crashing the server.
    })
  })
}
