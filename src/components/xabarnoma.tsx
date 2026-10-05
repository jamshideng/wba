'use client'

import { useEffect, useState } from 'react'
import { IconQongiroq } from '@/components/icons'
import { ilovaIchidami, iphonemi } from '@/components/ilova'
import { pushObunaOchir, pushObunaSaqla } from '@/app/crm/push-amal'

/*
 * Telefon xabarnomalari (Web Push, 0055) — "Xabarnomalarni yoqish".
 *  joy="banner" — faqat o'rnatilgan ilova ichida, ruxsat hali so'ralmagan
 *                 bo'lsa (7 kunga yopiladi);
 *  joy="menyu"  — doim: holat + yoqish/o'chirish.
 * Ruxsat berilgan qurilmada har sessiyada bir marta obuna JORIY odamga qayta
 * bog'lanadi — telefonda boshqa odam kirgan bo'lishi mumkin.
 */

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const YOPILDI = 'wba-push-yopildi'
const SINX = 'wba-push-sinx'

function kalitBaytlar(b64: string) {
  const toza = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const xom = atob(toza)
  const bayt = new Uint8Array(xom.length)
  for (let i = 0; i < xom.length; i++) bayt[i] = xom.charCodeAt(i)
  return bayt
}

function obunaJson(o: PushSubscription) {
  const j = o.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  return { endpoint: j.endpoint ?? '', p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '' }
}

/* Maxfiy rejim / bloklangan sayt ma'lumotida `localStorage` ga murojaatning
   o'zi xato beradi — shuning uchun ombor nomi bilan, try ichida olinadi. */
type Ombor = 'localStorage' | 'sessionStorage'
function saqla(k: string, q: string, joy: Ombor) {
  try {
    window[joy].setItem(k, q)
  } catch {}
}
function oqi(k: string, joy: Ombor) {
  try {
    return window[joy].getItem(k)
  } catch {
    return null
  }
}

type Holat = {
  mumkin: boolean // brauzer qo'llaydi (iPhone'da — faqat o'rnatilgan ilovada)
  iphoneBrauzerda: boolean
  ruxsat: NotificationPermission
  obuna: boolean
  yopiq: boolean
  ichida: boolean
}

export function XabarnomaYoqish({ joy }: { joy: 'banner' | 'menyu' }) {
  const [h, setH] = useState<Holat | null>(null)
  const [band, setBand] = useState(false)
  const [xato, setXato] = useState('')

  useEffect(() => {
    let bekor = false
    ;(async () => {
      const ichida = ilovaIchidami()
      const iphone = iphonemi()
      const qollaydi = Boolean(VAPID) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      const yopiq = Date.now() - Number(oqi(YOPILDI, 'localStorage') ?? 0) < 7 * 86_400_000
      let obuna = false
      if (qollaydi) {
        const reg = await navigator.serviceWorker.getRegistration()
        const o = reg ? await reg.pushManager.getSubscription() : null
        obuna = Boolean(o)
        if (o && Notification.permission === 'granted' && oqi(SINX, 'sessionStorage') !== '1') {
          if (await pushObunaSaqla(obunaJson(o), navigator.userAgent)) saqla(SINX, '1', 'sessionStorage')
        }
      }
      if (!bekor)
        setH({
          mumkin: qollaydi && (!iphone || ichida),
          iphoneBrauzerda: iphone && !ichida,
          ruxsat: 'Notification' in window ? Notification.permission : 'denied',
          obuna,
          yopiq,
          ichida,
        })
    })()
    return () => {
      bekor = true
    }
  }, [])

  if (!h) return null
  if (joy === 'banner' && (!h.ichida || !h.mumkin || h.ruxsat !== 'default' || h.yopiq)) return null
  if (joy === 'menyu' && !h.mumkin && !h.iphoneBrauzerda) return null

  async function yoq() {
    setBand(true)
    setXato('')
    try {
      const ruxsat = await Notification.requestPermission()
      if (ruxsat !== 'granted') {
        setH((x) => (x ? { ...x, ruxsat } : x))
        return
      }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
      await navigator.serviceWorker.ready
      const o =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kalitBaytlar(VAPID) }))
      const ok = await pushObunaSaqla(obunaJson(o), navigator.userAgent)
      if (ok) saqla(SINX, '1', 'sessionStorage')
      else setXato('Saqlanmadi. Qayta urinib ko‘ring.')
      setH((x) => (x ? { ...x, ruxsat, obuna: ok } : x))
    } catch {
      setXato('Bu qurilmada yoqib bo‘lmadi.')
    } finally {
      setBand(false)
    }
  }

  async function ochir() {
    setBand(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const o = reg ? await reg.pushManager.getSubscription() : null
      if (o) {
        await pushObunaOchir(o.endpoint)
        await o.unsubscribe()
      }
      setH((x) => (x ? { ...x, obuna: false } : x))
    } finally {
      setBand(false)
    }
  }

  function keyinroq() {
    saqla(YOPILDI, String(Date.now()), 'localStorage')
    setH((x) => (x ? { ...x, yopiq: true } : x))
  }

  const yoqilgan = h.ruxsat === 'granted' && h.obuna
  const izoh = h.iphoneBrauzerda
    ? 'iPhone’da xabarnoma faqat o‘rnatilgan ilovada ishlaydi — avval ilovani o‘rnating.'
    : h.ruxsat === 'denied'
      ? 'Ruxsat berilmagan. Telefon sozlamalarida WBA uchun xabarnomalarni yoqing.'
      : yoqilgan
        ? 'Yoqilgan — e’lon va eslatmalar telefoningizga keladi.'
        : 'E’lon, eslatma va so‘rovnomalar telefonga xabar bo‘lib keladi.'

  return (
    <div className={`rounded-[12px] border border-line bg-surface p-3.5 ${joy === 'banner' ? 'mx-5 mt-4 lg:mx-7' : ''}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${yoqilgan ? 'bg-ok-soft text-ok' : 'bg-brand text-white'}`}
        >
          <IconQongiroq size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">Xabarnomalar</p>
          <p className="text-[12.5px] text-ink-2">{izoh}</p>
        </div>
      </div>
      {xato && <p className="mt-2 text-[12.5px] text-crit">{xato}</p>}
      {h.mumkin && h.ruxsat !== 'denied' && (
        <div className="mt-3 flex gap-2">
          {yoqilgan ? (
            <button
              type="button"
              onClick={ochir}
              disabled={band}
              className="min-h-11 flex-1 rounded-[10px] border border-line px-4 text-[13.5px] text-ink-3 hover:text-ink disabled:opacity-50"
            >
              O‘chirish
            </button>
          ) : (
            <button
              type="button"
              onClick={yoq}
              disabled={band}
              className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-brand px-4 text-[13.5px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {band ? 'Kuting…' : 'Yoqish'}
            </button>
          )}
          {joy === 'banner' && (
            <button
              type="button"
              onClick={keyinroq}
              className="min-h-11 rounded-[10px] border border-line px-4 text-[13.5px] text-ink-3 hover:text-ink"
            >
              Keyinroq
            </button>
          )}
        </div>
      )}
    </div>
  )
}
