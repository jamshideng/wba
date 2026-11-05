'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { talabRol } from '@/lib/auth'
import { matn, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { shaxsiyMatn } from '@/lib/elon'
import { telegramElon } from '@/lib/elon-yuborish'
import { pushYoqilganmi, pushYubor } from '@/lib/push'
import type { ElonOluvchi, TelegramKim } from '@/lib/types'

const YOL = '/crm/qarzdorlar/eslatma'
/** Saytdagi eslatma shuncha kun turadi; qarz uzilsa — darhol yo'qoladi (filtr qarzdor) */
const KUN = 10

/**
 * Qarzdorlarga to'lov eslatmasi — uchala kanal birga (Jamshid, 05.11):
 *  1) Telegram (@WBAlcBot) — botga ulanganlarga, har kimga o'z qarzi;
 *  2) sayt va ilova — har qarzdorga alohida bildirishnoma
 *     (filtr {"oquvchi","qarzdor"}: faqat o'zi/ota-onasi ko'radi, qarz
 *     uzilgach chiqmaydi; manba='qarz' — admin ro'yxatini to'ldirmaydi);
 *  3) telefon push — ilova/saytda xabarnomaga ruxsat berganlarga.
 * Qayta yuborilsa, o'sha o'quvchining oldingi qarz eslatmasi yopiladi.
 * Hammasi admin nomidan, RLS bilan.
 */
export async function qarzEslatmaYubor(fd: FormData) {
  await talabRol('admin', 'direktor')

  const idlar = [...new Set(fd.getAll('s').map(String).filter((s) => /^S\d{1,5}$/.test(s)))]
  const kimga = [...new Set(fd.getAll('k').map(String))].filter((k): k is TelegramKim => k === 'oquvchi' || k === 'ota_ona')
  const sarlavha = (matn(fd.get('sarlavha')) ?? 'To‘lov eslatmasi').slice(0, 120)
  const andoza = matn(fd.get('matn'))?.slice(0, 1500)

  if (!idlar.length) redirect(xabarliYol(YOL, { xato: 'Kamida bitta qarzdorni belgilang.' }))
  if (!kimga.length) redirect(xabarliYol(YOL, { xato: 'Kimga yuborilishini tanlang: o‘quvchi va/yoki ota-ona.' }))
  if (!andoza) redirect(xabarliYol(YOL, { xato: 'Xabar matni bo‘sh.' }))

  const supabase = await createClient()

  // Qarz hozir ham bormi — bazadan qayta (sahifa ochilgandan beri to'lagan bo'lishi mumkin)
  const { data: qarzdorlar, error: e1 } = await supabase.from('v_qarzdorlar').select('student_id, fish, qarz').in('student_id', idlar)
  if (e1) redirect(xabarliYol(YOL, { xato: xatoMatni(e1) }))
  const royxat = (qarzdorlar ?? []).filter((q) => Number(q.qarz) > 0)
  if (!royxat.length) redirect(xabarliYol(YOL, { xato: 'Belgilanganlarning qarzi qolmagan.' }))
  const tanlangan = new Set(royxat.map((q) => q.student_id))

  // Oluvchilar (ism, qarz, chat) — Telegram e'loni bilan bir xil funksiya
  const { data: aud, error: e2 } = await supabase.rpc('elon_oluvchilar', { p_kimga: kimga, p_filtr: { qarzdor: true } })
  if (e2) redirect(xabarliYol(YOL, { xato: xatoMatni(e2) }))
  const auditoriya = (aud ?? []).filter((a: ElonOluvchi) => a.student_id && tanlangan.has(a.student_id))

  /* 1. Sayt + ilova: har qarzdorga alohida, o'z summasi bilan */
  const ismi = new Map<string, string>()
  for (const a of auditoriya) if (a.student_id && (a.kim === 'oquvchi' || !ismi.has(a.student_id))) ismi.set(a.student_id, a.ism)

  await supabase.from('bildirishnomalar').update({ holat: 'yopilgan' }).eq('manba', 'qarz').eq('holat', 'faol').in('filtr->>oquvchi', [...tanlangan])

  const tugash = new Date(Date.now() + KUN * 86_400_000).toISOString()
  const { data: yangi, error: e3 } = await supabase
    .from('bildirishnomalar')
    .insert(
      royxat.map((q) => ({
        turi: 'eslatma',
        sarlavha,
        matn: shaxsiyMatn(andoza!, { ism: ismi.get(q.student_id) ?? q.fish, qarz: Number(q.qarz) }).slice(0, 2000),
        kimga,
        filtr: { oquvchi: q.student_id, qarzdor: true },
        tugash,
        manba: 'qarz',
      })),
    )
    .select('id, matn')
  if (e3) redirect(xabarliYol(YOL, { xato: xatoMatni(e3) }))

  /* 2. Telegram */
  const tg = await telegramElon(supabase, { turi: 'tolov', matn: andoza!, kimga, filtr: { qarzdor: true } }, auditoriya)

  /* 3. Telefon push — oluvchilar hozir (admin sessiyasida), yuborish javobdan keyin */
  let pushSoni = 0
  if (pushYoqilganmi() && yangi?.length) {
    const ishlar: { id: number; matn: string | null; obunalar: { endpoint: string; p256dh: string; auth: string }[] }[] = []
    for (const b of yangi) {
      const { data: ob } = await supabase.rpc('push_oluvchilar', { p_bildirishnoma: b.id })
      if (ob?.length) {
        ishlar.push({ id: b.id, matn: b.matn, obunalar: ob })
        pushSoni += ob.length
      }
    }
    if (ishlar.length) {
      after(async () => {
        for (const x of ishlar) {
          const { eskirgan } = await pushYubor(x.obunalar, { sarlavha, matn: x.matn, havola: '/crm', teg: `b${x.id}` })
          for (const e of eskirgan) await supabase.rpc('push_eskirgan', { p_endpoint: e })
        }
      })
    }
  }

  revalidatePath('/crm', 'layout')
  const qismlar = [
    `${royxat.length} ta qarzdorga yuborildi: saytda va ilovada chiqadi`,
    pushSoni ? `${pushSoni} ta telefonga xabarnoma` : null,
    tg.xato ? `Telegram xatosi: ${tg.xato}` : `Telegram: ${tg.yetdi} ta chatga yetdi${tg.yetmadi ? `, ${tg.yetmadi} tasiga yetmadi` : ''}`,
  ].filter(Boolean)
  redirect(xabarliYol(YOL, { ok: `${qismlar.join(' · ')}.` }))
}
