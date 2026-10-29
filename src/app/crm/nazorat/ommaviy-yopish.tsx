'use client'

import { useEffect, useRef, useState } from 'react'
import { kirishKlass } from '@/components/forma'

export const OMMAVIY_FORMA = 'nazorat-ommaviy-yopish'

/**
 * Gmail kabi: ro'yxatdagi katakchalar (form={OMMAVIY_FORMA}) shu formaga
 * tegishli — har hodisaning o'z formalari (ogohlantirish, yopish) ichma-ich
 * bo'lib qolmasin. "Hammasini belgilash" ko'rinib turgan yangilarni tanlaydi.
 */
export function OmmaviyYopish({
  action,
  qaytish,
  jami,
}: {
  action: (fd: FormData) => void | Promise<void>
  qaytish: string
  jami: number
}) {
  const [tanlangan, setTanlangan] = useState(0)
  const hammasiRef = useRef<HTMLInputElement>(null)

  const katakchalar = () =>
    [...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${OMMAVIY_FORMA}"][name=id]`)]

  useEffect(() => {
    const sana = () => {
      const k = katakchalar()
      const n = k.filter((x) => x.checked).length
      setTanlangan(n)
      if (hammasiRef.current) {
        hammasiRef.current.checked = n > 0 && n === k.length
        hammasiRef.current.indeterminate = n > 0 && n < k.length
      }
    }
    document.addEventListener('change', sana)
    sana()
    return () => document.removeEventListener('change', sana)
  }, [])

  const hammasini = (yoq: boolean) => {
    for (const k of katakchalar()) k.checked = yoq
    setTanlangan(yoq ? katakchalar().length : 0)
  }

  return (
    <form
      id={OMMAVIY_FORMA}
      action={action}
      className="flex flex-wrap items-center gap-3 border-t border-line-soft bg-surface-2/60 px-5 py-2.5"
    >
      <input type="hidden" name="qaytish" value={qaytish} />
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] font-semibold">
        <input
          ref={hammasiRef}
          type="checkbox"
          onChange={(e) => hammasini(e.target.checked)}
          className="size-4 accent-[var(--color-brand)]"
          aria-label="Hammasini belgilash"
        />
        {tanlangan ? `${tanlangan} ta tanlandi` : `Hammasini belgilash (${jami})`}
      </label>
      {tanlangan > 0 && (
        <>
          <input name="izoh" placeholder="Izoh (ixtiyoriy)" aria-label="Yopish izohi" className={`${kirishKlass} !w-auto min-w-0 flex-1 sm:max-w-64`} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-[10px] bg-brand px-4 text-[13px] font-semibold text-white hover:brightness-110"
          >
            Yopish ({tanlangan})
          </button>
          <button type="button" onClick={() => hammasini(false)} className="min-h-11 px-2 text-[12.5px] text-ink-3 hover:text-ink">
            Bekor
          </button>
        </>
      )}
    </form>
  )
}
