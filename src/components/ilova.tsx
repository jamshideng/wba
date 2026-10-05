'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { IconOrnatish, IconUlashish, IconYangilash } from '@/components/icons'

/*
 * Telefon ilovasi (PWA).
 *  - IlovaSW — service worker'ni ro'yxatdan o'tkazadi va brauzerning
 *    "o'rnatish" taklifini (beforeinstallprompt) ushlab qoladi. Root layout'da:
 *    taklif bir marta, sahifa ochilishi bilan keladi — keyin chiqqan
 *    komponent uni o'tkazib yubormasin.
 *  - IlovaOrnatish — "Ilovani o'rnatish" tugmasi. Android/kompyuter Chrome'da
 *    tizim oynasini ochadi; iPhone'da (taklif yo'q) "Ulashish → Ekranga qo'shish"
 *    yo'riqnomasini ko'rsatadi. Ilova ichida ochilgan bo'lsa — ko'rinmaydi.
 */

type Taklif = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let taklif: Taklif | null = null
let ornatildi = false
const tinglovchilar = new Set<() => void>()
const xabar = () => tinglovchilar.forEach((f) => f())
const obuna = (f: () => void) => {
  tinglovchilar.add(f)
  return () => tinglovchilar.delete(f)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // Chrome'ning o'z pastki yozuvi o'rniga — bizning tugma
    taklif = e as Taklif
    xabar()
  })
  window.addEventListener('appinstalled', () => {
    taklif = null
    ornatildi = true
    xabar()
  })
}

export function IlovaSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}

const YOPILDI_KALIT = 'wba-ilova-yopildi'
const YOPIQ_KUN = 14

export function ilovaIchidami() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function iphonemi() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * joy="banner" — CRM tepasida, "Keyinroq" bilan 14 kunga yopiladi.
 * joy="menyu"  — telefondagi Menyu sahifasida, doim (o'rnatilmagan bo'lsa).
 */
export function IlovaOrnatish({ joy }: { joy: 'banner' | 'menyu' }) {
  const bor = useSyncExternalStore(obuna, () => taklif, () => null)
  const tayyor = useSyncExternalStore(obuna, () => ornatildi, () => false)
  // Server va birinchi chizishda hech narsa — hydration farqi (#418) bo'lmasin
  const [holat, setHolat] = useState<{ ichida: boolean; iphone: boolean; yopiq: boolean } | null>(null)
  const [yoriq, setYoriq] = useState(false)

  useEffect(() => {
    let yopiq = false
    try {
      const t = Number(localStorage.getItem(YOPILDI_KALIT) ?? 0)
      yopiq = Date.now() - t < YOPIQ_KUN * 86_400_000
    } catch {}
    setHolat({ ichida: ilovaIchidami(), iphone: iphonemi(), yopiq })
  }, [])

  if (!holat || holat.ichida || tayyor) return null
  if (joy === 'banner' && holat.yopiq) return null
  // Na taklif, na iPhone (masalan Firefox) — o'rnatib bo'lmaydi, ko'rsatmaymiz
  if (!bor && !holat.iphone) return null

  async function ornat() {
    if (bor) {
      await bor.prompt()
      await bor.userChoice
      taklif = null
      xabar()
    } else {
      setYoriq((x) => !x)
    }
  }

  function keyinroq() {
    try {
      localStorage.setItem(YOPILDI_KALIT, String(Date.now()))
    } catch {}
    setHolat((h) => (h ? { ...h, yopiq: true } : h))
  }

  return (
    <div className={`rounded-[12px] border border-brand-line bg-brand-soft p-3.5 ${joy === 'banner' ? 'mx-5 mt-4 lg:mx-7' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand text-white">
          <IconOrnatish size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">WBA ilovasi</p>
          <p className="text-[12.5px] text-ink-2">Telefon ekraniga o‘rnating — tez ochiladi, brauzersiz.</p>
        </div>
      </div>

      {yoriq && (
        <ol className="mt-3 flex flex-col gap-1.5 rounded-[10px] bg-surface p-3 text-[13px] text-ink-2">
          <li className="flex items-center gap-2">
            <span className="tnum font-semibold text-ink">1.</span> Safari pastidagi
            <IconUlashish size={16} className="text-brand" /> <b className="text-ink">Ulashish</b> tugmasini bosing
          </li>
          <li className="flex items-center gap-2">
            <span className="tnum font-semibold text-ink">2.</span>
            <b className="text-ink">«Ekranga qo‘shish»</b> (На экран «Домой») ni tanlang
          </li>
          <li className="flex items-center gap-2">
            <span className="tnum font-semibold text-ink">3.</span> O‘ng tepadagi <b className="text-ink">«Qo‘shish»</b> ni bosing
          </li>
        </ol>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={ornat}
          className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-brand px-4 text-[13.5px] font-semibold text-white hover:brightness-110"
        >
          {bor ? 'O‘rnatish' : yoriq ? 'Yopish' : 'Qanday o‘rnatiladi?'}
        </button>
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
    </div>
  )
}

/**
 * Ilova ichida "Yangilash" (ekrandagi ikonkadan ochilganda brauzer tugmasi
 * yo'q). Bosilsa — sahifa butunlay qayta yuklanadi: yangi ma'lumot ham,
 * saytning yangi versiyasi ham keladi. Brauzerda ko'rinmaydi (u yerda
 * o'z tugmasi bor).
 * Qo'shimcha: ilovaga boshqa dasturdan qaytilganda (1 daqiqadan keyin) —
 * ma'lumot o'zi yangilanadi (router.refresh, sahifa sakramaydi).
 */
export function YangilashTugma() {
  const router = useRouter()
  const [ichida, setIchida] = useState(false)
  const [aylanmoqda, setAylanmoqda] = useState(false)

  useEffect(() => {
    if (!ilovaIchidami()) return
    setIchida(true)
    let ketdi = 0
    const korinish = () => {
      if (document.visibilityState === 'hidden') ketdi = Date.now()
      else if (ketdi && Date.now() - ketdi > 60_000) router.refresh()
    }
    document.addEventListener('visibilitychange', korinish)
    return () => document.removeEventListener('visibilitychange', korinish)
  }, [router])

  if (!ichida) return null

  return (
    <button
      type="button"
      onClick={() => {
        setAylanmoqda(true)
        window.location.reload()
      }}
      aria-label="Yangilash"
      title="Yangilash"
      className="flex size-11 shrink-0 items-center justify-center rounded-[10px] text-ink-2 transition hover:bg-surface-2 hover:text-ink"
    >
      <IconYangilash size={19} className={aylanmoqda ? 'animate-spin' : ''} />
    </button>
  )
}
