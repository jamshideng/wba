'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Fayl yuklash (0126): fayl to'g'ridan-to'g'ri Storage'ga ('<teacher_id>/...'),
 * yo'li yashirin maydonga yoziladi va forma odatdagidek saqlanadi.
 * Huquq Storage RLS'da (ustozning o'zi yoki admin). Nom har safar yangi —
 * eski fayl ustiga yozilmaydi (saytda tasdiqlangan nusxa buzilmaydi).
 */
export function FaylYuklash({
  nom,
  teacherId,
  bucket,
  papka,
  joriy,
  joriyHavola,
  rasm = false,
  yorliq = 'Fayl',
}: {
  nom: string
  teacherId: string
  bucket: 'ustoz-rasm' | 'ustoz-hujjat'
  papka: string
  joriy?: string | null
  joriyHavola?: string | null
  rasm?: boolean
  yorliq?: string
}) {
  const [yol, setYol] = useState(joriy ?? '')
  const [korinish, setKorinish] = useState<string | null>(joriyHavola ?? null)
  const [holat, setHolat] = useState<'' | 'yuklanmoqda' | 'xato'>('')
  const [xato, setXato] = useState('')
  const kirish = useRef<HTMLInputElement>(null)
  const maks = bucket === 'ustoz-rasm' ? 5 : 10

  async function tanlandi(f: File | undefined) {
    if (!f) return
    if (f.size > maks * 1024 * 1024) {
      setHolat('xato')
      setXato(`Fayl ${maks} MB dan katta.`)
      return
    }
    const tur = rasm ? ['image/jpeg', 'image/png', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!tur.includes(f.type)) {
      setHolat('xato')
      setXato(rasm ? 'Faqat JPG, PNG yoki WEBP rasm.' : 'Faqat PDF yoki rasm (JPG, PNG).')
      return
    }
    setHolat('yuklanmoqda')
    setXato('')
    const kengaytma = (f.name.split('.').pop() || (f.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '')
    const yangi = `${teacherId}/${papka}/${crypto.randomUUID()}.${kengaytma}`
    const { error } = await createClient().storage.from(bucket).upload(yangi, f, { contentType: f.type, upsert: false })
    if (error) {
      setHolat('xato')
      setXato('Yuklab bo‘lmadi: ' + error.message)
      return
    }
    setYol(yangi)
    setKorinish(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
    setHolat('')
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="lbl">{yorliq}</span>
      <input type="hidden" name={nom} value={yol} />
      <div className="flex flex-wrap items-center gap-2">
        {rasm && korinish && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={korinish} alt="" className="size-16 rounded-[10px] border border-line object-cover" />
        )}
        {!rasm && yol && (
          <span className="text-[12.5px] text-ink-2">
            {korinish && joriy === yol ? (
              <a href={korinish} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
                Faylni ko‘rish
              </a>
            ) : (
              'Fayl tanlandi'
            )}
          </span>
        )}
        <button
          type="button"
          onClick={() => kirish.current?.click()}
          disabled={holat === 'yuklanmoqda'}
          className="inline-flex min-h-11 items-center rounded-[9px] border border-line bg-surface px-4 text-[13px] text-ink-2 transition hover:border-ink-3 hover:text-ink disabled:opacity-50"
        >
          {holat === 'yuklanmoqda' ? 'Yuklanmoqda…' : yol ? 'Almashtirish' : rasm ? 'Rasm yuklash' : 'Fayl yuklash'}
        </button>
        {yol && (
          <button
            type="button"
            onClick={() => {
              setYol('')
              setKorinish(null)
            }}
            className="inline-flex min-h-11 items-center px-2 text-[12.5px] text-ink-3 hover:text-brand"
          >
            Olib tashlash
          </button>
        )}
      </div>
      <input
        ref={kirish}
        type="file"
        className="hidden"
        accept={rasm ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp'}
        onChange={(e) => tanlandi(e.target.files?.[0])}
      />
      <span className="text-[11.5px] text-ink-3">
        {holat === 'xato' ? <span className="text-brand">{xato}</span> : rasm ? `JPG/PNG, ${maks} MB gacha` : `PDF yoki rasm, ${maks} MB gacha — telefonda kameradan ham`}
      </span>
    </div>
  )
}
