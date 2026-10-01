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
import { adminmi, staffmi, tasdiqlaydimi } from '@/lib/auth'
import {
  IconDashboard, IconStudents, IconGroups, IconTeacher, IconAttendance,
  IconWoblr, IconPayments, IconDebt, IconLeads, IconReports, IconSettings, IconSend, IconArxiv,
} from '@/components/icons'

type IconKomponent = (p: { size?: number; className?: string }) => React.ReactElement

export type MenyuBand = {
  href: string
  nom: string
  Icon: IconKomponent
  tayyor: boolean
  /** Telefonning pastki panelida chiqadimi */
  mobil?: boolean
}

export type MenyuBolim = {
  nom: string
  bandlar: MenyuBand[]
}

export function menyular(rol: UserRole, ustozmi: boolean): MenyuBolim[] {
  const bolimlar: MenyuBolim[] = []

  if (ustozmi) {
    bolimlar.push({
      nom: 'Ustoz paneli',
      bandlar: [
        { href: '/crm/davomat', nom: 'Davomat', Icon: IconAttendance, tayyor: true, mobil: true },
        { href: '/crm/guruhlar', nom: 'Guruhlarim', Icon: IconGroups, tayyor: true, mobil: true },
        { href: '/crm/woblr', nom: 'Woblar', Icon: IconWoblr, tayyor: true },
      ],
    })
  }

  if (staffmi(rol)) {
    bolimlar.push({
      nom: ustozmi ? 'Boshqaruv' : 'Boshqaruv paneli',
      bandlar: [
        { href: '/crm/dashboard', nom: 'Bugun', Icon: IconDashboard, tayyor: true, mobil: true },
        { href: '/crm/oquvchilar', nom: 'O‘quvchilar', Icon: IconStudents, tayyor: true, mobil: true },
        // Ustoz ham bo'lsa bu uchtasi yuqoridagi "Ustoz paneli"da bor
        ...(ustozmi
          ? []
          : [
              { href: '/crm/guruhlar', nom: 'Guruhlar', Icon: IconGroups, tayyor: true, mobil: true },
              { href: '/crm/davomat', nom: 'Davomat', Icon: IconAttendance, tayyor: true },
              { href: '/crm/woblr', nom: 'Woblar', Icon: IconWoblr, tayyor: true },
            ]),
        { href: '/crm/qarzdorlar', nom: 'Qarzdorlar', Icon: IconDebt, tayyor: true },
        { href: '/crm/tolovlar', nom: 'To‘lovlar', Icon: IconPayments, tayyor: true },
        { href: '/crm/probniylar', nom: 'Probniylar', Icon: IconLeads, tayyor: true },
        { href: '/crm/hisobotlar', nom: 'Hisobotlar', Icon: IconReports, tayyor: true },
        { href: '/crm/arxiv', nom: 'Arxiv', Icon: IconArxiv, tayyor: true },
        ...(adminmi(rol)
          ? [
              { href: '/crm/xabarlar', nom: 'Xabarlar', Icon: IconSend, tayyor: true },
              { href: '/crm/ustozlar', nom: 'Ustozlar', Icon: IconTeacher, tayyor: true },
              { href: '/crm/sozlamalar', nom: 'Sozlamalar', Icon: IconSettings, tayyor: true },
            ]
          : []),
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
      ],
    })
  }

  if (rol === 'ota_ona') {
    bolimlar.push({
      nom: 'Farzandim',
      bandlar: [
        { href: '/crm/farzand', nom: 'Farzandim', Icon: IconStudents, tayyor: true, mobil: true },
      ],
    })
  }

  // Har bir panelda: o'z ismi, logini va paroli
  bolimlar.push({
    nom: 'Hisobim',
    bandlar: [{ href: '/crm/profil', nom: 'Profil va parol', Icon: IconSettings, tayyor: true }],
  })

  return bolimlar
}

/** Kirgan odam qaysi sahifadan boshlaydi — botdagi "o'z ishi" tamoyili. */
export function boshSahifa(rol: UserRole, ustozmi: boolean): string {
  if (rol === 'oquvchi') return '/crm/men'
  if (rol === 'ota_ona') return '/crm/farzand'
  if (ustozmi && !staffmi(rol)) return '/crm/davomat'
  return '/crm/dashboard'
}
