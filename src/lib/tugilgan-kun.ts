/**
 * Tug'ilgan kun eslatmasi (0131) — "WBA Hisobot" guruhiga, ustozlar va o'quvchilar alohida xabar.
 * 3 kun oldindan har kuni: "3 kundan keyin" → "2 kundan keyin" → "Ertaga" → "Bugun".
 */
import { kunOyYil, guruhQisqa } from '@/lib/format'

/** Telegram HTML uchun (telegram.ts server-only — testda import qilib bo'lmaydi) */
const html = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export type TugilganQator = {
  id: string
  ism: string
  sana: string
  qoldi: number
  yosh: number
  guruhlar?: string[]
}

export type TugilganKunlar = { ustozlar: TugilganQator[]; oquvchilar: TugilganQator[] }

export function qachon(qoldi: number): string {
  if (qoldi === 0) return 'Bugun'
  if (qoldi === 1) return 'Ertaga'
  return `${qoldi} kundan keyin`
}

/** Bo'sh ro'yxat — null (xabar yuborilmaydi) */
export function tugilganMatn(sarlavha: string, qatorlar: TugilganQator[]): string | null {
  if (!qatorlar.length) return null
  const t = [`<b>${html(sarlavha)}</b>`, '']
  for (const q of qatorlar) {
    const guruh = q.guruhlar?.length ? ` · ${html(q.guruhlar.map(guruhQisqa).join(', '))}` : ''
    t.push(`<b>${qachon(q.qoldi)}</b> (${kunOyYil(q.sana)}) — ${html(q.ism)}, ${q.yosh} yosh${guruh}`)
  }
  return t.join('\n')
}
