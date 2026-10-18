/**
 * Panellar — botdagi tuzilmaning o'zi.
 *
 * Botda menyu rol bo'yicha bo'linadi (BOT_Menyu.js: menyuTugmalar):
 *   ustoz    — Davomat, Guruhlarim
 *   admin    — Qarzdorlar, Bugun, Shu oy, Probniy(lar), hisobotlar
 *   direktor — Tasdiqlash
 * va "USTOZ FAQAT O'Z ISHINI KO'RADI": qarz, tushum, probniy unga
 * umuman chiqmaydi.
 *
 * Bir odam ikki rolda bo'lishi mumkin — u holda ikkala bo'lim ham
 * ko'rinadi (Farrux: direktor + ustoz, Jamshid: admin + ustoz).
 *
 * `tayyor: false` — hali yozilmagan sahifa. Menyuda ko'rinadi, lekin
 * havola emas: bosib 404 ga tushib qolmasin.
 */

import type { UserRole } from '@/lib/types'
import { adminmi, staffmi, tasdiqlaydimi, managermi } from '@/lib/auth'
import {
  IconDashboard, IconStudents, IconGroups, IconTeacher, IconAttendance,
  IconWoblr, IconPayments, IconDebt, IconLeads, IconReports, IconSettings, IconSend, IconAlert, IconArxiv, IconXarajat, IconAudit,
  IconJadval, IconMarket,
} from '@/components/icons'

type IconKomponent = (p: { size?: number; className?: string }) => React.ReactElement

export type MenyuBand = {
  href: string
  nom: string
  Icon: IconKomponent
  tayyor: boolean
  /** Telefonning pastki panelida chiqadimi */
  mobil?: boolean
  /**
   * Ichki bo'limlar (Jamshid, 13.10: "alohida bo'lim emas, sub kategoriya").
   * Yon menyuda ochiladigan guruh, sahifa tepasida — tablar (BolimTablari).
   * Guruhning o'z havolasi — birinchi tayyor ichki band.
   */
  ichki?: MenyuBand[]
}

export type MenyuBolim = {
  nom: string
  bandlar: MenyuBand[]
}

/** Guruh: ichki bandlar bitta bo'lsa — guruh emas, oddiy band bo'lib qoladi. */
function guruh(nom: string, Icon: IconKomponent, ichki: MenyuBand[]): MenyuBand[] {
  if (ichki.length === 0) return []
  if (ichki.length === 1) return [ichki[0]]
  const birinchi = ichki.find((x) => x.tayyor) ?? ichki[0]
  return [{ href: birinchi.href, nom, Icon, tayyor: ichki.some((x) => x.tayyor), ichki }]
}

/** Hamma bandlar tekis ro'yxatda (guruh ichidagilar ham) — pastki panel va qidiruv uchun. */
export function tekisBandlar(bolimlar: MenyuBolim[]): MenyuBand[] {
  return bolimlar.flatMap((b) => b.bandlar.flatMap((x) => (x.ichki ? x.ichki : [x])))
}

export function menyular(rol: UserRole, ustozmi: boolean): MenyuBolim[] {
  const bolimlar: MenyuBolim[] = []
  const xodim = staffmi(rol)
  const admin = adminmi(rol)

  if (ustozmi) {
    bolimlar.push({
      nom: 'Ustoz paneli',
      bandlar: xodim
        ? // Xodim-ustozda guruh, davomat, jadval, woblar "Boshqaruv"dagi guruhlarda bor
          [
            { href: '/crm/kechikishlarim', nom: 'Kechikishlarim', Icon: IconAttendance, tayyor: true },
            { href: '/crm/maosh/men', nom: 'Maoshim', Icon: IconPayments, tayyor: true },
          ]
        : [
            { href: '/crm/davomat', nom: 'Davomat', Icon: IconAttendance, tayyor: true, mobil: true },
            { href: '/crm/guruhlar', nom: 'Guruhlarim', Icon: IconGroups, tayyor: true, mobil: true },
            { href: '/crm/woblr', nom: 'Woblar', Icon: IconWoblr, tayyor: true, mobil: true },
            { href: '/crm/woblr/tarix', nom: 'Woblar tarixi', Icon: IconWoblr, tayyor: true },
            { href: '/crm/jadval', nom: 'Dars jadvali', Icon: IconJadval, tayyor: true, mobil: true },
            // 0060 — o'z kechikishlari (faqat ko'rish)
            { href: '/crm/kechikishlarim', nom: 'Kechikishlarim', Icon: IconAttendance, tayyor: true },
            // 0075 — o'z maoshi, har davomatdan keyin yangilanadi (Jamshid, 17.10)
            { href: '/crm/maosh/men', nom: 'Maoshim', Icon: IconPayments, tayyor: true },
          ],
    })
  }

  if (xodim) {
    bolimlar.push({
      nom: ustozmi ? 'Boshqaruv' : 'Boshqaruv paneli',
      bandlar: [
        { href: '/crm/dashboard', nom: 'Bugun', Icon: IconDashboard, tayyor: true, mobil: true },
        ...guruh('O‘quvchilar', IconStudents, [
          { href: '/crm/oquvchilar', nom: 'O‘quvchilar', Icon: IconStudents, tayyor: true, mobil: true },
          { href: '/crm/qarzdorlar', nom: 'Qarzdorlar', Icon: IconDebt, tayyor: true },
          { href: '/crm/arxiv', nom: 'Arxiv', Icon: IconArxiv, tayyor: true },
          ...(admin ? [{ href: '/crm/oquvchilar/takroriy', nom: 'Takroriylar', Icon: IconStudents, tayyor: true }] : []),
          // 0072 — kim botga ulangan, ulanmaganga taklif havolasi
          { href: '/crm/telegram', nom: 'Telegram ulanishi', Icon: IconSend, tayyor: true },
        ]),
        ...guruh('Guruhlar', IconGroups, [
          { href: '/crm/guruhlar', nom: 'Guruhlar', Icon: IconGroups, tayyor: true, mobil: true },
          { href: '/crm/davomat', nom: 'Davomat', Icon: IconAttendance, tayyor: true },
          { href: '/crm/jadval', nom: 'Dars jadvali', Icon: IconJadval, tayyor: true },
          { href: '/crm/dam-kunlar', nom: 'Dam olish kunlari', Icon: IconAttendance, tayyor: true },
        ]),
        ...guruh('Lidlar', IconLeads, [
          { href: '/crm/lidlar', nom: 'Lidlar', Icon: IconLeads, tayyor: true },
          { href: '/crm/vazifalar', nom: 'Vazifalar', Icon: IconAlert, tayyor: true },
        ]),
        ...guruh('Moliya', IconPayments, [
          // Qabulxonada eng ko'p ishlatiladigan bo'lim — telefonning pastki panelida ham
          { href: '/crm/tolovlar', nom: 'To‘lovlar', Icon: IconPayments, tayyor: true, mobil: true },
          { href: '/crm/xarajatlar', nom: 'Xarajatlar', Icon: IconXarajat, tayyor: true },
          // Keyingi bosqich (Jamshid, 01.10): hozircha joyi band, bosilmaydi — "tez orada"
          { href: '/crm/moliya', nom: 'Umumiy moliya', Icon: IconReports, tayyor: false },
        ]),
        ...guruh('Woblar', IconWoblr, [
          { href: '/crm/woblr', nom: 'Woblar', Icon: IconWoblr, tayyor: true },
          { href: '/crm/woblr/tarix', nom: 'Woblar tarixi', Icon: IconWoblr, tayyor: true },
          { href: '/crm/market/boshqaruv', nom: 'Woblar market', Icon: IconMarket, tayyor: true },
        ]),
        // Xodimlar (Jamshid, 13.10): administratorlar, ustozlar (maoshi, davomati),
        // boshqa xodimlar (farrosh va h.k.) — bitta bo'lim ichida
        ...guruh('Xodimlar', IconTeacher, [
          ...(admin
            ? [
                { href: '/crm/xodimlar', nom: 'Administratorlar', Icon: IconStudents, tayyor: true },
                { href: '/crm/ustozlar', nom: 'Ustozlar', Icon: IconTeacher, tayyor: true },
                { href: '/crm/maosh', nom: 'Ustoz maoshi', Icon: IconPayments, tayyor: true },
              ]
            : []),
          { href: '/crm/ustoz-davomati', nom: 'Ustozlar davomati', Icon: IconTeacher, tayyor: true },
          // 0077 — admin va ustozlar nazorati: manager va direktor
          ...(managermi(rol) ? [{ href: '/crm/nazorat', nom: 'Nazorat', Icon: IconAlert, tayyor: true }] : []),
          ...(admin ? [{ href: '/crm/boshqa-xodimlar', nom: 'Boshqa xodimlar', Icon: IconStudents, tayyor: true }] : []),
        ]),
        ...(admin
          ? guruh('Xabarlar', IconSend, [
              { href: '/crm/xabarlar', nom: 'Xabarlar', Icon: IconSend, tayyor: true },
              { href: '/crm/bildirishnomalar', nom: 'Bildirishnomalar', Icon: IconAlert, tayyor: true },
            ])
          : []),
        ...guruh('Hisobotlar', IconReports, [
          { href: '/crm/hisobotlar', nom: 'Hisobotlar', Icon: IconReports, tayyor: true },
          ...(admin ? [{ href: '/crm/audit', nom: 'Audit', Icon: IconAudit, tayyor: true }] : []),
        ]),
        ...(admin ? [{ href: '/crm/sozlamalar', nom: 'Sozlamalar', Icon: IconSettings, tayyor: true }] : []),
      ],
    })
  }

  if (tasdiqlaydimi(rol)) {
    bolimlar.push({
      nom: 'Direktor',
      bandlar: [
        {
          href: '/crm/tolovlar?filtr=tasdiqlanmagan',
          nom: 'Tasdiqlash',
          Icon: IconPayments,
          tayyor: true,
          mobil: true,
        },
      ],
    })
  }

  if (rol === 'oquvchi') {
    bolimlar.push({
      nom: 'Mening sahifam',
      bandlar: [
        { href: '/crm/men', nom: 'Bosh sahifa', Icon: IconDashboard, tayyor: true, mobil: true },
        { href: '/crm/woblr', nom: 'Woblar reytingi', Icon: IconWoblr, tayyor: true, mobil: true },
        { href: '/crm/woblr/tarix', nom: 'Woblar tarixi', Icon: IconWoblr, tayyor: true },
        { href: '/crm/market', nom: 'Woblar market', Icon: IconMarket, tayyor: true, mobil: true },
      ],
    })
  }

  if (rol === 'ota_ona') {
    bolimlar.push({
      nom: 'Farzandim',
      bandlar: [
        { href: '/crm/farzand', nom: 'Farzandim', Icon: IconStudents, tayyor: true, mobil: true },
        { href: '/crm/woblr/tarix', nom: 'Woblar tarixi', Icon: IconWoblr, tayyor: true },
      ],
    })
  }

  // Profil (ism, login, parol; o'quvchi/ota-onaga — Telegram) chap menyuda emas:
  // yuqori o'ngdagi ism bosilganda ochiladi — "Profil sozlamalari" (ProfilMenyu).

  return bolimlar
}

/** Kirgan odam qaysi sahifadan boshlaydi — botdagi "o'z ishi" tamoyili. */
export function boshSahifa(rol: UserRole, ustozmi: boolean): string {
  if (rol === 'oquvchi') return '/crm/men'
  if (rol === 'ota_ona') return '/crm/farzand'
  if (ustozmi && !staffmi(rol)) return '/crm/davomat'
  return '/crm/dashboard'
}
