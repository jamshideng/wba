/**
 * O'quvchi va ustoz reytingi (0138–0141). Hisob-kitob bazada (reyting_hisobla),
 * bu yerda faqat turlar, nomlar va forma tekshiruvi.
 */

export type Vaznlar = Record<string, number>

export type ReytingSozlama = {
  oylik_sana: number
  test_muddati_kun: number
  boshlanish_sana: string | null
  oquvchi_oylik: { test: number; davomat: number; woblar: number }
  oquvchi_haftalik: { davomat: number; woblar: number }
  ustoz_oylik: { test: number; ushlash: number; kechikish: number; intizom: number; davomat: number }
  ustoz_haftalik: { kechikish: number; intizom: number; davomat: number }
  min_dars_oylik: number
  min_dars_haftalik: number
  woblar_100: number
  bogliq_emas_koef: number
  min_qatnashgan_dars: number
  kechikish_k: number
  intizom_n: number
}

export type VaznGuruhi = 'oquvchi_oylik' | 'oquvchi_haftalik' | 'ustoz_oylik' | 'ustoz_haftalik'

/** Formadagi vaznlar to'plamlari — tartib va nomlar bilan */
export const VAZN_GURUHLARI: { kalit: VaznGuruhi; nom: string; omillar: { kalit: string; nom: string }[] }[] = [
  {
    kalit: 'oquvchi_oylik',
    nom: 'O‘quvchi — oylik',
    omillar: [
      { kalit: 'test', nom: 'Oylik test' },
      { kalit: 'davomat', nom: 'Davomat' },
      { kalit: 'woblar', nom: 'Woblar' },
    ],
  },
  {
    kalit: 'oquvchi_haftalik',
    nom: 'O‘quvchi — haftalik',
    omillar: [
      { kalit: 'davomat', nom: 'Davomat' },
      { kalit: 'woblar', nom: 'Woblar' },
    ],
  },
  {
    kalit: 'ustoz_oylik',
    nom: 'Ustoz — oylik',
    omillar: [
      { kalit: 'test', nom: 'O‘quvchilar testi' },
      { kalit: 'ushlash', nom: 'Ushlab qolish' },
      { kalit: 'kechikish', nom: 'Kechikishlar' },
      { kalit: 'intizom', nom: 'Intizom' },
      { kalit: 'davomat', nom: 'Guruh davomati' },
    ],
  },
  {
    kalit: 'ustoz_haftalik',
    nom: 'Ustoz — haftalik',
    omillar: [
      { kalit: 'kechikish', nom: 'Kechikishlar' },
      { kalit: 'intizom', nom: 'Intizom' },
      { kalit: 'davomat', nom: 'Guruh davomati' },
    ],
  },
]

/** Vaznlar yig'indisi 100 bo'lmasa — xato matni (baza ham tekshiradi) */
export function vaznXatosi(guruh: string, v: Vaznlar): string | null {
  const jami = Object.values(v).reduce((a, b) => a + (Number.isFinite(b) ? b : NaN), 0)
  if (!Number.isFinite(jami)) return `${guruh}: vaznlar son bo‘lishi kerak.`
  if (Object.values(v).some((x) => x < 0)) return `${guruh}: vazn manfiy bo‘lmaydi.`
  if (Math.abs(jami - 100) > 1e-9) return `${guruh}: vaznlar yig‘indisi 100% bo‘lishi kerak (hozir ${jami}%).`
  return null
}

/** Ketish izohi: kamida 3 so'z va 15 belgi (0138, bazadagi ketish_izoh_yaroqli bilan bir xil) */
export function ketishIzohiYaroqli(izoh: string | null | undefined): boolean {
  const s = (izoh ?? '').trim()
  return s.length >= 15 && s.split(/\s+/).filter(Boolean).length >= 3
}

export const KETISH_IZOH_TALABI = 'Izoh majburiy: kamida 3 so‘z va 15 belgi'

/** Brauzer tekshiruvi (pattern): kamida 3 so'z. 15 belgi — minLength bilan */
export const KETISH_IZOH_NAQSH = '\\s*\\S+(\\s+\\S+){2,}\\s*'

export type ReytingTur = 'haftalik' | 'oylik'

/** Davr nomi: "2026-11" → "Noyabr 2026", haftalik → "17.11–23.11" */
const OYLAR = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

export function davrNomi(tur: ReytingTur, dan: string, gacha: string): string {
  if (tur === 'oylik') return `${OYLAR[Number(dan.slice(5, 7)) - 1]} ${dan.slice(0, 4)}`
  const k = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}`
  return `${k(dan)}–${k(gacha)}`
}

export type ReytingDavr = { id: number; tur: ReytingTur; dan: string; gacha: string; hisoblangan: string }

export type GuruhReytingQatori = {
  orin: number | null
  student_id: string
  fish: string
  umumiy: number
  davomat: number | null
  woblar: number | null
  test: number | null
  darslar: number | null
  kelgan: number | null
  yangi: boolean
  menmi: boolean
}

export type FanReytingQatori = Omit<GuruhReytingQatori, 'yangi'> & { guruh: string | null; jami: number | null }

export type ReytingTarixQatori = {
  davr_id: number
  tur: ReytingTur
  dan: string
  gacha: string
  group_id: string
  guruh: string
  subject_id: string | null
  fan: string | null
  orin_guruh: number | null
  guruh_soni: number
  orin_fan: number | null
  umumiy: number
  davomat: number
  woblar: number
  test: number | null
  yangi: boolean
}

export type UstozReytingQatori = {
  orin: number | null
  teacher_id: string
  ism: string
  umumiy: number
  test: number | null
  ushlash: number
  kechikish: number
  intizom: number
  davomat: number
  darslar: number
  guruhlar: number
  oquvchilar: number
  ketish: number
  kechikish_daqiqa: number
  hodisalar: number
  tafsilot: {
    nazorat: number
    ogohlantirish: number
    davomat_kech: number
    test_yoq: number
    test_kech: number
    ketganlar: { student_id: string; group_id: string; sabab: string | null; vazn: number }[]
  }
}

export type UstozTarixQatori = { davr_id: number; tur: ReytingTur; dan: string; gacha: string; orin: number | null; jami: number; umumiy: number }

/** Ball rangi: 85+ yaxshi, 70+ o'rta, qolgani past */
export function ballTon(b: number | null | undefined): 'ok' | 'accent' | 'brand' | 'jim' {
  if (b == null) return 'jim'
  return b >= 85 ? 'ok' : b >= 70 ? 'accent' : 'brand'
}
