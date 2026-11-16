/**
 * Obyektivka (ma'lumotnoma) — Word (DOCX), rasmiy shaklda, qarindoshlarsiz (0126).
 * Huquq RLS'da: ustozning o'zi yoki admin/manager/direktor (boshqaga — 404).
 */
import { NextResponse } from 'next/server'
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { createClient } from '@/lib/supabase/server'
import { ustozProfilOl, MALUMOTI_NOMI, DARAJA_NOMI, RASM_BUCKET } from '@/lib/ustoz-profil'

export const dynamic = 'force-dynamic'

const SHRIFT = 'Times New Roman'
const yoq = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const chegarasiz = { top: yoq, bottom: yoq, left: yoq, right: yoq, insideHorizontal: yoq, insideVertical: yoq }

function m(text: string, o: { qalin?: boolean; olcham?: number; kursiv?: boolean } = {}) {
  return new TextRun({ text, bold: o.qalin, italics: o.kursiv, size: (o.olcham ?? 12) * 2, font: SHRIFT })
}
function p(children: TextRun[], o: { markaz?: boolean; oldin?: number; keyin?: number } = {}) {
  return new Paragraph({ children, alignment: o.markaz ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { before: o.oldin ?? 0, after: o.keyin ?? 60 } })
}
function sana(s: string | null | undefined): string {
  if (!s) return '—'
  const [y, mo, d] = s.split('-')
  return `${d}/${mo}/${y}`
}
const qiymat = (v: string | null | undefined) => (v && v.trim() ? v : 'yo‘q')

/** Ikki ustunli juft: "Tug'ilgan yili:" / qiymat */
function juft(chap: [string, string], ong?: [string, string]) {
  const katak = (j?: [string, string]) =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: chegarasiz,
      children: j ? [p([m(j[0], { qalin: true })], { keyin: 0 }), p([m(j[1])], { keyin: 120 })] : [p([])],
    })
  return new TableRow({ children: [katak(chap), katak(ong)] })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const d = await ustozProfilOl(supabase, id)
  if (!d) return new NextResponse('Topilmadi', { status: 404 })

  const sh = d.shaxsiy
  const fish = [d.ustoz.familiya, d.ustoz.ismi].filter(Boolean).join(' ') || d.ustoz.ism
  const oxirgiTalim = d.talim.find((t) => !t.oqiyapti) ?? d.talim[0]
  const hozirgi = d.mehnat.find((x) => x.gacha_yil === null)

  // Rasm (bo'lsa)
  let rasm: ImageRun | null = null
  if (d.profil.rasm_yol) {
    const { data } = await supabase.storage.from(RASM_BUCKET).download(d.profil.rasm_yol)
    if (data) {
      const tur = d.profil.rasm_yol.endsWith('.png') ? 'png' : 'jpg'
      rasm = new ImageRun({ type: tur, data: Buffer.from(await data.arrayBuffer()), transformation: { width: 113, height: 151 } })
    }
  }

  const sarlavha = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: chegarasiz,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            borders: chegarasiz,
            children: [
              p([m('MA’LUMOTNOMA', { qalin: true, olcham: 14 })], { markaz: true, keyin: 200 }),
              p([m(fish, { qalin: true, olcham: 14 })], { markaz: true, keyin: 200 }),
              hozirgi
                ? p([m(`${hozirgi.dan_yil} yildan: `, { qalin: true }), m([hozirgi.ish_joyi, hozirgi.lavozim].filter(Boolean).join(', '))])
                : p([m('World Bridge Academy — ustoz', { kursiv: true })]),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: chegarasiz,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: rasm ? [rasm] : [m('3×4 rasm', { kursiv: true, olcham: 10 })] })],
          }),
        ],
      }),
    ],
  })

  const asosiy = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: chegarasiz,
    rows: [
      juft(['Tug‘ilgan yili:', sana(sh?.tugilgan_sana)], ['Tug‘ilgan joyi:', qiymat(sh?.tugilgan_joy)]),
      juft(['Millati:', qiymat(sh?.millati)], ['Ma’lumoti:', sh?.malumoti ? MALUMOTI_NOMI[sh.malumoti] : '—']),
      juft(
        ['Tamomlagan:', oxirgiTalim ? `${oxirgiTalim.gacha_yil ?? (oxirgiTalim.oqiyapti ? 'hozir o‘qiyapti' : '')} ${oxirgiTalim.otm}`.trim() : '—'],
        ['Ma’lumoti bo‘yicha mutaxassisligi:', qiymat(sh?.mutaxassisligi ?? oxirgiTalim?.yonalish)],
      ),
      juft(['Ilmiy darajasi:', qiymat(sh?.ilmiy_daraja)], ['Ilmiy unvoni:', qiymat(sh?.ilmiy_unvon)]),
      juft(['Qaysi chet tillarini biladi:', qiymat(sh?.chet_tillari ?? (d.profil.tillar.join(', ') || null))], ['Davlat mukofotlari bilan taqdirlanganmi:', qiymat(sh?.mukofotlar)]),
    ],
  })

  const talim = d.talim.length
    ? [
        p([m('TA’LIM', { qalin: true })], { markaz: true, oldin: 240, keyin: 120 }),
        ...d.talim.map((t) =>
          p([
            m(`${t.dan_yil ?? '?'}–${t.oqiyapti ? 'h.v.' : (t.gacha_yil ?? '?')} yy. — `, { qalin: true }),
            m([t.otm, t.yonalish, t.daraja ? DARAJA_NOMI[t.daraja] : null].filter(Boolean).join(', ')),
          ]),
        ),
      ]
    : []

  const sertifikat = d.sertifikatlar.length
    ? [
        p([m('SERTIFIKATLAR', { qalin: true })], { markaz: true, oldin: 240, keyin: 120 }),
        ...d.sertifikatlar.map((s) =>
          p([m(`${s.turi}${s.ball ? ' ' + s.ball : ''}`, { qalin: true }), m([s.qayerda, s.sana ? sana(s.sana) : null].filter(Boolean).length ? ' — ' + [s.qayerda, s.sana ? sana(s.sana) : null].filter(Boolean).join(', ') : '')]),
        ),
      ]
    : []

  const mehnat = [
    p([m('MEHNAT FAOLIYATI', { qalin: true })], { markaz: true, oldin: 240, keyin: 120 }),
    ...(d.mehnat.length
      ? [...d.mehnat]
          .sort((a, b) => a.dan_yil - b.dan_yil)
          .map((x) => p([m(`${x.dan_yil}–${x.gacha_yil ?? 'h.v.'} yy. — `, { qalin: true }), m([x.ish_joyi, x.lavozim].filter(Boolean).join(', '))]))
      : [p([m('—')])]),
  ]

  const shaxsiy = [
    p([m('SHAXSIY MA’LUMOTLAR', { qalin: true })], { markaz: true, oldin: 240, keyin: 120 }),
    p([m('Yashash manzili: ', { qalin: true }), m(sh?.manzil ?? '—')]),
    p([m('Telefon: ', { qalin: true }), m(d.ustoz.telefon ?? '—')]),
  ]

  const doc = new Document({
    creator: 'World Bridge Academy',
    title: `Obyektivka — ${fish}`,
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1400, right: 1000 } } },
        children: [sarlavha, p([]), asosiy, ...talim, ...sertifikat, ...mehnat, ...shaxsiy],
      },
    ],
  })

  const fayl = await Packer.toBuffer(doc)
  const nom = `Obyektivka - ${fish}.docx`
  return new NextResponse(new Uint8Array(fayl), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="obyektivka-${id}.docx"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
