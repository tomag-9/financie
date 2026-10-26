import cron from 'node-cron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getAiAlarmErrorPushEnabled,
  getAiAlarmSuccessPushEnabled,
  getSettingsData,
  sendPushNotification,
} from '@/lib/push'

const execAsync = promisify(exec)

const globalForScheduler = globalThis as unknown as {
  aiAlarmSchedulerStarted?: boolean
  aiAlarmSchedulerTask?: ReturnType<typeof cron.schedule>
  aiAlarmSchedulerLastTickAt?: Date
  aiAlarmSchedulerTickCount?: number
}

const DEFAULT_CLAUDE_COMMAND =
  'docker exec -w /root ai-runner claude -p --model sonnet --output-format json "Reply with exactly RESET_OK"'
const DEFAULT_CODEX_COMMAND =
  'docker exec -w /root ai-runner codex --no-daemon exec --skip-git-repo-check --json "Reply with exactly RESET_OK"'

type CommandOutput = {
  body: string
}

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

function hasStructuredError(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false

  const entry = value as Record<string, unknown>
  const type = typeof entry.type === 'string' ? entry.type.toLowerCase() : ''
  const item = entry.item && typeof entry.item === 'object' ? (entry.item as Record<string, unknown>) : null
  const itemType = typeof item?.type === 'string' ? item.type.toLowerCase() : ''

  return (
    entry.is_error === true ||
    typeof entry.api_error === 'string' ||
    type === 'error' ||
    type === 'turn.failed' ||
    itemType === 'error'
  )
}

function getStructuredBody(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null

  const entry = value as Record<string, unknown>
  if (typeof entry.result === 'string' && entry.result.trim()) {
    return entry.result.trim()
  }

  if (entry.item && typeof entry.item === 'object') {
    const item = entry.item as Record<string, unknown>
    if (item.type === 'agent_message' && typeof item.text === 'string' && item.text.trim()) {
      return item.text.trim()
    }
  }

  return null
}

export function validateCommandOutput(stdout: string): CommandOutput {
  const output = stdout.trim()
  if (!output) {
    throw new Error('AI runner returned an empty response body.')
  }

  const lines = output.split(/\r?\n/).filter((line) => line.trim())
  const parsed: unknown[] = []
  let isStructured = true

  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line))
    } catch {
      isStructured = false
      break
    }
  }

  if (isStructured) {
    if (parsed.some(hasStructuredError)) {
      const errorBody = parsed.map(getStructuredBody).find(Boolean)
      throw new Error(errorBody ?? 'AI runner returned an error response.')
    }

    const body = parsed.map(getStructuredBody).find(Boolean)
    if (!body) {
      throw new Error('AI runner response did not contain a message body.')
    }

    return { body }
  }

  if (/^error\b|usage[_ ]limit|rate[_ ]limit|limit reached|you(?:'|’)ve hit your .*limit/im.test(output)) {
    throw new Error(output)
  }

  return { body: output }
}

async function runCommand(command: string): Promise<CommandOutput> {
  try {
    const { stdout } = await execAsync(command, { timeout: 120_000 })
    return validateCommandOutput(stdout)
  } catch (error) {
    const commandError = error as { message?: unknown; stderr?: unknown; stdout?: unknown }
    const stderr = typeof commandError.stderr === 'string' ? commandError.stderr.trim() : ''
    const stdout = typeof commandError.stdout === 'string' ? commandError.stdout.trim() : ''

    if (stdout) {
      try {
        return validateCommandOutput(stdout)
      } catch (outputError) {
        const outputMessage = outputError instanceof Error ? outputError.message : String(outputError)
        throw new Error(outputMessage)
      }
    }

    const output = stderr
    const message = typeof commandError.message === 'string' ? commandError.message : String(error)

    throw new Error(output ? `${message}: ${output}` : message)
  }
}

export async function runAlarmNow(alarmId: string): Promise<{ runId: string; status: string }> {
  const alarm = await prisma.aiAlarm.findUnique({ where: { id: alarmId } })
  if (!alarm) throw new Error('Alarm neexistuje.')
  if (!alarm.runClaude && !alarm.runCodex) throw new Error('Alarm nemá vybraný žiadny AI cieľ.')

  const targets = buildTargetLabel(alarm.runClaude, alarm.runCodex)
  const run = await prisma.aiAlarmRun.create({
    data: { alarmId: alarm.id, alarmLabel: alarm.label, trigger: 'manual', status: 'running', targets },
  })
  const responses: Array<{ target: string; body: string }> = []
  const errors: string[] = []
  const commands: Array<{ target: string; command: string }> = []
  if (alarm.runClaude) commands.push({ target: 'Claude', command: process.env.CLAUDE_ALARM_COMMAND ?? DEFAULT_CLAUDE_COMMAND })
  if (alarm.runCodex) commands.push({ target: 'Codex', command: process.env.CODEX_ALARM_COMMAND ?? DEFAULT_CODEX_COMMAND })

  for (const item of commands) {
    try {
      const response = await runCommand(normalizeCommand(item.command))
      responses.push({ target: item.target, body: response.body.slice(0, 2_000) })
    } catch (error) {
      errors.push(`${item.target}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const status = errors.length ? 'failed' : 'success'
  await prisma.$transaction([
    prisma.aiAlarmRun.update({ where: { id: run.id }, data: { status, output: responses as Prisma.InputJsonValue, error: errors.join('\n') || null, finishedAt: new Date() } }),
    prisma.aiAlarm.update({ where: { id: alarm.id }, data: { lastTriggeredAt: new Date() } }),
    prisma.appLog.create({ data: { source: 'ai-alarm', level: errors.length ? 'error' : 'info', message: errors.length ? 'Manual run failed' : 'Manual run succeeded', details: { alarmId, runId: run.id, targets, errors } as Prisma.InputJsonValue } }),
  ])
  return { runId: run.id, status }
}

function normalizeCommand(command: string): string {
  const trimmed = command.trim()
  let normalized = trimmed
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    normalized = trimmed.slice(1, -1)
  } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    normalized = trimmed.slice(1, -1)
  }

  // Alarm probes are unattended. Keeping stdin open can make Codex wait until
  // the command timeout even after it has produced a valid response.
  return normalized.replace(/^docker\s+exec\s+-i(?=\s)/, 'docker exec')
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
  const errorPushEnabled = getAiAlarmErrorPushEnabled(settings)

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

      let scheduledRun: { id: string }
      try {
        scheduledRun = await prisma.aiAlarmRun.create({
          data: {
            alarmId: alarm.id,
            alarmLabel: alarm.label,
            trigger: 'scheduled',
            status: 'running',
            targets: buildTargetLabel(alarm.runClaude, alarm.runCodex),
            scheduledFor: minute,
          },
          select: { id: true },
        })
      } catch (error) {
        // Claiming the occurrence before execution prevents duplicate workers
        // from running the same alarm minute twice.
        if ((error as { code?: string }).code === 'P2002') continue
        throw error
      }

      const commands: Array<{ target: 'Claude' | 'Codex'; command: string }> = []
      if (alarm.runClaude) {
        commands.push({
          target: 'Claude',
          command: process.env.CLAUDE_ALARM_COMMAND ?? DEFAULT_CLAUDE_COMMAND,
        })
      }
      if (alarm.runCodex) {
        commands.push({
          target: 'Codex',
          command: process.env.CODEX_ALARM_COMMAND ?? DEFAULT_CODEX_COMMAND,
        })
      }

      const commandErrors: string[] = []
      const commandResponses: Array<{ target: string; body: string }> = []
      let didAttempt = false
      for (const { target, command } of commands) {
        console.info('[ai-alarm] sending command to container', {
          alarmId: alarm.id,
          label: alarm.label,
          target,
          command,
        })
        try {
          didAttempt = true
          const response = await runCommand(normalizeCommand(command))
          commandResponses.push({ target, body: response.body.slice(0, 2_000) })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          commandErrors.push(`${target}: ${errorMessage}`)
          console.error('[ai-alarm] command failed', {
            alarmId: alarm.id,
            label: alarm.label,
            target,
            command,
            error: errorMessage,
          })
        }
      }

      if (didAttempt) {
        const targetLabel = buildTargetLabel(alarm.runClaude, alarm.runCodex)

        await prisma.aiAlarmRun.update({
          where: { id: scheduledRun.id },
          data: {
            status: commandErrors.length ? 'failed' : 'success',
            output: commandResponses as Prisma.InputJsonValue,
            error: commandErrors.join('\n') || null,
            finishedAt: new Date(),
          },
        })

        if (commandErrors.length === 0) {
          console.info('[ai-alarm] reset verified', {
            alarmId: alarm.id,
            label: alarm.label,
            responses: commandResponses,
          })
          await recordAppLog({
            level: 'info',
            message: 'Reset verified',
            details: {
              alarmId: alarm.id,
              label: alarm.label,
              minute: minute.toISOString(),
              targetLabel,
              commandCount: commands.length,
              responses: commandResponses,
            },
          })
        }

        if (commandErrors.length === 0 && successPushEnabled) {
          const runTime = formatBratislavaTime(minute)
          const title = alarm.label ? `Reset OK: ${alarm.label}` : 'AI reset OK'
          const body = `${targetLabel} returned a valid response at ${runTime}.`

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

          console.info('[ai-alarm] command errors recorded', {
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

          if (errorPushEnabled) {
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
          } else {
            console.info('[ai-alarm] error push disabled', {
              alarmId: alarm.id,
              label: alarm.label,
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
        const settings = await getSettingsData()
        if (getAiAlarmErrorPushEnabled(settings)) {
          await sendPushNotification({
            title: 'AI alarm error',
            body: 'AI timer crashed. Check logs.',
            url: '/ai-runner',
          })
          await recordAppLog({
            level: 'warn',
            message: 'Scheduler error push sent',
          })
        }
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
