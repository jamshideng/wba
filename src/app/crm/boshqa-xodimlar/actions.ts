'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, summaOqi, sanaOqi, telefonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'

const YOL = '/crm/boshqa-xodimlar'

/** Formadan: ism, lavozim, telefon, oylik (bo'sh — belgilanmagan), ishga kirgan sana, izoh. */
function oqi(fd: FormData) {
  const ism = matn(fd.get('ism'))
  const lavozim = matn(fd.get('lavozim'))
  const telefon = telefonOqi(fd.get('telefon'))
  const oylikXom = matn(fd.get('oylik'))
  const oylik = oylikXom ? summaOqi(oylikXom) : null
  const sanaXom = matn(fd.get('ishga_kirgan'))
  const ishga_kirgan = sanaXom ? sanaOqi(sanaXom) : null

  const xato =
    !ism ? 'Ismini yozing.' :
    !lavozim ? 'Lavozimini yozing (masalan: Farrosh).' :
    telefon === undefined ? 'Telefon noto‘g‘ri. Masalan: 90 123 45 67' :
    oylikXom && !oylik ? 'Oylik noto‘g‘ri. Masalan: 2000000 yoki 2 mln.' :
    sanaXom && !ishga_kirgan ? 'Sana noto‘g‘ri.' :
    null
  return {
    xato,
    qator: { ism: ism!, lavozim: lavozim!, telefon: telefon ?? null, oylik, ishga_kirgan, izoh: matn(fd.get('izoh')) },
  }
}

export async function xodimQosh(fd: FormData) {
  await talabRol('admin', 'direktor')
  const { xato, qator } = oqi(fd)
  if (xato) redirect(xabarliYol(YOL, { xato }))

  const supabase = await createClient()
  const { error } = await supabase.from('boshqa_xodimlar').insert(qator)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(YOL, { ok: `${qator.ism} qo‘shildi.` }))
}

export async function xodimTahrir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = Number(fd.get('id'))
  if (!Number.isInteger(id) || id <= 0) redirect(YOL)
  const { xato, qator } = oqi(fd)
  if (xato) redirect(xabarliYol(YOL, { xato }))
  const holat = fd.get('holat') === 'ketgan' ? 'ketgan' : 'faol'

  const supabase = await createClient()
  const { error } = await supabase
    .from('boshqa_xodimlar')
    .update({ ...qator, holat, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) redirect(xabarliYol(YOL, { xato: xatoMatni(error) }))

  revalidatePath(YOL)
  redirect(xabarliYol(YOL, { ok: `${qator.ism} saqlandi.` }))
}
