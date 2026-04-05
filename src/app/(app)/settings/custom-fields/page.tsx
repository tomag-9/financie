import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CustomFieldType } from '@/types'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ENTITY_TYPE = 'snapshot' as const
const FIELD_TYPES: CustomFieldType[] = ['TEXT', 'NUMBER', 'BOOLEAN']

function isValidFieldType(value: string): value is CustomFieldType {
  return FIELD_TYPES.includes(value as CustomFieldType)
}

async function ensureAuthenticated(): Promise<void> {
  const session = await auth()
  if (!session) {
    redirect('/login')
  }
}

async function addCustomFieldAction(formData: FormData): Promise<void> {
  'use server'

  await ensureAuthenticated()

  const label = String(formData.get('label') ?? '').trim()
  const rawFieldType = String(formData.get('fieldType') ?? '').trim().toUpperCase()

  if (!label || !isValidFieldType(rawFieldType)) {
    revalidatePath('/settings/custom-fields')
    return
  }

  const maxSort = await prisma.customField.aggregate({
    where: { entityType: ENTITY_TYPE },
    _max: { sortOrder: true },
  })

  await prisma.customField.create({
    data: {
      entityType: ENTITY_TYPE,
      label,
      fieldType: rawFieldType,
      isActive: true,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  })

  revalidatePath('/settings/custom-fields')
}

async function setCustomFieldActiveAction(formData: FormData): Promise<void> {
  'use server'

  await ensureAuthenticated()

  const id = String(formData.get('id') ?? '')
  const nextActive = String(formData.get('nextActive') ?? '') === 'true'

  if (!id) {
    revalidatePath('/settings/custom-fields')
    return
  }

  await prisma.customField.update({
    where: { id },
    data: { isActive: nextActive },
  })

  revalidatePath('/settings/custom-fields')
}

async function moveCustomFieldAction(formData: FormData): Promise<void> {
  'use server'

  await ensureAuthenticated()

  const id = String(formData.get('id') ?? '')
  const direction = String(formData.get('direction') ?? '').toLowerCase()

  if (!id || (direction !== 'up' && direction !== 'down')) {
    revalidatePath('/settings/custom-fields')
    return
  }

  const fields = await prisma.customField.findMany({
    where: { entityType: ENTITY_TYPE },
    select: { id: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })

  const currentIndex = fields.findIndex((field) => field.id === id)
  if (currentIndex < 0) {
    revalidatePath('/settings/custom-fields')
    return
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= fields.length) {
    revalidatePath('/settings/custom-fields')
    return
  }

  const reordered = [...fields]
  ;[reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]]

  await prisma.$transaction(
    reordered.map((field, index) =>
      prisma.customField.update({
        where: { id: field.id },
        data: { sortOrder: index },
      })
    )
  )

  revalidatePath('/settings/custom-fields')
}

export default async function SnapshotCustomFieldsPage() {
  await ensureAuthenticated()

  const fields = await prisma.customField.findMany({
    where: { entityType: ENTITY_TYPE },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Custom fields - snapshots</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Sprava vlastnych poli pre mesacny snapshot. Hodnoty sa budu ukladat ako JSON do Snapshot.note.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pridat pole</h3>
        <form action={addCustomFieldAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <input
            name="label"
            required
            placeholder="Nazov pola"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />

          <select
            name="fieldType"
            defaultValue="TEXT"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          >
            <option value="TEXT">TEXT</option>
            <option value="NUMBER">NUMBER</option>
            <option value="BOOLEAN">BOOLEAN</option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Pridat
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
          Existujuce polia
        </div>

        {fields.length === 0 ? (
          <p className="px-4 py-5 text-sm text-zinc-600 dark:text-zinc-300">Zatial nie su pridane ziadne custom fields.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {fields.map((field, index) => {
              const isFirst = index === 0
              const isLast = index === fields.length - 1

              return (
                <li key={field.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.label}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Typ: {field.fieldType} | Sort: {field.sortOrder} | Stav: {field.isActive ? 'aktivne' : 'neaktivne'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={moveCustomFieldAction}>
                      <input type="hidden" name="id" value={field.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={isFirst}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Hore
                      </button>
                    </form>

                    <form action={moveCustomFieldAction}>
                      <input type="hidden" name="id" value={field.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={isLast}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Dole
                      </button>
                    </form>

                    <form action={setCustomFieldActiveAction}>
                      <input type="hidden" name="id" value={field.id} />
                      <input type="hidden" name="nextActive" value={field.isActive ? 'false' : 'true'} />
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {field.isActive ? 'Deaktivovat' : 'Aktivovat'}
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
