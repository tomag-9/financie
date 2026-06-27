import cron from 'node-cron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAiAlarmSuccessPushEnabled, getSettingsData, sendPushNotification } from '@/lib/push'

const execAsync = promisify(exec)

const globalForScheduler = globalThis as unknown as {
  aiAlarmSchedulerStarted?: boolean
  aiAlarmSchedulerTask?: ReturnType<typeof cron.schedule>
  aiAlarmSchedulerLastTickAt?: Date
  aiAlarmSchedulerTickCount?: number
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

function startOfMinute(date: Date): Date {
  const copy = new Date(date)
  copy.setSeconds(0, 0)
  return copy
}

function minutesBetween(startExclusive: Date, endInclusive: Date): Date[] {
  const minutes: Date[] = []
  const cursor = startOfMinute(new Date(startExclusive.getTime() + 60_000))
  const end = startOfMinute(endInclusive)

  while (cursor.getTime() <= end.getTime()) {
    minutes.push(new Date(cursor))
    cursor.setMinutes(cursor.getMinutes() + 1)
  }

  return minutes
}

function getTickWindow(now: Date): { start: Date; end: Date } {
  const previousTickAt = globalForScheduler.aiAlarmSchedulerLastTickAt
  return {
    start: previousTickAt ?? new Date(now.getTime() - 10 * 60 * 1000),
    end: now,
  }
}

async function findDueAlarmsForMinute(minute: Date) {
  const currentTime = timeKey(minute)
  const currentDate = new Date(minute)

  return prisma.aiAlarm.findMany({
    where: {
      isEnabled: true,
      time: currentTime,
      OR: [
        {
          isRepeat: true,
        },
        {
          isRepeat: false,
          date: {
            gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
            lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1),
          },
        },
      ],
    },
  })
}

function isDueInMinute(alarm: { isRepeat: boolean; days: string | null; date: Date | null }, minute: Date): boolean {
  if (alarm.isRepeat) {
    const days = daysToSet(alarm.days)
    return days.size > 0 && days.has(minute.getDay())
  }

  if (!alarm.date) return false
  return isSameLocalDate(alarm.date, minute)
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

async function recordAppLog(entry: {
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  details?: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.appLog.create({
      data: {
        source: 'ai-alarm',
        level: entry.level,
        message: entry.message,
        details: entry.details ? (entry.details as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch (error) {
    console.error('[ai-alarm] failed to persist log entry', {
      error: error instanceof Error ? error.message : error,
      message: entry.message,
    })
  }
}

async function runDueAlarms() {
  const now = new Date()
  const settings = await getSettingsData()
  const successPushEnabled = getAiAlarmSuccessPushEnabled(settings)

  const { start, end } = getTickWindow(now)
  const minutes = minutesBetween(start, end)
  const seenAlarmIds = new Set<string>()

  const tickIndex = (globalForScheduler.aiAlarmSchedulerTickCount ?? 0) + 1
  globalForScheduler.aiAlarmSchedulerTickCount = tickIndex

  console.info('[ai-alarm] tick start', {
    now: now.toISOString(),
    from: start.toISOString(),
    to: end.toISOString(),
  })
  await recordAppLog({
    level: 'info',
    message: 'Tick start',
    details: {
      now: now.toISOString(),
      from: start.toISOString(),
      to: end.toISOString(),
      tickIndex,
    },
  })

  if (tickIndex % 6 === 0) {
    console.info('[ai-alarm] tick window', {
      tickIndex,
      from: start.toISOString(),
      to: end.toISOString(),
      minuteCount: minutes.length,
    })
    await recordAppLog({
      level: 'debug',
      message: 'Hourly tick summary',
      details: {
        tickIndex,
        from: start.toISOString(),
        to: end.toISOString(),
        minuteCount: minutes.length,
      },
    })
  }

  for (const minute of minutes) {
    const alarms = await findDueAlarmsForMinute(minute)

    for (const alarm of alarms) {
      if (seenAlarmIds.has(alarm.id)) continue
      if (alarm.lastTriggeredAt && alarm.lastTriggeredAt >= minute) continue
      if (!alarm.runClaude && !alarm.runCodex) continue
      if (!isDueInMinute(alarm, minute)) continue

      seenAlarmIds.add(alarm.id)

      const commands: string[] = []
      if (alarm.runClaude) {
        commands.push(process.env.CLAUDE_ALARM_COMMAND ?? DEFAULT_CLAUDE_COMMAND)
      }
      if (alarm.runCodex) {
        commands.push(process.env.CODEX_ALARM_COMMAND ?? DEFAULT_CODEX_COMMAND)
      }

      const commandErrors: string[] = []
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
          const errorMessage = error instanceof Error ? error.message : String(error)
          commandErrors.push(errorMessage)
          console.error('[ai-alarm] command failed', {
            alarmId: alarm.id,
            label: alarm.label,
            command,
            error: errorMessage,
          })
        }
      }

      if (didAttempt) {
        console.info('[ai-alarm] commands completed', {
          alarmId: alarm.id,
          label: alarm.label,
        })
        const targetLabel = buildTargetLabel(alarm.runClaude, alarm.runCodex)
        await recordAppLog({
          level: 'info',
          message: 'Commands completed',
          details: {
            alarmId: alarm.id,
            label: alarm.label,
            minute: minute.toISOString(),
            targetLabel,
            commandCount: commands.length,
          },
        })

        if (commandErrors.length === 0 && successPushEnabled) {
          const runTime = formatBratislavaTime(minute)
          const closeTime = formatBratislavaTime(new Date(minute.getTime() + 5 * 60 * 60 * 1000))
          const title = alarm.label ? `Alarm: ${alarm.label}` : 'AI alarm ran'
          const body = `Alarm ran on ${targetLabel} at ${runTime}. Window closes at ${closeTime}.`

          console.info('[ai-alarm] sending push notification', {
            alarmId: alarm.id,
            label: alarm.label,
          })

          const pushOk = await sendPushNotification({
            title,
            body,
            url: '/ai-runner',
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
        } else if (commandErrors.length > 0) {
          const title = alarm.label ? `AI alarm error: ${alarm.label}` : 'AI alarm error'
          const body = `Alarm failed on ${targetLabel}. Check logs.`

          console.info('[ai-alarm] sending error push notification', {
            alarmId: alarm.id,
            label: alarm.label,
            errors: commandErrors.length,
          })
          await recordAppLog({
            level: 'error',
            message: 'Command execution failed',
            details: {
              alarmId: alarm.id,
              label: alarm.label,
              minute: minute.toISOString(),
              targetLabel,
              errors: commandErrors,
            },
          })

          const pushOk = await sendPushNotification({
            title,
            body,
            url: '/ai-runner',
          })

          if (pushOk) {
            console.info('[ai-alarm] error push notification sent', {
              alarmId: alarm.id,
              label: alarm.label,
            })
            await recordAppLog({
              level: 'warn',
              message: 'Error push sent',
              details: {
                alarmId: alarm.id,
                label: alarm.label,
                minute: minute.toISOString(),
                targetLabel,
              },
            })
          } else {
            console.warn('[ai-alarm] error push notification not sent', {
              alarmId: alarm.id,
              label: alarm.label,
            })
            await recordAppLog({
              level: 'warn',
              message: 'Error push not sent',
              details: {
                alarmId: alarm.id,
                label: alarm.label,
                minute: minute.toISOString(),
                targetLabel,
              },
            })
          }
        }

        try {
          await prisma.aiAlarm.update({
            where: { id: alarm.id },
            data: {
              lastTriggeredAt: minute,
              isEnabled: alarm.isRepeat ? alarm.isEnabled : false,
            },
          })
          console.info('[ai-alarm] alarm updated', {
            alarmId: alarm.id,
            label: alarm.label,
          })
          await recordAppLog({
            level: 'info',
            message: 'Alarm updated',
            details: {
              alarmId: alarm.id,
              label: alarm.label,
              minute: minute.toISOString(),
              isRepeat: alarm.isRepeat,
            },
          })
        } catch (error) {
          console.error('[ai-alarm] failed to update alarm', {
            alarmId: alarm.id,
            label: alarm.label,
            error: error instanceof Error ? error.message : error,
          })
          await recordAppLog({
            level: 'error',
            message: 'Failed to update alarm',
            details: {
              alarmId: alarm.id,
              label: alarm.label,
              minute: minute.toISOString(),
              error: error instanceof Error ? error.message : String(error),
            },
          })
        }
      }
    }
  }

  globalForScheduler.aiAlarmSchedulerLastTickAt = now

  console.info('[ai-alarm] tick end', {
    now: now.toISOString(),
    processedMinutes: minutes.length,
  })
  await recordAppLog({
    level: 'info',
    message: 'Tick end',
    details: {
      now: now.toISOString(),
      processedMinutes: minutes.length,
      tickIndex,
    },
  })
}

export function startAiAlarmScheduler(): void {
  if (globalForScheduler.aiAlarmSchedulerStarted) return

  const task = cron.schedule('*/10 * * * *', () => {
    void runDueAlarms().catch(async (error) => {
      console.error('[ai-alarm] scheduler tick failed', {
        error: error instanceof Error ? error.message : error,
      })
      await recordAppLog({
        level: 'error',
        message: 'Scheduler tick failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      })

      try {
        await sendPushNotification({
          title: 'AI alarm error',
          body: 'AI timer crashed. Check logs.',
          url: '/ai-runner',
        })
        await recordAppLog({
          level: 'warn',
          message: 'Scheduler error push sent',
        })
      } catch (pushError) {
        console.error('[ai-alarm] failed to send scheduler error push', {
          error: pushError instanceof Error ? pushError.message : pushError,
        })
        await recordAppLog({
          level: 'error',
          message: 'Scheduler error push failed',
          details: {
            error: pushError instanceof Error ? pushError.message : String(pushError),
          },
        })
      }
    })
  })

  globalForScheduler.aiAlarmSchedulerStarted = true
  globalForScheduler.aiAlarmSchedulerTask = task
  console.info('[ai-alarm] scheduler started')
}

export async function stopAiAlarmScheduler(): Promise<void> {
  const task = globalForScheduler.aiAlarmSchedulerTask
  if (!task) {
    globalForScheduler.aiAlarmSchedulerStarted = false
    return
  }

  task.stop()
  task.destroy()
  globalForScheduler.aiAlarmSchedulerTask = undefined
  globalForScheduler.aiAlarmSchedulerStarted = false
  console.info('[ai-alarm] scheduler stopped')
}

export async function syncAiAlarmScheduler(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.info('[ai-alarm] scheduler sync skipped: missing DATABASE_URL')
    return
  }

  const enabledCount = await prisma.aiAlarm.count({ where: { isEnabled: true } })

  if (enabledCount > 0) {
    startAiAlarmScheduler()
    return
  }

  await stopAiAlarmScheduler()
}
