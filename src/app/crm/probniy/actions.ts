'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { talabProfil } from '@/lib/auth'
import { xabarliYol, xatoMatni } from '@/lib/kiritish'
import { html, xabar, HISOBOT_GURUH } from '@/lib/telegram'

const xabarYoqilgan = () => process.env.VERCEL_ENV === 'production'
const SAYT = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wbalc.uz'

/** Probniy: "Guruhga yozilmoqchiman" — lidga belgi (0102), xodimlarga Telegram xabar. */
export async function probniyYozilmoqchi() {
  const profil = await talabProfil()
  const yol = '/crm/probniy'
  if (profil.rol !== 'probniy') redirect(yol)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('probniy_yozilmoqchi')
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  const l: { ism?: string; telefon?: string; guruh?: string | null } = data ?? {}
  if (xabarYoqilgan()) after(async () => {
    await xabar(
      Number(HISOBOT_GURUH),
      [
        '<b>[SAYT] PROBNIY — guruhga yozilmoqchi</b>',
        `${html(l.ism ?? '')} · ${html(l.telefon ?? '')}`,
        l.guruh ? `Guruh: ${html(l.guruh)}` : '',
        `Lidlar: ${SAYT}/crm/lidlar`,
      ].filter(Boolean).join('\n'),
    )
  })

  revalidatePath(yol)
  redirect(xabarliYol(yol, { ok: 'So‘rovingiz yuborildi! Administrator tez orada siz bilan bog‘lanadi.' }))
}
