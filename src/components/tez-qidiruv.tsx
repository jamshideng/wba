'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconSearch } from '@/components/icons'
import { oquvchiTop, type TopilganOquvchi } from '@/app/crm/qidiruv-amal'
import { telefon } from '@/lib/format'

/**
 * Panel tepasidagi tezkor qidiruv: yozish bilan ostida mos o'quvchilar
 * chiqadi (tugmasiz). Enter — to'liq ro'yxat /crm/oquvchilar?q=…
 */
export function TezQidiruv() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [natija, setNatija] = useState<TopilganOquvchi[] | null>(null)
  const [ochiq, setOchiq] = useState(false)
  const [kutilmoqda, boshla] = useTransition()
  const oxirgi = useRef('')

  useEffect(() => {
    const matn = q.trim()
    if (!matn) {
      setNatija(null)
      return
    }
    const t = setTimeout(() => {
      oxirgi.current = matn
      boshla(async () => {
        const r = await oquvchiTop(matn)
        // Eski javob yangisini bosib ketmasin
        if (oxirgi.current === matn) setNatija(r)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  return (
    <form
      role="search"
      action="/crm/oquvchilar"
      onSubmit={(e) => {
        e.preventDefault()
        if (q.trim()) router.push(`/crm/oquvchilar?q=${encodeURIComponent(q.trim())}`)
      }}
      className="relative w-64 max-sm:w-full"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOchiq(false)
      }}
    >
      <span className="flex h-11 items-center gap-2.5 rounded-[9px] border border-line bg-surface px-3">
        <IconSearch size={15} />
        <input
          name="q"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOchiq(true)
          }}
          onFocus={() => setOchiq(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOchiq(false)}
          placeholder="Ism, ID yoki telefon…"
          aria-label="O‘quvchi qidirish"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
        />
      </span>

      {ochiq && q.trim() && natija !== null && (
        <div className="absolute right-0 left-0 top-12 z-30 flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface shadow-lg">
          {natija.length === 0 ? (
            <p className="px-3 py-3 text-[12.5px] text-ink-3">{kutilmoqda ? 'Qidirilmoqda…' : 'Hech kim topilmadi.'}</p>
          ) : (
            natija.map((o) => (
              <Link
                key={o.id}
                href={`/crm/oquvchilar/${o.id}`}
                className="flex min-h-11 flex-col justify-center gap-0.5 border-b border-line-soft px-3 py-2 last:border-0 hover:bg-surface-2"
              >
                <span className={`truncate text-[13px] font-semibold ${o.holat === 'faol' ? '' : 'text-ink-3'}`}>{o.fish}</span>
                <span className="truncate font-[family-name:var(--font-mono)] text-[10.5px] text-ink-3">
                  {o.id}
                  {o.tel ? ` · ${telefon(o.tel)}` : ''}
                  {o.holat === 'faol' ? '' : ` · ${o.holat}`}
                </span>
              </Link>
            ))
          )}
          <Link
            href={`/crm/oquvchilar?q=${encodeURIComponent(q.trim())}`}
            className="flex min-h-11 items-center px-3 text-[12px] text-accent hover:bg-surface-2"
          >
            Hammasini ko‘rish →
          </Link>
        </div>
      )}
    </form>
  )
}
