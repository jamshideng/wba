import 'server-only'
import webpush from 'web-push'
import { cookies } from 'next/headers'

/**
 * Telefon xabarnomalari (Web Push, 0055) — faqat server tomonda.
 * VAPID kalitlari env'da: NEXT_PUBLIC_VAPID_PUBLIC_KEY (brauzer obunasi uchun ham)
 * va VAPID_PRIVATE_KEY (sir). Kalit bo'lmasa — jim o'tadi (push o'chiq).
 */

export const PUSH_COOKIE = 'wba_push'

export type PushObuna = { endpoint: string; p256dh: string; auth: string }
export type PushXabar = { sarlavha: string; matn?: string | null; havola?: string | null; teg?: string }

let sozlandi = false
export function pushYoqilganmi(): boolean {
  const ochiq = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const yopiq = process.env.VAPID_PRIVATE_KEY
  if (!ochiq || !yopiq) return false
  if (!sozlandi) {
    webpush.setVapidDetails('https://wbalc.uz', ochiq, yopiq)
    sozlandi = true
  }
  return true
}

/**
 * Hammaga yuboradi (parallel, 20 tadan). Qaytaradi: eskirgan obunalar
 * (qurilma 404/410 — ilova o'chirilgan yoki ruxsat olib tashlangan) —
 * ularni chaqiruvchi bazadan o'chiradi.
 */
export async function pushYubor(obunalar: PushObuna[], x: PushXabar): Promise<{ yuborildi: number; eskirgan: string[] }> {
  if (!obunalar.length || !pushYoqilganmi()) return { yuborildi: 0, eskirgan: [] }
  const tana = JSON.stringify({
    sarlavha: x.sarlavha.slice(0, 120),
    matn: x.matn?.slice(0, 300) ?? '',
    havola: x.havola && x.havola.startsWith('/') ? x.havola : '/crm',
    teg: x.teg,
  })
  const eskirgan: string[] = []
  let yuborildi = 0
  for (let i = 0; i < obunalar.length; i += 20) {
    await Promise.all(
      obunalar.slice(i, i + 20).map(async (o) => {
        try {
          await webpush.sendNotification({ endpoint: o.endpoint, keys: { p256dh: o.p256dh, auth: o.auth } }, tana, {
            TTL: 60 * 60 * 24, // telefon o'chiq bo'lsa — bir kun kutadi
            urgency: 'normal',
          })
          yuborildi++
        } catch (e) {
          const kod = (e as { statusCode?: number }).statusCode
          if (kod === 404 || kod === 410) eskirgan.push(o.endpoint)
          else console.error('[push] yuborilmadi', kod, (e as Error).message)
        }
      }),
    )
  }
  return { yuborildi, eskirgan }
}

/** Chiqishda: shu qurilma obunasini o'chirish (cookie'dagi endpoint bo'yicha). Signout'dan OLDIN chaqiriladi. */
export async function chiqishdaPushniUz(supabase: { rpc: (f: 'push_ochir', a: { p_endpoint: string }) => PromiseLike<unknown> }) {
  const kuki = await cookies()
  const endpoint = kuki.get(PUSH_COOKIE)?.value
  if (!endpoint) return
  try {
    await supabase.rpc('push_ochir', { p_endpoint: endpoint })
  } catch {}
  kuki.delete(PUSH_COOKIE)
}
