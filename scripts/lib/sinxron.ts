/**
 * Sheets ↔ sayt — UCH TOMONLAMA solishtirish (14.10, Jamshid qarori).
 *
 * Har yozuv uch ko'rinishda keladi:
 *   baza   — oxirgi muvaffaqiyatli sinxrondagi kelishilgan holat (holat fayli),
 *   sheets — Sheets'ning hozirgi holati (sayt sxemasiga keltirilgan),
 *   sayt   — saytning hozirgi holati.
 *
 * Har MAYDON alohida hal qilinadi:
 *   sheets = sayt                → hech narsa (baza yangilanadi)
 *   faqat sheets o'zgargan       → saytga yoziladi
 *   faqat sayt o'zgargan         → Sheets'ga yoziladi (mumkin bo'lsa, aks holda — qo'lda)
 *   ikkalasi turlicha o'zgargan  → ZIDDIYAT: hech qayerga yozilmaydi, Jamshidga xabar
 *   baza yo'q va farq bor        → ZIDDIYAT (kim o'zgartirganini bilib bo'lmaydi)
 *
 * Yozuv darajasida:
 *   faqat sheets'da (bazada yo'q)  → saytga qo'shiladi
 *   faqat saytda (bazada yo'q)     → Sheets'ga qo'shiladi
 *   bazada bor, bir tomonda yo'q   → O'CHIRILMAYDI, xabar (qo'lda hal qilinadi)
 *
 * Bu modul hech narsa o'qimaydi va yozmaydi — faqat reja tuzadi.
 */

export type Qiymat = string | number | boolean | null
export type Yozuv = Record<string, Qiymat>
export type Toplam = Map<string, Yozuv>

export type Sozlama = {
  /** Solishtiriladigan maydonlar */
  maydonlar: readonly string[]
  /** Sheets'ga avtomatik yozib bo'lmaydigan maydonlar — o'zgarsa "qo'lda" bo'ladi */
  sheetsgaYozilmaydi?: readonly string[]
  /** Sheets'ga yangi yozuv qo'shib bo'ladimi (bo'lmasa — "qo'lda") */
  sheetsgaQoshiladi?: boolean
  /** Kalit bo'yicha: bu yozuv faqat Sheets'dan keladi (masalan bo'lingan davr) */
  faqatSheetsdan?: (kalit: string) => boolean
}

export type Amal =
  | { tur: 'saytga-yangi'; kalit: string; yozuv: Yozuv }
  | { tur: 'sheetsga-yangi'; kalit: string; yozuv: Yozuv }
  | { tur: 'saytga'; kalit: string; ozgarish: Yozuv; eski: Yozuv }
  | { tur: 'sheetsga'; kalit: string; ozgarish: Yozuv; eski: Yozuv }
  | { tur: 'ziddiyat'; kalit: string; maydon: string; baza: Qiymat | undefined; sheets: Qiymat; sayt: Qiymat }
  | { tur: 'qolda'; kalit: string; sabab: string; maydon?: string; sheets?: Qiymat; sayt?: Qiymat }
  | { tur: 'yoqoldi'; kalit: string; qayerda: 'sheets' | 'sayt'; yozuv: Yozuv }

export type Reja = {
  amallar: Amal[]
  /** Rejadagi yozuvlar muvaffaqiyatli bajarilsa saqlanadigan yangi baza */
  yangiBaza: Toplam
}

/** Bo'sh qator, bo'sh joy va null bir xil; son matn bo'lib kelsa ham bir xil. */
export function normal(v: Qiymat | undefined): Qiymat {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    const t = v.trim().replace(/\s+/g, ' ')
    return t === '' ? null : t
  }
  return v
}

export function teng(a: Qiymat | undefined, b: Qiymat | undefined): boolean {
  const x = normal(a), y = normal(b)
  if (x === y) return true
  if (x === null || y === null) return false
  if (typeof x === 'number' || typeof y === 'number') return Number(x) === Number(y)
  return String(x) === String(y)
}

function tanla(y: Yozuv, maydonlar: readonly string[]): Yozuv {
  const r: Yozuv = {}
  for (const m of maydonlar) r[m] = normal(y[m])
  return r
}

export function uchTomon(
  baza: Toplam | null,
  sheets: Toplam,
  sayt: Toplam,
  s: Sozlama,
): Reja {
  const amallar: Amal[] = []
  const yangiBaza: Toplam = new Map()
  const yopiq = new Set(s.sheetsgaYozilmaydi ?? [])
  const kalitlar = new Set([...sheets.keys(), ...sayt.keys(), ...(baza?.keys() ?? [])])

  for (const k of [...kalitlar].sort()) {
    const B = baza?.get(k)
    const S = sheets.get(k)
    const D = sayt.get(k)
    const faqatSheets = s.faqatSheetsdan?.(k) ?? false

    if (S && D) {
      const yangi: Yozuv = {}
      const saytga: Yozuv = {}, saytgaEski: Yozuv = {}
      const sheetsga: Yozuv = {}, sheetsgaEski: Yozuv = {}
      for (const m of s.maydonlar) {
        const sv = normal(S[m]), dv = normal(D[m])
        if (teng(sv, dv)) { yangi[m] = sv; continue }
        if (!B) {
          // Oldingi holat yo'q (yangi juftlik): bir tomon bo'sh bo'lsa — to'lganini olamiz
          if (dv === null) { saytga[m] = sv; saytgaEski[m] = dv; yangi[m] = sv; continue }
          if (sv === null && !yopiq.has(m) && !faqatSheets) { sheetsga[m] = dv; sheetsgaEski[m] = sv; yangi[m] = dv; continue }
          amallar.push({ tur: 'ziddiyat', kalit: k, maydon: m, baza: undefined, sheets: sv, sayt: dv })
          yangi[m] = null
          continue
        }
        const bv = normal(B[m])
        if (teng(dv, bv)) {
          saytga[m] = sv; saytgaEski[m] = dv; yangi[m] = sv
        } else if (teng(sv, bv)) {
          if (yopiq.has(m) || faqatSheets) {
            amallar.push({ tur: 'qolda', kalit: k, maydon: m, sabab: 'saytda o‘zgargan, Sheets’ga avtomatik yozilmaydi', sheets: sv, sayt: dv })
            yangi[m] = bv
          } else {
            sheetsga[m] = dv; sheetsgaEski[m] = sv; yangi[m] = dv
          }
        } else {
          amallar.push({ tur: 'ziddiyat', kalit: k, maydon: m, baza: bv, sheets: sv, sayt: dv })
          yangi[m] = bv
        }
      }
      if (Object.keys(saytga).length) amallar.push({ tur: 'saytga', kalit: k, ozgarish: saytga, eski: saytgaEski })
      if (Object.keys(sheetsga).length) amallar.push({ tur: 'sheetsga', kalit: k, ozgarish: sheetsga, eski: sheetsgaEski })
      yangiBaza.set(k, yangi)
    } else if (S) {
      if (B) {
        amallar.push({ tur: 'yoqoldi', kalit: k, qayerda: 'sayt', yozuv: tanla(S, s.maydonlar) })
        yangiBaza.set(k, B)
      } else {
        amallar.push({ tur: 'saytga-yangi', kalit: k, yozuv: tanla(S, s.maydonlar) })
        yangiBaza.set(k, tanla(S, s.maydonlar))
      }
    } else if (D) {
      if (B) {
        amallar.push({ tur: 'yoqoldi', kalit: k, qayerda: 'sheets', yozuv: tanla(D, s.maydonlar) })
        yangiBaza.set(k, B)
      } else if (s.sheetsgaQoshiladi === false || faqatSheets) {
        amallar.push({ tur: 'qolda', kalit: k, sabab: 'faqat saytda bor, Sheets’ga avtomatik qo‘shilmaydi' })
      } else {
        amallar.push({ tur: 'sheetsga-yangi', kalit: k, yozuv: tanla(D, s.maydonlar) })
        yangiBaza.set(k, tanla(D, s.maydonlar))
      }
    }
    // faqat bazada — ikkala tomonda ham yo'q: bazadan tushib qoladi
  }
  return { amallar, yangiBaza }
}

/**
 * Ikkala tomonda bir vaqtda qo'shilgan BIR XIL yozuvni juftlaydi (admin
 * ikkalasiga ham kiritgan). `mos` — ikkita yozuv bitta ekanini aytadi.
 * Natija: sayt kaliti → Sheets kaliti. Bir yozuv faqat bir marta juftlanadi.
 */
export function juftla(
  sheetsYangi: [string, Yozuv][],
  saytYangi: [string, Yozuv][],
  mos: (sheets: Yozuv, sayt: Yozuv) => boolean,
): Map<string, string> {
  const natija = new Map<string, string>()
  const band = new Set<string>()
  for (const [dk, d] of saytYangi) {
    const topildi = sheetsYangi.find(([sk, sv]) => !band.has(sk) && mos(sv, d))
    if (topildi) {
      band.add(topildi[0])
      natija.set(dk, topildi[0])
    }
  }
  return natija
}

/** Holat faylida saqlash uchun */
export function toplamdan(t: Toplam): Record<string, Yozuv> {
  return Object.fromEntries([...t].sort(([a], [b]) => a.localeCompare(b)))
}
export function toplamga(o: Record<string, Yozuv> | undefined): Toplam | null {
  return o ? new Map(Object.entries(o)) : null
}
