'use client'

import { useEffect } from 'react'

/** Sticky menyuning haqiqiy balandligini --sarlavha-h ga yozadi (telefonda menyu ikki qatorga tushadi). */
export function SarlavhaBalandligi() {
  useEffect(() => {
    const el = document.getElementById('sarlavha')
    if (!el) return
    const yoz = () => document.documentElement.style.setProperty('--sarlavha-h', `${el.offsetHeight}px`)
    yoz()
    const kuzat = new ResizeObserver(yoz)
    kuzat.observe(el)
    return () => kuzat.disconnect()
  }, [])
  return null
}
