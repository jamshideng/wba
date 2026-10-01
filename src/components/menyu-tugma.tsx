'use client'

import { IconMenyu } from '@/components/icons'
import { MENYU_COOKIE } from '@/lib/menyu-holat'

/**
 * Chap menyuni yig'ish / ochish (kompyuterda). Holat #crm-qobiq dagi
 * data-menyu atributida: CSS uni o'qiydi, sahifa qayta yuklanmaydi.
 */
export function MenyuTugma() {
  function almashtir() {
    const qobiq = document.getElementById('crm-qobiq')
    if (!qobiq) return
    const yopiq = qobiq.dataset.menyu !== 'yopiq'
    qobiq.dataset.menyu = yopiq ? 'yopiq' : 'ochiq'
    document.cookie = `${MENYU_COOKIE}=${yopiq ? 'yopiq' : 'ochiq'}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <button
      type="button"
      onClick={almashtir}
      aria-label="Menyuni yig‘ish yoki ochish"
      title="Menyuni yig‘ish / ochish"
      className="flex size-10 items-center justify-center rounded-lg text-ink-2 transition hover:bg-surface-2 hover:text-ink"
    >
      <IconMenyu size={20} />
    </button>
  )
}
