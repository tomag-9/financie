import cron from 'node-cron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '@/lib/prisma'

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

async function runCommand(command: string): Promise<void> {
  await execAsync(command, { timeout: 120_000 })
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
        await runCommand(command)
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
      await prisma.aiAlarm.update({
        where: { id: alarm.id },
        data: {
          lastTriggeredAt: now,
          isEnabled: alarm.isRepeat ? alarm.isEnabled : false,
        },
      })
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
