'use client'

/** Brauzerning chop etish oynasi — u yerda "PDF sifatida saqlash" tanlanadi. */
export function ChopTugma() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-brand px-5 text-[13.5px] font-semibold text-white shadow-sm shadow-brand/25 hover:brightness-110"
    >
      PDF yuklab olish
    </button>
  )
}
