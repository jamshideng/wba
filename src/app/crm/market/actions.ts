'use server'

import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { talabProfil, talabRol } from '@/lib/auth'
import { matn, sonOqi, xabarliYol, xatoMatni } from '@/lib/kiritish'
import { html, xabar, HISOBOT_GURUH } from '@/lib/telegram'
import { kodNormal, RASM_MAKS_BAYT, RASM_TURLARI } from '@/lib/market'

/**
 * WOBLAR MARKET amallari (0040).
 * Pul (woblar) va ombor hisobini faqat bazadagi funksiyalar qiladi —
 * bu yerda faqat chaqiriladi; huquq ham o'sha yerda tekshiriladi.
 */

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
  // Faqat prod'da: lokal sinov buyurtmalari haqiqiy guruhga ketmasin.
  const { data: m } = await supabase.from('woblr_rewards').select('nom, narx_ball').eq('id', id!).maybeSingle()
  if (process.env.VERCEL_ENV === 'production') after(async () => {
    await xabar(
      Number(HISOBOT_GURUH),
      [
        '<b>[SAYT] WOBLAR MARKET — yangi buyurtma</b>',
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

/* ── Xodim: berish ── */

export async function buyurtmaBerildi(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const kod = kodNormal(String(fd.get('kod') ?? ''))
  const yol = '/crm/market/boshqaruv'
  if (!kod) redirect(xabarliYol(yol, { xato: 'Kod noto‘g‘ri. Masalan: WM-7K4P2X' }))

  const supabase = await createClient()
  const { error } = await supabase.rpc('market_berildi', { p_kod: kod! })
  if (error) redirect(xabarliYol(yol, { xato: xatoMatni(error) }))

  revalidatePath('/crm/market', 'layout')
  redirect(xabarliYol(yol, { ok: `${kod} — berildi.` }))
}

/* ── Admin: mahsulotlar ── */

async function rasmYukla(fayl: File): Promise<string> {
  if (!RASM_TURLARI.includes(fayl.type as (typeof RASM_TURLARI)[number])) {
    throw new Error('Rasm JPG, PNG yoki WEBP bo‘lsin.')
  }
  if (fayl.size > RASM_MAKS_BAYT) throw new Error('Rasm 3 MB dan katta bo‘lmasin.')
  const kengaytma = fayl.type === 'image/png' ? 'png' : fayl.type === 'image/webp' ? 'webp' : 'jpg'
  const yol = `${randomUUID()}.${kengaytma}`

  // Oddiy (RLS) klient bilan — storage qoidasi faqat admin yozishiga ruxsat beradi (0040)
  const supabase = await createClient()
  const { error } = await supabase.storage
    .from('market')
    .upload(yol, fayl, { contentType: fayl.type, cacheControl: '31536000' })
  if (error) throw new Error(`Rasm yuklanmadi: ${error.message}`)
  return supabase.storage.from('market').getPublicUrl(yol).data.publicUrl
}

export async function mahsulotSaqla(fd: FormData) {
  await talabRol('admin', 'direktor')
  const id = matn(fd.get('id'))
  const forma = id ? `/crm/market/boshqaruv/mahsulot/${id}` : '/crm/market/boshqaruv/mahsulot/yangi'

  const nom = matn(fd.get('nom'))
  const narx = sonOqi(fd.get('narx_ball'))
  const cheksiz = fd.get('cheksiz') === '1'
  const soni = sonOqi(fd.get('qolgan_soni')) ?? 0
  if (!nom) redirect(xabarliYol(forma, { xato: 'Mahsulot nomini yozing.' }))
  if (!narx || narx < 1) redirect(xabarliYol(forma, { xato: 'Narx (woblarda) 1 dan katta butun son bo‘lsin.' }))
  if (!cheksiz && soni < 0) redirect(xabarliYol(forma, { xato: 'Soni manfiy bo‘lmaydi.' }))

  let rasmUrl: string | undefined
  const fayl = fd.get('rasm')
  if (fayl instanceof File && fayl.size > 0) {
    try {
      rasmUrl = await rasmYukla(fayl)
    } catch (e) {
      redirect(xabarliYol(forma, { xato: e instanceof Error ? e.message : 'Rasm yuklanmadi.' }))
    }
  }

  const qator = {
    nom: nom!,
    tavsif: matn(fd.get('tavsif')),
    toifa: matn(fd.get('toifa')),
    narx_ball: narx!,
    cheksiz,
    qolgan_soni: cheksiz ? 0 : soni,
    holat: fd.get('holat') === 'yopilgan' ? ('yopilgan' as const) : ('faol' as const),
    tartib: sonOqi(fd.get('tartib')) ?? 0,
    updated_at: new Date().toISOString(),
    ...(rasmUrl ? { rasm_url: rasmUrl } : {}),
    ...(fd.get('rasm_olib') === '1' && !rasmUrl ? { rasm_url: null } : {}),
  }

  const supabase = await createClient()
  const { error } = id
    ? await supabase.from('woblr_rewards').update(qator).eq('id', id)
    : await supabase.from('woblr_rewards').insert(qator)
  if (error) redirect(xabarliYol(forma, { xato: xatoMatni(error) }))

  revalidatePath('/crm/market', 'layout')
  redirect(xabarliYol('/crm/market/boshqaruv?bolim=mahsulot', { ok: id ? `“${nom}” saqlandi.` : `“${nom}” marketga qo‘shildi.` }))
}

/** Xodim kodni yozadi → chekni ochadi (berishdan oldin ko'rib oladi) */
export async function kodniOch(fd: FormData) {
  await talabRol('admin', 'direktor', 'qabulxona')
  const kod = kodNormal(String(fd.get('kod') ?? ''))
  if (!kod) redirect(xabarliYol('/crm/market/boshqaruv', { xato: 'Kod noto‘g‘ri. Masalan: WM-7K4P2X yoki 7K4P2X' }))
  redirect(`/crm/market/chek/${kod}`)
}
