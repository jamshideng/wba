import { redirect } from 'next/navigation'

/** 0121 — "Telegram ulanishi" Hisobotlar › Ulanishlar ga ko'chdi (eski havolalar uchun) */
export default async function TelegramUlanishi({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await searchParams
  const p = new URLSearchParams({ bolim: 'ulanishlar' })
  for (const k of ['guruh', 'q', 'ok', 'xato'] as const) if (s[k]) p.set(k, s[k]!)
  redirect(`/crm/hisobotlar?${p.toString()}`)
}
