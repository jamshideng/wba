'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, adminmi } from '@/lib/auth'
import { matn, sanaOqi, davrOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { bolimlarniOqi, ballOqi, type OylikTestTuri } from '@/lib/oylik-test'
import { oylikXabarYubor } from '@/lib/oylik-test-xabar'

const TURLAR: OylikTestTuri[] = ['foiz', 'ball', 'bolimlar', 'ielts']

/**
 * Guruhning shu oydagi testi: turi, maks ball yoki bo'limlar.
 * Huquqni RLS tekshiradi — ustoz faqat o'z guruhiga; e'lon qilingan
 * natijasi bor testni ustoz o'zgartirolmaydi (oylik_test_ozgardi, 0104).
 */
export async function testSaqla(fd: FormData) {
  await talabProfil()
  const guruh = matn(fd.get('group_id'))
  const davr = davrOqi(fd.get('davr'))
  const yol = `/crm/oylik-test/${guruh ?? ''}?davr=${davr ?? ''}`
  if (!guruh || !davr) redirect(xabarliYol('/crm/oylik-test', { xato: 'Guruh va oy kerak.' }))

  const turi = TURLAR.find((t) => t === fd.get('turi')) ?? 'ball'
  let maks: number | null = null
  let bolimlar: { nom: string; maks: number }[] = []

  if (turi === 'ball') {
    const m = ballOqi(fd.get('maks'))
    if (m === null || m === 'xato' || m <= 0) redirect(xabarliYol(yol, { xato: 'Testning maksimal balini yozing (masalan 40).' }))
    maks = m as number
  } else if (turi === 'bolimlar') {
    const b = bolimlarniOqi(
      fd.getAll('bolim_nom').map(String),
      fd.getAll('bolim_maks').map(String),
    )
    if (typeof b === 'string') redirect(xabarliYol(yol, { xato: b }))
    bolimlar = b as { nom: string; maks: number }[]
  }

  const supabase = await createClient()
  const { error } = await supabase.from('oylik_testlar').upsert(
    {
      group_id: guruh!,
      davr: davr!,
      sana: sanaOqi(fd.get('sana')),
      turi,
      maks,
      bolimlar,
      izoh: matn(fd.get('izoh')),
    },
    { onConflict: 'group_id,davr' },
  )
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/oylik-test')
  redirect(xabarliYol(yol, { ok: 'Test sozlamasi saqlandi. Endi natijalarni kiriting.' }))
}

/**
 * Natijalar — bir formada butun guruh. Har o'quvchi: kelmadi belgisi,
 * ball (yoki bo'lim ballari), izoh. Hech narsa yozilmagan va oldin
 * saqlanmagan o'quvchi o'tkazib yuboriladi. E'lon qilingan natijaga
 * ustoz tegolmaydi — ular yuborilmaydi (RLS baribir to'sadi).
 */
export async function natijalarSaqla(fd: FormData) {
  const profil = await talabProfil()
  const testId = matn(fd.get('test_id'))
  const yol = matn(fd.get('qaytish')) ?? '/crm/oylik-test'
  if (!testId) redirect(xabarliYol(yol, { xato: 'Test topilmadi.' }))

  const supabase = await createClient()
  const { data: test } = await supabase
    .from('oylik_testlar')
    .select('id, turi, bolimlar')
    .eq('id', testId!)
    .maybeSingle()
  if (!test) redirect(xabarliYol(yol, { xato: 'Test topilmadi yoki huquqingiz yo‘q.' }))

  const { data: bor } = await supabase
    .from('oylik_test_natijalar')
    .select('student_id, elon_qilingan')
    .eq('test_id', testId!)
  const borMap = new Map((bor ?? []).map((r) => [r.student_id as string, r.elon_qilingan as boolean]))
  const admin = adminmi(profil.rol)

  const bolimSoni = Array.isArray(test!.bolimlar) ? test!.bolimlar.length : 0
  type Qator = { test_id: string; student_id: string; keldi: boolean; ball: number | null; bolim_ballar: (number | null)[] | null; izoh: string | null }
  const qatorlar: Qator[] = []
  for (const sid of fd.getAll('student').map(String)) {
    if (borMap.get(sid) && !admin) continue // e'lon qilingan — faqat admin
    const kelmadi = fd.get(`kelmadi_${sid}`) === 'on'
    const izoh = matn(fd.get(`izoh_${sid}`))
    let ball: number | null = null
    let bolimBallar: (number | null)[] | null = null

    if (test!.turi === 'bolimlar' || test!.turi === 'ielts') {
      bolimBallar = []
      for (let i = 0; i < bolimSoni; i++) {
        const b = ballOqi(fd.get(`b_${sid}_${i}`))
        if (b === 'xato') redirect(xabarliYol(yol, { xato: 'Ball manfiy yoki noto‘g‘ri yozilgan.' }))
        bolimBallar.push(b as number | null)
      }
      if (bolimBallar.every((b) => b === null)) bolimBallar = null
    } else {
      const b = ballOqi(fd.get(`ball_${sid}`))
      if (b === 'xato') redirect(xabarliYol(yol, { xato: 'Ball manfiy yoki noto‘g‘ri yozilgan.' }))
      ball = b as number | null
    }

    const bosh = !kelmadi && ball === null && bolimBallar === null && !izoh
    if (bosh && !borMap.has(sid)) continue
    qatorlar.push({
      test_id: testId!,
      student_id: sid,
      keldi: !kelmadi,
      ball,
      bolim_ballar: bolimBallar,
      izoh,
    })
  }

  if (qatorlar.length === 0) redirect(xabarliYol(yol, { xato: 'Hech qanday natija yozilmadi.' }))

  const { error } = await supabase.from('oylik_test_natijalar').upsert(qatorlar, { onConflict: 'test_id,student_id' })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/oylik-test')
  redirect(xabarliYol(yol, { ok: `${qatorlar.length} ta natija saqlandi.` }))
}

/**
 * E'lon qilish yoki qaytarish — faqat admin, direktor, manager
 * (bazada oylik_natija_elon_qoidasi ham tekshiradi).
 *   kim = 'davr'   — shu oyning hamma natijasi
 *   kim = 'guruh'  — bitta guruh testi
 *   kim = 'natija' — bitta o'quvchi
 */
export async function elonQil(fd: FormData) {
  const profil = await talabProfil()
  const yol = matn(fd.get('qaytish')) ?? '/crm/oylik-test'
  if (!adminmi(profil.rol)) redirect(xabarliYol(yol, { xato: 'Natijani faqat admin e’lon qiladi.' }))

  const kim = matn(fd.get('kim'))
  const qaytar = fd.get('qaytar') === '1'
  const supabase = await createClient()

  let testIdlar: string[] = []
  if (kim === 'davr') {
    const davr = davrOqi(fd.get('davr'))
    if (!davr) redirect(xabarliYol(yol, { xato: 'Oy tanlanmagan.' }))
    const { data } = await supabase.from('oylik_testlar').select('id').eq('davr', davr!)
    testIdlar = (data ?? []).map((t) => t.id as string)
  } else if (kim === 'guruh') {
    const t = matn(fd.get('test_id'))
    if (t) testIdlar = [t]
  }

  let so = supabase
    .from('oylik_test_natijalar')
    .update({ elon_qilingan: !qaytar })
    .eq('elon_qilingan', qaytar)
  if (kim === 'natija') {
    const id = matn(fd.get('natija_id'))
    if (!id) redirect(xabarliYol(yol, { xato: 'Natija tanlanmagan.' }))
    so = so.eq('id', id!)
  } else {
    if (testIdlar.length === 0) redirect(xabarliYol(yol, { xato: 'E’lon qiladigan natija yo‘q.' }))
    so = so.in('test_id', testIdlar)
  }
  const { data, error } = await so.select('id')
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  // Saytdagi eslatmani trigger yozdi; telefon va Telegram — fonda
  if (!qaytar && data?.length) after(() => oylikXabarYubor(supabase, data.map((r) => r.id as string)))

  revalidatePath('/crm/oylik-test')
  const n = data?.length ?? 0
  redirect(xabarliYol(yol, { ok: qaytar ? `${n} ta natija e’londan olindi.` : `${n} ta natija e’lon qilindi — o‘quvchilar ko‘radi.` }))
}

/**
 * Bitta o'quvchi natijasini e'lon qilish / qaytarish — natijalar
 * jadvalidagi tugma (formAction). Natija id si va amal bog'langan
 * argument bilan keladi: React formAction tugmaning name/value sini
 * FormData'ga qo'shmaydi.
 */
export async function bittaElon(id: string, qaytar: boolean, fd: FormData) {
  const profil = await talabProfil()
  const yol = matn(fd.get('qaytish')) ?? '/crm/oylik-test'
  if (!adminmi(profil.rol)) redirect(xabarliYol(yol, { xato: 'Natijani faqat admin e’lon qiladi.' }))
  if (!id) redirect(xabarliYol(yol, { xato: 'Natija tanlanmagan.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('oylik_test_natijalar').update({ elon_qilingan: !qaytar }).eq('id', id)
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))
  if (!qaytar) after(() => oylikXabarYubor(supabase, [id]))
  revalidatePath('/crm/oylik-test')
  redirect(xabarliYol(yol, { ok: qaytar ? 'Natija e’londan olindi.' : 'Natija e’lon qilindi.' }))
}
