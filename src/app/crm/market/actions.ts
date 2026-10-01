'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, talabRol } from '@/lib/auth'
import { matn, sonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { elonYubor, html, toplamlab, xabar, HISOBOT_GURUH } from '@/lib/telegram'
import { kodNormal, kunOy, rasmlarniOqi } from '@/lib/market'

/**
 * WOBLAR MARKET amallari (0040, 0042).
 * Pul (woblar) va ombor hisobini faqat bazadagi funksiyalar qiladi —
 * bu yerda faqat chaqiriladi; huquq ham o'sha yerda tekshiriladi.
 */

/* ── Xabarlar (Telegram) ── */

/** Faqat prod'da: lokal sinov haqiqiy o'quvchilarga yetib bormasin */
const xabarYoqilgan = () => process.env.VERCEL_ENV === 'production'
const SAYT = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wbalc.uz'

/**
 * O'quvchilarning Telegram chatlari. `idlar` berilsa — faqat o'shalar
 * (o'quvchi + ota-onasi), berilmasa — hamma faol o'quvchi (ota-onaga
 * reklama yuborilmaydi). RLS: xodim o'qiy oladi (0021).
 */
async function chatlar(idlar: string[] | null): Promise<{ chat_id: number; student_id: string }[]> {
  const supabase = await createClient()
  let s = supabase.from('telegram_ulanish').select('chat_id, student_id, kim').eq('holat', 'faol')
  s = idlar ? s.in('student_id', idlar.length ? idlar : ['-']).in('kim', ['oquvchi', 'ota_ona']) : s.eq('kim', 'oquvchi')
  const { data } = await s
  const korilgan = new Set<number>()
  return (data ?? [])
    .filter((r) => r.student_id && !korilgan.has(r.chat_id) && korilgan.add(r.chat_id))
    .map((r) => ({ chat_id: Number(r.chat_id), student_id: r.student_id as string }))
}

/** Javobdan keyin yuboriladi — sahifa kutib qolmaydi */
function yubor(royxat: { chat_id: number }[], matnFn: (r: { chat_id: number; student_id?: string }) => string) {
  if (!xabarYoqilgan() || !royxat.length) return
  after(async () => {
    await toplamlab(royxat, (r) => elonYubor(r.chat_id, matnFn(r)))
  })
}

const tayyorMatni = (nom: string, kod: string) =>
  [
    '<b>WOBLAR MARKET — zakazingiz keldi!</b>',
    '',
    `<b>${html(nom)}</b> markazga yetib keldi.`,
    `Markazga kelib, chek kodini adminga ko‘rsating: <b>${html(kod)}</b>`,
    '',
    `Chek: ${SAYT}/crm/market/chek/${kod}`,
  ].join('\n')

/* ── O'quvchi ── */

export async function buyurtmaBer(fd: FormData) {
  const profil = await talabProfil()
  const id = matn(fd.get('reward_id'))
  const soni = sonOqi(fd.get('soni')) ?? 1
  const qaytish = id ? `/crm/market/${id}` : '/crm/market'
  if (!id) redirect('/crm/market')
  if (profil.rol !== 'oquvchi') redirect(xabarliYol(qaytish, { xato: 'Buyurtmani o‘quvchi o‘z hisobidan beradi.' }))

  const supabase = await createClient()
  const { data: kod, error } = await supabase.rpc('market_buyurtma', { p_reward: id!, p_soni: soni })
  if (error || !kod) redirect(xabarliYol(qaytish, { xato: xatoMatni(error) }))

  // Adminlar darhol bilsin — xabar javobdan keyin, xato bo'lsa ham buyurtma saqlangan.
  const { data: m } = await supabase.from('woblr_rewards').select('nom, narx_ball, rejim').eq('id', id!).maybeSingle()
  if (xabarYoqilgan()) after(async () => {
    await xabar(
      Number(HISOBOT_GURUH),
      [
        `<b>[SAYT] WOBLAR MARKET — ${m?.rejim === 'oldindan' ? 'oldindan buyurtma' : 'yangi buyurtma'}</b>`,
        `${html(profil.ism)}: <b>${html(m?.nom ?? 'mahsulot')}</b>${soni > 1 ? ` × ${soni}` : ''} — ${(m?.narx_ball ?? 0) * soni} woblar`,
        `Kod: <b>${html(kod as string)}</b>`,
      ].join('\n'),
    )
  })

  revalidatePath('/crm/market', 'layout')
  redirect(`/crm/market/chek/${kod}?yangi=1`)
}

export async function buyurtmaniBekorQil(fd: FormData) {
  await talabProfil()
  const kod = kodNormal(String(fd.get('kod') ?? ''))
  const qaytish = String(fd.get('qaytish') ?? '/crm/market/buyurtmalar')
  const yol = qaytish.startsWith('/crm/market') ? qaytish : '/crm/market/buyurtmalar'
  if (!kod) redirect(yol)

  const supabase = await createClient()
  const { error } = await supabase.rpc('market_bekor', { p_kod: kod!, p_sabab: matn(fd.get('sabab')) })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/market', 'layout')
  redirect(xabarliYol(yol, { ok: `${kod} bekor qilindi — woblar qaytdi.` }))
}

/* ── Xodim: berish, keldi ── */

function qaytishYoli(fd: FormData): string {
  const q = String(fd.get('qaytish') ?? '')
  return q.startsWith('/crm/market') ? q : '/crm/market/boshqaruv'
}

export async function buyurtmaBerildi(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const kod = kodNormal(String(fd.get('kod') ?? ''))
  const yol = qaytishYoli(fd)
  if (!kod) redirect(xabarliYol(yol, { xato: 'Kod noto‘g‘ri. Masalan: WM-7K4P2X' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('market_berildi', { p_kod: kod! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/market', 'layout')
  redirect(xabarliYol(yol, { ok: `${kod} — berildi.` }))
}

/** Bitta oldindan buyurtma keldi → tayyor, o'quvchiga xabar */
export async function buyurtmaKeldi(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const kod = kodNormal(String(fd.get('kod') ?? ''))
  const yol = qaytishYoli(fd)
  if (!kod) redirect(yol)

  const supabase = await createClient()
  const { data: oquvchi, error } = await supabase.rpc('market_keldi', { p_kod: kod! })
  if (error || !oquvchi) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  const { data: b } = await supabase.from('woblr_redemptions').select('mahsulot_nomi').eq('kod', kod!).maybeSingle()
  yubor(await chatlar([oquvchi as string]), () => tayyorMatni(b?.mahsulot_nomi ?? 'Mahsulot', kod!))

  revalidatePath('/crm/market', 'layout')
  redirect(xabarliYol(yol, { ok: `${kod} — keldi${xabarYoqilgan() ? ', o‘quvchiga xabar ketdi' : ''}.` }))
}

/**
 * Mahsulot keldi (bozor kuni yoki undan oldin): barcha oldindan
 * buyurtmalari tayyor bo'ladi, har biriga xabar. `sotuvga` belgilansa —
 * mahsulot oddiy sotuvga o'tadi va hammaga e'lon qilinadi.
 */
export async function mahsulotKeldi(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = matn(fd.get('id'))
  const yol = qaytishYoli(fd)
  if (!id) redirect(yol)
  const sotuvga = fd.get('sotuvga') === '1'

  const supabase = await createClient()
  const { data: m } = await supabase.from('woblr_rewards').select('nom, narx_ball').eq('id', id!).maybeSingle()
  const { data: tayyor, error } = await supabase.rpc('market_mahsulot_keldi', { p_reward: id!, p_sotuvga: sotuvga })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  const royxat = (tayyor ?? []) as { student_id: string; kod: string }[]
  await xabarlarniYubor(m?.nom ?? 'Mahsulot', royxat, sotuvga ? { narx: m?.narx_ball ?? 0, id: id! } : null)

  revalidatePath('/crm/market', 'layout')
  redirect(xabarliYol(yol, {
    ok: `“${m?.nom ?? 'Mahsulot'}” keldi: ${royxat.length} ta buyurtma tayyor${sotuvga ? ', endi sotuvda' : ''}.${xabarYoqilgan() ? ' Xabarlar yuborildi.' : ''}`,
  }))
}

/** Tayyor bo'lgan buyurtmalar egalariga + (ixtiyoriy) hammaga "endi sotuvda" */
async function xabarlarniYubor(
  nom: string,
  tayyor: { student_id: string; kod: string }[],
  sotuv: { narx: number; id: string } | null,
) {
  if (tayyor.length) {
    const kodi = new Map<string, string[]>()
    tayyor.forEach((t) => kodi.set(t.student_id, [...(kodi.get(t.student_id) ?? []), t.kod]))
    const egalar = await chatlar([...kodi.keys()])
    yubor(egalar, (r) => tayyorMatni(nom, (kodi.get(r.student_id ?? '') ?? []).join(', ')))
  }
  if (sotuv) {
    const zakazchilar = new Set(tayyor.map((t) => t.student_id))
    const hamma = (await chatlar(null)).filter((r) => !zakazchilar.has(r.student_id))
    yubor(hamma, () => [
      '<b>WOBLAR MARKET — endi sotuvda!</b>',
      '',
      `<b>${html(nom)}</b> markazimizda bor — ${sotuv.narx} woblar.`,
      'Bemalol buyurtma bering va markazdan olib keting.',
      '',
      `${SAYT}/crm/market/${sotuv.id}`,
    ].join('\n'))
  }
}

/* ── Admin: bozor kuni ── */

export async function bozorSanasi(fd: FormData) {
  const profil = await talabRol('admin', 'direktor')
  const sana = matn(fd.get('sana'))
  if (sana && !/^\d{4}-\d{2}-\d{2}$/.test(sana)) redirect(xabarliYol('/crm/market/boshqaruv', { xato: 'Sana noto‘g‘ri.' }))

  const supabase = await createClient()
  const { error } = await supabase.from('settings').upsert({
    kalit: 'market.bozor_sana',
    qiymat: sana ?? null,
    ozgartirdi: profil.id,
    updated_at: new Date().toISOString(),
  })
  if (error) redirect(xabarliYol('/crm/market/boshqaruv', { xato: xatoMatni(error) }))

  revalidatePath('/crm/market', 'layout')
  redirect(xabarliYol('/crm/market/boshqaruv', { ok: sana ? `Bozor kuni: ${kunOy(sana)}.` : 'Bozor kuni olib tashlandi.' }))
}

/* ── Admin: mahsulotlar ── */

type Rejim = 'sotuvda' | 'oldindan' | 'yopilgan'

export async function mahsulotSaqla(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = matn(fd.get('id'))
  const forma = id ? `/crm/market/boshqaruv/mahsulot/${id}` : '/crm/market/boshqaruv/mahsulot/yangi'

  const nom = matn(fd.get('nom'))
  const narx = sonOqi(fd.get('narx_ball'))
  const cheksiz = fd.get('cheksiz') === '1'
  const soni = sonOqi(fd.get('qolgan_soni')) ?? 0
  const rejim: Rejim = fd.get('rejim') === 'oldindan' ? 'oldindan' : fd.get('rejim') === 'yopilgan' ? 'yopilgan' : 'sotuvda'
  const kelish = matn(fd.get('kelish_sana'))
  const xabarBer = fd.get('xabar') === '1'
  if (!nom) redirect(xabarliYol(forma, { xato: 'Mahsulot nomini yozing.' }))
  if (!narx || narx < 1) redirect(xabarliYol(forma, { xato: 'Narx (woblarda) 1 dan katta butun son bo‘lsin.' }))
  if (!cheksiz && soni < 0) redirect(xabarliYol(forma, { xato: 'Soni manfiy bo‘lmaydi.' }))
  if (kelish && !/^\d{4}-\d{2}-\d{2}$/.test(kelish)) redirect(xabarliYol(forma, { xato: 'Kelish sanasi noto‘g‘ri.' }))

  const rasmlar = rasmlarniOqi(fd.get('rasmlar'), process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')

  const supabase = await createClient()
  const { data: eski } = id
    ? await supabase.from('woblr_rewards').select('holat, rejim').eq('id', id).maybeSingle()
    : { data: null }
  const eskiRejim: Rejim | null = !eski ? null : eski.holat !== 'faol' ? 'yopilgan' : (eski.rejim as Rejim)

  const qator = {
    nom: nom!,
    tavsif: matn(fd.get('tavsif')),
    toifa: matn(fd.get('toifa')),
    narx_ball: narx!,
    cheksiz,
    qolgan_soni: cheksiz ? 0 : soni,
    holat: rejim === 'yopilgan' ? ('yopilgan' as const) : ('faol' as const),
    rejim: rejim === 'oldindan' ? ('oldindan' as const) : ('sotuvda' as const),
    kelish_sana: rejim === 'oldindan' ? kelish : null,
    rasmlar,
    rasm_url: rasmlar[0] ?? null,
    tartib: sonOqi(fd.get('tartib')) ?? 0,
    updated_at: new Date().toISOString(),
  }

  // Oldindan → sotuvda: tovar keldi — buyurtmalar tayyor bo'ladi (xabar bilan)
  const keldi = eskiRejim === 'oldindan' && rejim === 'sotuvda'

  const { data: saqlangan, error } = id
    ? await supabase.from('woblr_rewards').update(qator).eq('id', id).select('id').single()
    : await supabase.from('woblr_rewards').insert(qator).select('id').single()
  if (error || !saqlangan) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))
  const mid = saqlangan!.id as string

  let tayyor: { student_id: string; kod: string }[] = []
  if (keldi) {
    const { data, error: e2 } = await supabase.rpc('market_mahsulot_keldi', { p_reward: mid, p_sotuvga: true })
    if (e2) redirect(xabarliYol(forma, { xato: xatoMatni(e2) }))
    tayyor = (data ?? []) as typeof tayyor
  }

  // Hammaga e'lon: yangi tovar yoki endi sotuvda (belgi qo'yilgan bo'lsa)
  const elon =
    xabarBer && rejim !== 'yopilgan' && eskiRejim !== rejim
      ? rejim === 'sotuvda' ? 'sotuv' : 'oldindan'
      : null
  if (tayyor.length) await xabarlarniYubor(nom!, tayyor, elon === 'sotuv' ? { narx: narx!, id: mid } : null)
  else if (elon === 'sotuv') await xabarlarniYubor(nom!, [], { narx: narx!, id: mid })
  if (elon === 'oldindan') {
    const { data: b } = await supabase.from('settings').select('qiymat').eq('kalit', 'market.bozor_sana').maybeSingle()
    const qachon = kelish ?? (typeof b?.qiymat === 'string' ? b.qiymat : null)
    yubor(await chatlar(null), () => [
      '<b>WOBLAR MARKET — oldindan buyurtma ochildi</b>',
      '',
      `<b>${html(nom!)}</b> — ${narx} woblar.`,
      qachon ? `Tovar ${kunOy(qachon)} kuni keladi.` : 'Tovar bozor kuni keladi.',
      'Hoziroq zakaz bering — kelganda birinchi bo‘lib olasiz.',
      '',
      `${SAYT}/crm/market/${mid}`,
    ].join('\n'))
  }

  revalidatePath('/crm/market', 'layout')
  const ok = keldi
    ? `“${nom}” sotuvga o‘tdi: ${tayyor.length} ta oldindan buyurtma tayyor${xabarYoqilgan() ? ', egalariga xabar ketdi' : ''}.`
    : id ? `“${nom}” saqlandi.` : `“${nom}” marketga qo‘shildi.`
  redirect(xabarliYol('/crm/market/boshqaruv?bolim=mahsulot', { ok: elon && xabarYoqilgan() ? `${ok} O‘quvchilarga e’lon yuborildi.` : ok }))
}

/** Xodim kodni yozadi → chekni ochadi (berishdan oldin ko'rib oladi) */
export async function kodniOch(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const kod = kodNormal(String(fd.get('kod') ?? ''))
  if (!kod) redirect(xabarliYol('/crm/market/boshqaruv', { xato: 'Kod noto‘g‘ri. Masalan: WM-7K4P2X yoki 7K4P2X' }))
  redirect(`/crm/market/chek/${kod}`)
}

/**
 * Mahsulotni butunlay o'chirish (0043): ochiq buyurtmalar bekor bo'ladi va
 * woblar qaytadi (egalariga xabar), berilganlari tarixda nomi bilan qoladi,
 * rasmlari Storage'dan o'chadi.
 */
export async function mahsulotOchir(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = matn(fd.get('id'))
  if (!id) redirect('/crm/market/boshqaruv?bolim=mahsulot')
  const forma = `/crm/market/boshqaruv/mahsulot/${id}`

  const supabase = await createClient()
  const { data: m } = await supabase.from('woblr_rewards').select('nom, rasmlar, rasm_url').eq('id', id!).maybeSingle()
  if (!m) redirect(xabarliYol('/crm/market/boshqaruv?bolim=mahsulot', { xato: 'Mahsulot topilmadi.' }))

  const { data, error } = await supabase.rpc('market_mahsulot_ochir', { p_reward: id! })
  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))
  const bekor = (data ?? []) as { student_id: string; kod: string }[]

  // Rasmlar — faqat o'zimizning 'market' bucketidagilar
  const boshi = '/storage/v1/object/public/market/'
  const fayllar = [...new Set([...(m!.rasmlar ?? []), m!.rasm_url].filter((u): u is string => Boolean(u)))]
    .map((u) => (u.includes(boshi) ? decodeURIComponent(u.slice(u.indexOf(boshi) + boshi.length)) : null))
    .filter((x): x is string => Boolean(x))
  if (fayllar.length) await supabase.storage.from('market').remove(fayllar)

  if (bekor.length) {
    const kodi = new Map<string, string[]>()
    bekor.forEach((b) => kodi.set(b.student_id, [...(kodi.get(b.student_id) ?? []), b.kod]))
    yubor(await chatlar([...kodi.keys()]), (r) => [
      '<b>WOBLAR MARKET — buyurtma bekor qilindi</b>',
      '',
      `<b>${html(m!.nom)}</b> marketdan olib tashlandi, shuning uchun buyurtmangiz (${html((kodi.get(r.student_id ?? '') ?? []).join(', '))}) bekor qilindi.`,
      'Woblaringiz to‘liq qaytarildi — marketdan boshqa sovg‘a tanlashingiz mumkin.',
    ].join('\n'))
  }

  revalidatePath('/crm/market', 'layout')
  redirect(xabarliYol('/crm/market/boshqaruv?bolim=mahsulot', {
    ok: `“${m!.nom}” o‘chirildi.${bekor.length ? ` ${bekor.length} ta ochiq buyurtma bekor qilindi, woblar qaytdi.` : ''}`,
  }))
}
