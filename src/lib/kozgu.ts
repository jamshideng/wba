import 'server-only'
import { google, type sheets_v4 } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * BAZA → GOOGLE SHEETS KO'ZGUSI.
 *
 * Qaror (20.09): sayt asosiy manba, Sheets esa ko'rish va tahlil uchun.
 * Yo'nalish BITTA: bazadan jadvalga. Jadvalga yozilgan narsa bazaga qaytmaydi.
 *
 * Ko'zgu Students_wba ning O'ZIDA, lekin ESKI VARAQLARGA TEGMAYDI
 * (Jamshid: "mendagi sheetsga tegma"): faqat `BAZA_` bilan boshlanadigan
 * varaqlar yoziladi — yo'q bo'lsa ochiladi, bori har safar qayta yoziladi.
 *
 * Tuzilma Students_wba dagidek (02.10): o'quvchi va qatnashuv BITTA varaqda,
 * 1 qator = 1 bola × 1 fan. Hisob ustunlari — FORMULA (To'lovlar va
 * Hisoblar varaqlaridan), shuning uchun Sheets'da filtrlab, saralab,
 * BAZA_Panel'da tanlab tahlil qilsa bo'ladi.
 * Jadval ID: KOZGU_SHEETS_ID (Students_wba).
 */

type Katak = string | number
type Tur = 'matn' | 'pul' | 'sana' | 'son'
type Ustun = { nom: string; en: number; tur?: Tur; f?: boolean }
type Varaq = {
  nom: string
  ustunlar?: Ustun[]
  qatorlar: Katak[][]
  muzlat?: [number, number]
  /** Shartli formatlash: Qarz ustuni, Holat ustuni (harfi) */
  qarzUstun?: string
  holatUstun?: string
  /** Faqat BAZA_Panel: C2:C4 tanlov ro'yxatlari */
  tanlov?: { holat: string[]; fan: string[]; ustoz: string[] }
}

const som = (n: unknown) => Number(n ?? 0)
/** Matn — USER_ENTERED da formula yoki sana bo'lib ketmasin (+998…, =, 2026-09) */
const m = (v: unknown) => {
  if (v == null || v === '') return ''
  const s = String(v)
  return /^[=+\-@]/.test(s) || /^\d{4}-\d{2}$/.test(s) ? `'${s}` : s
}
/** Sana (YYYY-MM-DD) — Sheets'da haqiqiy sana bo'lsin */
const sana = (v: unknown) => (v ? String(v).slice(0, 10) : '')
const katta = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const SAHIFA = 1000
async function hammasi<T>(
  soro: (dan: number, gacha: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const chiq: T[] = []
  for (let dan = 0; ; dan += SAHIFA) {
    const { data, error } = await soro(dan, dan + SAHIFA - 1)
    if (error) throw new Error(error.message)
    const bolak = data ?? []
    chiq.push(...bolak)
    if (bolak.length < SAHIFA) return chiq
  }
}

const KUN: Record<string, string> = { toq: 'Toq kun', juft: 'Juft kun', dam_olish: 'Dam olish' }
/** "Matematika · Farrux · 10:00-11:30, Toq kun" → "10:00-11:30" */
const darsVaqti = (nom: string) => nom.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/)?.[1] ?? ''

/* ── Formula yordamchilari (qator raqami bilan) ── */
const O = 'BAZA_Oquvchilar'
const T = 'BAZA_Tolovlar'
const H = 'BAZA_Hisoblar'
const G = 'BAZA_Guruhlar'

/** Bazadan hamma bo'limni o'qiydi va varaqlarga aylantiradi. */
export async function kozguVaraqlari(): Promise<Varaq[]> {
  const db = createAdminClient()

  const [oquvchilar, guruhlar, ustozlar, fanlar, yozilishlar, tolovlar, hisoblar, davomat] = await Promise.all([
    hammasi((a, b) => db.from('students').select('id, fish, tugilgan_sana, ota_tel, ona_tel, shaxsiy_tel, qoshilgan_sana, holat, izoh, qaytish_sana').order('id').range(a, b)),
    hammasi((a, b) => db.from('groups').select('id, nom, subject_id, teacher_id, boshlanish, tugash, kun_turi, oylik_narx, sigim, holat').order('id').range(a, b)),
    hammasi((a, b) => db.from('teachers').select('id, ism, telefon, telegram_id, holat').order('id').range(a, b)),
    hammasi((a, b) => db.from('subjects').select('id, nom').range(a, b)),
    hammasi((a, b) => db.from('enrollments').select('id, student_id, group_id, boshlandi, tugadi, chegirma_summa, chegirma_oy, chegirma2_summa, chegirma2_oy, holat, vip').order('student_id').range(a, b)),
    hammasi((a, b) => db.from('payments').select('id, sana, student_id, enrollment_id, davr, summa, usul, tasdiqlangan, bekor, izoh, manba').order('sana').range(a, b)),
    hammasi((a, b) => db.from('invoices').select('enrollment_id, davr, summa, chegirma, holat').order('davr').range(a, b)),
    hammasi((a, b) => db.from('attendance').select('student_id, holat, lessons(sana, group_id)').order('created_at').range(a, b)),
  ])

  const fanNomi = new Map(fanlar.map((f) => [f.id, f.nom]))
  const uNomi = new Map(ustozlar.map((u) => [u.id, u.ism]))
  const guruh = new Map(guruhlar.map((g) => [g.id, g]))
  const gNomi = (id: string | null | undefined) => (id ? (guruh.get(id)?.nom ?? id) : '')
  const oquvchi = new Map(oquvchilar.map((o) => [o.id, o]))
  const yozilish = new Map(yozilishlar.map((y) => [y.id, y]))
  const vaqt = new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })

  /* ── O'quvchilar (+ qatnashuv): 1 qator = 1 bola × 1 fan ── */
  type Q = { o: (typeof oquvchilar)[number]; y: (typeof yozilishlar)[number] | null }
  const qatorlarQ: Q[] = []
  const yBor = new Set<string>()
  for (const y of yozilishlar) {
    const o = oquvchi.get(y.student_id)
    if (!o) continue
    yBor.add(o.id)
    qatorlarQ.push({ o, y })
  }
  for (const o of oquvchilar) if (!yBor.has(o.id)) qatorlarQ.push({ o, y: null })
  qatorlarQ.sort((a, b) => a.o.id.localeCompare(b.o.id) || String(a.y?.boshlandi ?? '').localeCompare(String(b.y?.boshlandi ?? '')))

  const holatNomi = ({ o, y }: Q) =>
    o.holat === 'ketgan' ? 'Ketgan'
    : y?.holat === 'tugagan' ? 'Tugagan'
    : o.qaytish_sana ? 'Tanaffus'
    : y?.vip ? 'VIP'
    : katta(o.holat)

  const oqUstun: Ustun[] = [
    { nom: 'ID', en: 70 }, { nom: 'Ism familya', en: 200 }, { nom: 'Tug‘ilgan sana', en: 105, tur: 'sana' },
    { nom: 'Yosh', en: 50, tur: 'son', f: true }, { nom: 'Ota telefoni', en: 135 }, { nom: 'Ona telefoni', en: 135 },
    { nom: 'Shaxsiy telefon', en: 135 }, { nom: 'Guruh', en: 280 }, { nom: 'Yo‘nalish', en: 120, f: true },
    { nom: 'O‘qituvchi', en: 150, f: true }, { nom: 'Dars vaqti', en: 100, f: true }, { nom: 'Oylik narx', en: 95, tur: 'pul', f: true },
    { nom: 'Qo‘shilgan sana', en: 105, tur: 'sana' }, { nom: 'Holat', en: 85 }, { nom: 'Izoh', en: 160 },
    { nom: 'Jami to‘langan', en: 110, tur: 'pul', f: true }, { nom: 'Oylar', en: 55, tur: 'son', f: true },
    { nom: 'Chegirma', en: 95, tur: 'pul', f: true }, { nom: 'To‘lashi kerak', en: 110, tur: 'pul', f: true },
    { nom: 'Qarz', en: 100, tur: 'pul', f: true }, { nom: 'Oxirgi to‘lov', en: 105, tur: 'sana', f: true },
    { nom: 'Tugadi', en: 95, tur: 'sana' }, { nom: '1-chegirma', en: 90, tur: 'pul' }, { nom: '1-necha oy', en: 75, tur: 'son' },
    { nom: '2-chegirma', en: 90, tur: 'pul' }, { nom: '2-necha oy', en: 75, tur: 'son' }, { nom: 'Qatnashuv ID', en: 120 },
  ]
  const oqQatorlar: Katak[][] = qatorlarQ.map((q, i) => {
    const r = i + 2
    const { o, y } = q
    const k = `$AA${r}`
    const tSh = `${T}!$F:$F,${k},${T}!$K:$K,"<>ha"`
    return [
      o.id, m(o.fish), sana(o.tugilgan_sana),
      `=IF($C${r}="","",DATEDIF($C${r},TODAY(),"Y"))`,
      m(o.ota_tel), m(o.ona_tel), m(o.shaxsiy_tel),
      m(gNomi(y?.group_id)),
      `=IF($H${r}="","",IFERROR(INDEX(${G}!$C:$C,MATCH($H${r},${G}!$B:$B,0)),""))`,
      `=IF($H${r}="","",IFERROR(INDEX(${G}!$D:$D,MATCH($H${r},${G}!$B:$B,0)),""))`,
      `=IF($H${r}="","",IFERROR(INDEX(${G}!$H:$H,MATCH($H${r},${G}!$B:$B,0)),""))`,
      `=IF($H${r}="","",IFERROR(INDEX(${G}!$I:$I,MATCH($H${r},${G}!$B:$B,0)),0))`,
      sana(y?.boshlandi ?? o.qoshilgan_sana), holatNomi(q), m(o.izoh),
      `=IF($AA${r}="",0,SUMIFS(${T}!$H:$H,${tSh}))`,
      `=IF($AA${r}="",0,COUNTIFS(${H}!$A:$A,${k},${H}!$G:$G,"<>bekor"))`,
      `=IF($AA${r}="",0,SUMIFS(${H}!$F:$F,${H}!$A:$A,${k},${H}!$G:$G,"<>bekor"))`,
      `=IF($AA${r}="",0,SUMIFS(${H}!$E:$E,${H}!$A:$A,${k},${H}!$G:$G,"<>bekor"))`,
      `=N($S${r})-N($P${r})`,
      `=IF($AA${r}="","",LET(x,MAXIFS(${T}!$C:$C,${tSh}),IF(x=0,"",x)))`,
      sana(y?.tugadi), y?.chegirma_summa ? som(y.chegirma_summa) : '', y?.chegirma_oy ?? '',
      y?.chegirma2_summa ? som(y.chegirma2_summa) : '', y?.chegirma2_oy ?? '', y?.id ?? '',
    ]
  })

  /* ── Guruhlar ── */
  const gUstun: Ustun[] = [
    { nom: 'Guruh ID', en: 80 }, { nom: 'Guruh nomi', en: 280 }, { nom: 'Yo‘nalish', en: 120 }, { nom: 'O‘qituvchi', en: 150 },
    { nom: 'Boshlanish', en: 100, tur: 'sana' }, { nom: 'Tugash', en: 100, tur: 'sana' }, { nom: 'Kun', en: 90 },
    { nom: 'Dars vaqti', en: 100 }, { nom: 'Oylik narx', en: 100, tur: 'pul' }, { nom: 'O‘quvchilar', en: 90, tur: 'son', f: true },
    { nom: 'Holat', en: 80 }, { nom: 'Sig‘im', en: 65, tur: 'son' }, { nom: 'To‘lashi kerak', en: 115, tur: 'pul', f: true },
    { nom: 'To‘langan', en: 110, tur: 'pul', f: true }, { nom: 'Qarz', en: 100, tur: 'pul', f: true },
  ]
  const gQatorlar: Katak[][] = guruhlar.map((g, i) => {
    const r = i + 2
    const o = `${O}!$H:$H,$B${r}`
    return [
      g.id, m(g.nom), m(fanNomi.get(g.subject_id ?? '') ?? g.subject_id ?? ''), m(uNomi.get(g.teacher_id ?? '') ?? ''),
      sana(g.boshlanish), sana(g.tugash), KUN[g.kun_turi as string] ?? m(g.kun_turi), darsVaqti(g.nom), som(g.oylik_narx),
      `=COUNTIFS(${o},${O}!$N:$N,"Faol")+COUNTIFS(${o},${O}!$N:$N,"VIP")+COUNTIFS(${o},${O}!$N:$N,"Tanaffus")`,
      katta(g.holat), g.sigim ?? '',
      `=SUMIFS(${O}!$S:$S,${o})`, `=SUMIFS(${O}!$P:$P,${o})`, `=SUMIFS(${O}!$T:$T,${o})`,
    ]
  })

  /* ── Ustozlar ── */
  const uUstun: Ustun[] = [
    { nom: 'ID', en: 60 }, { nom: 'O‘qituvchi', en: 170 }, { nom: 'Telefon', en: 135 }, { nom: 'Telegram ID', en: 110 },
    { nom: 'Holat', en: 80 }, { nom: 'Guruhlari', en: 80, tur: 'son', f: true }, { nom: 'O‘quvchilari', en: 95, tur: 'son', f: true },
    { nom: 'To‘langan', en: 110, tur: 'pul', f: true }, { nom: 'Qarz', en: 100, tur: 'pul', f: true },
  ]
  const uQatorlar: Katak[][] = ustozlar.map((u, i) => {
    const r = i + 2
    const o = `${O}!$J:$J,$B${r}`
    return [
      u.id, m(u.ism), m(u.telefon), m(u.telegram_id), katta(u.holat),
      `=COUNTIFS(${G}!$D:$D,$B${r},${G}!$K:$K,"Faol")`,
      `=COUNTIFS(${o},${O}!$N:$N,"Faol")+COUNTIFS(${o},${O}!$N:$N,"VIP")+COUNTIFS(${o},${O}!$N:$N,"Tanaffus")`,
      `=SUMIFS(${O}!$P:$P,${o})`, `=SUMIFS(${O}!$T:$T,${o})`,
    ]
  })

  /* ── To'lovlar ── */
  const tUstun: Ustun[] = [
    { nom: 'ID', en: 70 }, { nom: 'O‘quvchi ID', en: 85 }, { nom: 'Sana', en: 100, tur: 'sana' }, { nom: 'O‘quvchi', en: 190 },
    { nom: 'Guruh', en: 260 }, { nom: 'Qatnashuv ID', en: 120 }, { nom: 'Davr', en: 75 }, { nom: 'Summa', en: 100, tur: 'pul' },
    { nom: 'Usul', en: 75 }, { nom: 'Tasdiqlangan', en: 95 }, { nom: 'Bekor', en: 60 }, { nom: 'Manba', en: 70 },
    { nom: 'Izoh', en: 160 }, { nom: 'Yo‘nalish', en: 120, f: true }, { nom: 'O‘qituvchi', en: 150, f: true },
  ]
  const tQatorlar: Katak[][] = tolovlar.map((t, i) => {
    const r = i + 2
    const y = t.enrollment_id ? yozilish.get(t.enrollment_id) : null
    return [
      t.id, t.student_id, sana(t.sana), m(oquvchi.get(t.student_id)?.fish ?? ''), m(gNomi(y?.group_id)), t.enrollment_id ?? '',
      m(t.davr), som(t.summa), m(t.usul), t.tasdiqlangan ? 'ha' : 'yo‘q', t.bekor ? 'ha' : 'yo‘q', m(t.manba), m(t.izoh),
      `=IF($E${r}="","",IFERROR(INDEX(${G}!$C:$C,MATCH($E${r},${G}!$B:$B,0)),""))`,
      `=IF($E${r}="","",IFERROR(INDEX(${G}!$D:$D,MATCH($E${r},${G}!$B:$B,0)),""))`,
    ]
  })

  /* ── Hisoblar (har oy hisoblangan summa) ── */
  const hUstun: Ustun[] = [
    { nom: 'Qatnashuv ID', en: 120 }, { nom: 'Davr', en: 75 }, { nom: 'O‘quvchi ID', en: 85 }, { nom: 'O‘quvchi', en: 190 },
    { nom: 'To‘lashi kerak', en: 110, tur: 'pul' }, { nom: 'Chegirma', en: 95, tur: 'pul' }, { nom: 'Holat', en: 70 }, { nom: 'Guruh', en: 260 },
  ]
  const hQatorlar: Katak[][] = hisoblar.map((h) => {
    const y = yozilish.get(h.enrollment_id)
    return [h.enrollment_id, m(h.davr), y?.student_id ?? '', m(oquvchi.get(y?.student_id ?? '')?.fish ?? ''), som(h.summa), som(h.chegirma), m(h.holat), m(gNomi(y?.group_id))]
  })

  /* ── Davomat (qiymat, formulasiz — qator ko'p) ── */
  const dUstun: Ustun[] = [
    { nom: 'Sana', en: 100, tur: 'sana' }, { nom: 'Guruh', en: 260 }, { nom: 'Yo‘nalish', en: 120 }, { nom: 'O‘qituvchi', en: 150 },
    { nom: 'O‘quvchi ID', en: 85 }, { nom: 'O‘quvchi', en: 190 }, { nom: 'Holat', en: 80 },
  ]
  const dQatorlar: Katak[][] = (davomat as unknown as { student_id: string; holat: string; lessons: { sana: string; group_id: string } | null }[])
    .map((a) => {
      const g = guruh.get(a.lessons?.group_id ?? '')
      return [sana(a.lessons?.sana), m(g?.nom ?? a.lessons?.group_id ?? ''), m(fanNomi.get(g?.subject_id ?? '') ?? ''), m(uNomi.get(g?.teacher_id ?? '') ?? ''), a.student_id, m(oquvchi.get(a.student_id)?.fish ?? ''), katta(a.holat)]
    })
    .sort((x, y) => String(x[0]).localeCompare(String(y[0])))

  /* ── Panel: tanlab tahlil ── */
  const fanRoyxat = [...new Set(guruhlar.map((g) => fanNomi.get(g.subject_id ?? '') ?? '').filter(Boolean))].sort()
  const uRoyxat = [...new Set(ustozlar.map((u) => u.ism).filter(Boolean))].sort()

  return [
    {
      nom: 'BAZA_Panel',
      qatorlar: panelQatorlar(vaqt),
      ustunlar: [{ nom: '', en: 190 }, { nom: '', en: 150 }, { nom: '', en: 30 }, { nom: '', en: 170 }, { nom: '', en: 80 }, { nom: '', en: 120 }, { nom: '', en: 120 }, { nom: '', en: 120 }],
      tanlov: { holat: ['Hammasi', 'Faol', 'VIP', 'Tanaffus', 'Tugagan', 'Ketgan'], fan: ['Hammasi', ...fanRoyxat], ustoz: ['Hammasi', ...uRoyxat] },
    },
    { nom: O, ustunlar: oqUstun, qatorlar: [oqUstun.map((u) => u.nom), ...oqQatorlar], muzlat: [1, 2], qarzUstun: 'T', holatUstun: 'N' },
    { nom: G, ustunlar: gUstun, qatorlar: [gUstun.map((u) => u.nom), ...gQatorlar], muzlat: [1, 2], qarzUstun: 'O', holatUstun: 'K' },
    { nom: 'BAZA_Ustozlar', ustunlar: uUstun, qatorlar: [uUstun.map((u) => u.nom), ...uQatorlar], muzlat: [1, 2], qarzUstun: 'I', holatUstun: 'E' },
    { nom: T, ustunlar: tUstun, qatorlar: [tUstun.map((u) => u.nom), ...tQatorlar], muzlat: [1, 0] },
    { nom: H, ustunlar: hUstun, qatorlar: [hUstun.map((u) => u.nom), ...hQatorlar], muzlat: [1, 0] },
    { nom: 'BAZA_Davomat', ustunlar: dUstun, qatorlar: [dUstun.map((u) => u.nom), ...dQatorlar], muzlat: [1, 0] },
    {
      nom: 'BAZA_Qatnashuv',
      qatorlar: [['Qatnashuv endi BAZA_Oquvchilar varag‘ida (1 qator = 1 bola × 1 fan) — bu varaq yangilanmaydi.']],
    },
    {
      nom: 'BAZA_Malumot',
      qatorlar: [
        ['WBA — bazadan ko‘zgu'],
        ['Oxirgi yangilanish', vaqt],
        [''],
        ['Bu varaqlar SAYTDAGI bazadan avtomatik to‘ldiriladi (har 3 soatda).'],
        ['Bu yerga yozilgan narsa bazaga QAYTMAYDI — ish sayt orqali qilinadi.'],
        ['Tahlil — BAZA_Panel: yuqoridagi tanlovlarni o‘zgartiring, hammasi qayta hisoblanadi.'],
        ['BAZA_Oquvchilar — Students_wba dagi O‘quvchilar kabi: 1 qator = 1 bola × 1 fan, hisob ustunlari formula.'],
        [''],
        ['O‘quvchilar', oquvchilar.length],
        ['Qatnashuv (fan bo‘yicha qator)', yozilishlar.length],
        ['Guruhlar', guruhlar.length],
        ['Ustozlar', ustozlar.length],
        ['To‘lovlar', tolovlar.length],
        ['Davomat belgilari', davomat.length],
      ],
    },
  ]
}

/**
 * Panel: C2:C4 — tanlovlar (Holat, Yo'nalish, O'qituvchi). Hamma raqam va
 * jadval shu tanlovlarga qarab qayta hisoblanadi (SUMPRODUCT / QUERY).
 */
function panelQatorlar(vaqt: string): Katak[][] {
  const R = 2000
  const col = (c: string) => `${O}!$${c}$2:$${c}$${R}`
  // Tanlov sharti (massiv): Hammasi bo'lsa — 1
  const shart =
    `(${col('A')}<>"")` +
    `*(($C$2="Hammasi")+(${col('N')}=$C$2)>0)` +
    `*(($C$3="Hammasi")+(${col('I')}=$C$3)>0)` +
    `*(($C$4="Hammasi")+(${col('J')}=$C$4)>0)`
  const qShart =
    `"where A is not null"` +
    `&IF($C$2="Hammasi",""," and N = """&$C$2&"""")` +
    `&IF($C$3="Hammasi",""," and I = """&$C$3&"""")` +
    `&IF($C$4="Hammasi",""," and J = """&$C$4&"""")`
  const query = (sel: string, guruhla: string, tartib: string, label: string) =>
    `=IFERROR(QUERY(${O}!$A$1:$AA$${R},"select ${sel} "&${qShart}&" group by ${guruhla} order by ${tartib} label ${label}",1),"Ma’lumot yo‘q")`

  return [
    ['WBA — tahlil paneli', '', '', `Oxirgi yangilanish: ${vaqt}`],
    ['Holat', '', 'Hammasi', 'Tanlovni o‘zgartiring — hamma raqam, jadval va grafik qayta hisoblanadi'],
    ['Yo‘nalish', '', 'Hammasi'],
    ['O‘qituvchi', '', 'Hammasi'],
    [''],
    ['Ko‘rsatkich', '', 'Qiymat'],
    ['Qatnashuvlar (bola × fan)', '', `=SUMPRODUCT(${shart})`],
    ['O‘quvchilar (har biri bir marta)', '', `=IFERROR(COUNTUNIQUE(FILTER(${col('A')},${shart})),0)`],
    ['To‘lashi kerak', '', `=SUMPRODUCT(${shart},${col('S')})`],
    ['To‘langan', '', `=SUMPRODUCT(${shart},${col('P')})`],
    ['Qarz', '', `=SUMPRODUCT(${shart},${col('T')})`],
    ['Chegirma', '', `=SUMPRODUCT(${shart},${col('R')})`],
    ['Qarzdorlar soni', '', `=SUMPRODUCT(${shart}*(${col('T')}>0))`],
    ['To‘lov foizi', '', `=IFERROR(C10/C9,0)`],
    [''],
    ['Yo‘nalish bo‘yicha', '', '', query('I, count(A), sum(S), sum(P), sum(T)', 'I', 'sum(T) desc', `I 'Yo‘nalish', count(A) 'Soni', sum(S) 'To‘lashi kerak', sum(P) 'To‘langan', sum(T) 'Qarz'`)],
    ...Array.from({ length: 13 }, () => ['']),
    ['O‘qituvchi bo‘yicha', '', '', query('J, count(A), sum(S), sum(P), sum(T)', 'J', 'sum(T) desc', `J 'O‘qituvchi', count(A) 'Soni', sum(S) 'To‘lashi kerak', sum(P) 'To‘langan', sum(T) 'Qarz'`)],
    ...Array.from({ length: 13 }, () => ['']),
    ['Holat bo‘yicha', '', '', query('N, count(A), sum(T)', 'N', 'count(A) desc', `N 'Holat', count(A) 'Soni', sum(T) 'Qarz'`)],
    ...Array.from({ length: 8 }, () => ['']),
    ['Oylik tushum (to‘lovlar, bekorsiz)', '', '', `=IFERROR(QUERY(${T}!$A$1:$O$5000,"select G, sum(H), count(A) where A is not null and K <> 'ha' group by G order by G label G 'Davr', sum(H) 'Tushum', count(A) 'To‘lovlar'",1),"Ma’lumot yo‘q")`],
    ...Array.from({ length: 13 }, () => ['']),
    ['Eng katta qarzlar (tanlov bo‘yicha)', '', '', `=IFERROR(QUERY(${O}!$A$1:$AA$${R},"select A, B, H, T "&${qShart}&" and T > 0 order by T desc limit 20 label A 'ID', B 'Ism familya', H 'Guruh', T 'Qarz'",1),"Qarz yo‘q")`],
  ]
}

/** Google auth — Vercel'da JSON muhit o'zgaruvchisi, lokalda fayl. */
function auth() {
  const xom = process.env.GOOGLE_SA_JSON
  const scopes = ['https://www.googleapis.com/auth/spreadsheets']
  if (xom) return new google.auth.GoogleAuth({ credentials: JSON.parse(xom), scopes })
  return new google.auth.GoogleAuth({ keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, scopes })
}

/* ── Dizayn (Students_wba ranglari) ── */
const RANG = {
  sarlavha: { red: 0.0706, green: 0.3294, blue: 0.3608 },
  oq: { red: 1, green: 1, blue: 1 },
  qiymat: { red: 0.9882, green: 0.949, blue: 0.8745 },
  formula: { red: 0.9255, green: 0.9451, blue: 0.9569 },
  qizil: { red: 0.8, green: 0.1, blue: 0.1 },
  kulrang: { red: 0.6, green: 0.647, blue: 0.678 },
  kulrangFon: { red: 0.953, green: 0.957, blue: 0.961 },
  vip: { red: 0.906, green: 0.871, blue: 0.976 },
  tanlov: { red: 1, green: 0.949, blue: 0.8 },
}
const FORMAT: Record<Tur, sheets_v4.Schema$NumberFormat | undefined> = {
  pul: { type: 'NUMBER', pattern: '#,##0' },
  sana: { type: 'DATE', pattern: 'dd.MM.yyyy' },
  son: { type: 'NUMBER', pattern: '0' },
  matn: undefined,
}
const indeks = (h: string) => [...h].reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0) - 1

function dizayn(v: Varaq, sheetId: number, qatorSoni: number): sheets_v4.Schema$Request[] {
  const req: sheets_v4.Schema$Request[] = []
  const ust = v.ustunlar ?? []
  const n = Math.max(qatorSoni, 2)
  // Hamma formatni tozalab boshlaymiz (oldingi ishga tushirishdan qolmasin)
  req.push({ repeatCell: { range: { sheetId }, cell: { userEnteredFormat: {} }, fields: 'userEnteredFormat' } })
  ust.forEach((u, i) => {
    req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: u.en }, fields: 'pixelSize' } })
  })

  if (v.nom === 'BAZA_Panel') {
    const t = v.tanlov!
    const sarlavha = (r: number, c1: number, c2: number) => ({
      repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: c1, endColumnIndex: c2 }, cell: { userEnteredFormat: { backgroundColor: RANG.sarlavha, textFormat: { bold: true, foregroundColor: RANG.oq } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' },
    })
    req.push({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }, fields: 'userEnteredFormat.textFormat' } })
    // Tanlovlar
    ;[t.holat, t.fan, t.ustoz].forEach((royxat, i) => {
      req.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1 + i, endRowIndex: 2 + i, startColumnIndex: 2, endColumnIndex: 3 },
          rule: { condition: { type: 'ONE_OF_LIST', values: royxat.map((x) => ({ userEnteredValue: x })) }, showCustomUi: true, strict: true },
        },
      })
    })
    req.push({ repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 4, startColumnIndex: 2, endColumnIndex: 3 }, cell: { userEnteredFormat: { backgroundColor: RANG.tanlov, textFormat: { bold: true } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } })
    req.push({ repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } })
    req.push(sarlavha(5, 0, 3))
    req.push({ repeatCell: { range: { sheetId, startRowIndex: 6, endRowIndex: 13, startColumnIndex: 2, endColumnIndex: 3 }, cell: { userEnteredFormat: { numberFormat: FORMAT.pul, textFormat: { bold: true } } }, fields: 'userEnteredFormat(numberFormat,textFormat)' } })
    req.push({ repeatCell: { range: { sheetId, startRowIndex: 13, endRowIndex: 14, startColumnIndex: 2, endColumnIndex: 3 }, cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0%' }, textFormat: { bold: true } } }, fields: 'userEnteredFormat(numberFormat,textFormat)' } })
    req.push({ repeatCell: { range: { sheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: 2, endColumnIndex: 3 }, cell: { userEnteredFormat: { numberFormat: FORMAT.pul, textFormat: { bold: true, foregroundColor: RANG.qizil } } }, fields: 'userEnteredFormat(numberFormat,textFormat)' } })
    // Jadval bloklari: sarlavha + pul formati
    for (const r of PANEL_BLOK) {
      req.push({ repeatCell: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat' } })
      req.push(sarlavha(r, 3, 8))
      req.push({ repeatCell: { range: { sheetId, startRowIndex: r + 1, endRowIndex: r + 21, startColumnIndex: 4, endColumnIndex: 8 }, cell: { userEnteredFormat: { numberFormat: FORMAT.pul } }, fields: 'userEnteredFormat.numberFormat' } })
    }
    return req
  }

  if (!ust.length) return req
  // Sarlavha
  req.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: ust.length },
      cell: { userEnteredFormat: { backgroundColor: RANG.sarlavha, textFormat: { bold: true, foregroundColor: RANG.oq }, verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP' } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)',
    },
  })
  // Ustunlar: rang (qiymat / formula) va son formati
  ust.forEach((u, i) => {
    req.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: n, startColumnIndex: i, endColumnIndex: i + 1 },
        cell: { userEnteredFormat: { backgroundColor: u.f ? RANG.formula : RANG.qiymat, ...(u.tur && FORMAT[u.tur] ? { numberFormat: FORMAT[u.tur] } : {}) } },
        fields: 'userEnteredFormat(backgroundColor,numberFormat)',
      },
    })
  })
  // Muzlatish + filtr (har kim o'zi saralab, filtrlab ko'radi)
  const [mq, mu] = v.muzlat ?? [1, 0]
  req.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: mq, frozenColumnCount: mu } }, fields: 'gridProperties(frozenRowCount,frozenColumnCount)' } })
  req.push({ setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: n, startColumnIndex: 0, endColumnIndex: ust.length } } } })
  // Shartli formatlash
  const butun = { sheetId, startRowIndex: 1, endRowIndex: n, startColumnIndex: 0, endColumnIndex: ust.length }
  if (v.holatUstun) {
    req.push({ addConditionalFormatRule: { index: 0, rule: { ranges: [butun], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=OR($${v.holatUstun}2="Ketgan",$${v.holatUstun}2="Tugagan",$${v.holatUstun}2="Arxiv")` }] }, format: { backgroundColor: RANG.kulrangFon, textFormat: { foregroundColor: RANG.kulrang } } } } } })
    const hi = indeks(v.holatUstun)
    req.push({ addConditionalFormatRule: { index: 0, rule: { ranges: [{ ...butun, startColumnIndex: hi, endColumnIndex: hi + 1 }], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'VIP' }] }, format: { backgroundColor: RANG.vip, textFormat: { bold: true } } } } } })
  }
  if (v.qarzUstun) {
    const qi = indeks(v.qarzUstun)
    req.push({ addConditionalFormatRule: { index: 0, rule: { ranges: [{ ...butun, startColumnIndex: qi, endColumnIndex: qi + 1 }], booleanRule: { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] }, format: { textFormat: { foregroundColor: RANG.qizil, bold: true } } } } } })
  }
  return req
}

/** Panelda jadval bloklari boshlanadigan qatorlar (0 dan) — panelQatorlar bilan mos */
const PANEL_BLOK = [15, 29, 43, 52, 66]

/** Ko'zguni yozadi. Faqat BAZA_ varaqlari: yo'qlari ochiladi, borlari tozalanib qayta yoziladi. */
export async function kozguniYoz(): Promise<{ varaq: string; qatorlar: number }[]> {
  const id = process.env.KOZGU_SHEETS_ID
  if (!id) throw new Error('KOZGU_SHEETS_ID sozlanmagan')

  const sheets = google.sheets({ version: 'v4', auth: auth() })
  const varaqlar = await kozguVaraqlari()
  if (varaqlar.some((v) => !v.nom.startsWith('BAZA_'))) throw new Error('Ko‘zgu faqat BAZA_ varaqlariga yozadi')

  const olish = () =>
    sheets.spreadsheets.get({ spreadsheetId: id, fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),conditionalFormats,charts(chartId))' })
  let kitob = await olish()
  const bor = new Set((kitob.data.sheets ?? []).map((s) => s.properties?.title))
  const yangi = varaqlar.filter((v) => !bor.has(v.nom))
  if (yangi.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: yangi.map((v) => ({ addSheet: { properties: { title: v.nom } } })) },
    })
    kitob = await olish()
  }
  const varaqMalumot = new Map((kitob.data.sheets ?? []).map((s) => [s.properties!.title!, s]))

  // Varaq kichik bo'lsa — kengaytiriladi (yangi varaq 26 ustun, O'quvchilarga 27 kerak)
  const kengayt: sheets_v4.Schema$Request[] = []
  for (const v of varaqlar) {
    const p = varaqMalumot.get(v.nom)?.properties
    const kerakU = Math.max(...v.qatorlar.map((q) => q.length), 1)
    const kerakQ = v.qatorlar.length + 1
    const gp = p?.gridProperties
    if (p?.sheetId != null && gp && ((gp.columnCount ?? 0) < kerakU || (gp.rowCount ?? 0) < kerakQ)) {
      kengayt.push({
        updateSheetProperties: {
          properties: { sheetId: p.sheetId, gridProperties: { columnCount: Math.max(gp.columnCount ?? 0, kerakU), rowCount: Math.max(gp.rowCount ?? 0, kerakQ) } },
          fields: 'gridProperties(columnCount,rowCount)',
        },
      })
    }
  }
  if (kengayt.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: kengayt } })

  // 1) Qiymatlar va formulalar (Panel'dagi tanlovlar saqlanadi — foydalanuvchi tanlagani qolsin)
  const panelTanlov = await sheets.spreadsheets.values
    .get({ spreadsheetId: id, range: "'BAZA_Panel'!C2:C4" })
    .then((r) => r.data.values ?? [])
    .catch(() => [] as string[][])
  const panel = varaqlar.find((v) => v.nom === 'BAZA_Panel')
  if (panel?.tanlov) {
    const royxatlar = [panel.tanlov.holat, panel.tanlov.fan, panel.tanlov.ustoz]
    royxatlar.forEach((royxat, i) => {
      const eski = panelTanlov[i]?.[0]
      if (eski && royxat.includes(eski)) panel.qatorlar[1 + i][2] = eski
    })
  }
  await sheets.spreadsheets.values.batchClear({ spreadsheetId: id, requestBody: { ranges: varaqlar.map((v) => `'${v.nom}'`) } })
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: varaqlar.map((v) => ({ range: `'${v.nom}'!A1`, values: v.qatorlar })),
    },
  })

  // 2) Dizayn: avval eski shartli formatlar va grafiklar olinadi (har safar yig'ilib ketmasin)
  const req: sheets_v4.Schema$Request[] = []
  for (const v of varaqlar) {
    const s = varaqMalumot.get(v.nom)
    const sheetId = s?.properties?.sheetId
    if (sheetId == null) continue
    for (let i = (s?.conditionalFormats?.length ?? 0) - 1; i >= 0; i--) req.push({ deleteConditionalFormatRule: { sheetId, index: i } })
    for (const c of s?.charts ?? []) req.push({ deleteEmbeddedObject: { objectId: c.chartId! } })
    req.push(...dizayn(v, sheetId, v.qatorlar.length))
    if (v.nom === 'BAZA_Panel') req.push(...grafiklar(sheetId))
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: req } })

  return varaqlar.map((v) => ({ varaq: v.nom, qatorlar: Math.max(v.qatorlar.length - 1, 0) }))
}

/** Panel grafiklari: yo'nalish bo'yicha to'langan/qarz, oylik tushum */
function grafiklar(sheetId: number): sheets_v4.Schema$Request[] {
  const ustunGrafik = (sarlavha: string, boshQator: number, seriyalar: number[], anchorQator: number): sheets_v4.Schema$Request => ({
    addChart: {
      chart: {
        spec: {
          title: sarlavha,
          basicChart: {
            chartType: 'COLUMN',
            legendPosition: 'BOTTOM_LEGEND',
            headerCount: 1,
            domains: [{ domain: { sourceRange: { sources: [{ sheetId, startRowIndex: boshQator, endRowIndex: boshQator + 13, startColumnIndex: 3, endColumnIndex: 4 }] } } }],
            series: seriyalar.map((c) => ({
              series: { sourceRange: { sources: [{ sheetId, startRowIndex: boshQator, endRowIndex: boshQator + 13, startColumnIndex: c, endColumnIndex: c + 1 }] } },
              targetAxis: 'LEFT_AXIS',
            })),
          },
        },
        position: { overlayPosition: { anchorCell: { sheetId, rowIndex: anchorQator, columnIndex: 9 }, widthPixels: 560, heightPixels: 300 } },
      },
    },
  })
  return [
    ustunGrafik('Yo‘nalish bo‘yicha: to‘langan va qarz', PANEL_BLOK[0], [6, 7], 1),
    ustunGrafik('O‘qituvchi bo‘yicha: to‘langan va qarz', PANEL_BLOK[1], [6, 7], 17),
    ustunGrafik('Oylik tushum', PANEL_BLOK[3], [4], 33),
  ]
}
