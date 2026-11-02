import { telefon } from '@/lib/format'

/** farzand_ustozi() qatori (0116) */
export type UstozMalumot = { ism: string; telefon: string | null; telegram_user: string | null }

/**
 * Ota-ona farzandining ustozi ismini bosganda — FISH, telefon va (admin
 * kiritgan bo'lsa) Telegram. JS'siz: <details>. Ma'lumotni farzand_ustozi()
 * faqat o'z farzandining ustozi uchun beradi.
 */
export function UstozKarta({ u }: { u: UstozMalumot }) {
  return (
    <details className="group relative inline-block align-baseline">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center font-semibold text-ink underline decoration-dotted underline-offset-4 hover:text-brand [&::-webkit-details-marker]:hidden">
        {u.ism}
      </summary>
      <div className="absolute left-0 z-30 mt-1 flex w-[min(80vw,280px)] flex-col gap-2 rounded-[12px] border border-line bg-surface p-4 text-[13px] shadow-xl">
        <span className="font-semibold text-ink">{u.ism}</span>
        {u.telefon ? (
          <a href={`tel:${u.telefon.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-11 items-center text-brand hover:underline">
            {telefon(u.telefon)}
          </a>
        ) : (
          <span className="text-ink-3">Telefon kiritilmagan</span>
        )}
        {u.telegram_user && (
          <a
            href={`https://t.me/${u.telegram_user}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-brand hover:underline"
          >
            @{u.telegram_user}
          </a>
        )}
      </div>
    </details>
  )
}
