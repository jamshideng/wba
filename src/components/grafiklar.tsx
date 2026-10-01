'use client'

/**
 * Grafiklar (recharts) — LevelUp "Отчёты" uslubida: gradientli maydon,
 * kichik sparkline, halqa (donut), gorizontal ustunlar. Ranglar —
 * globals.css tokenlaridan (yorug'/qorong'i temada o'zi moslashadi).
 *
 * Server sahifa ma'lumotni tayyorlab beradi, bu yerda faqat chiziladi.
 */

import { useId } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { RANG, SERIYA } from '@/lib/grafik-rang'


const soM = (n: number) => Math.round(n).toLocaleString('ru-RU')
/** O'qda: 1 250 000 → 1.3M, 45 000 → 45k */
export const qisqa = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))

type Format = 'som' | 'foiz' | 'son'
const formatla = (v: number, f: Format) => (f === 'som' ? `${soM(v)} so‘m` : f === 'foiz' ? `${Math.round(v)}%` : String(Math.round(v)))

function Maslahat({
  active, payload, label, format,
}: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { fill?: string } }[]; label?: string; format: Format }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[12.5px] shadow-lg">
      {label && <p className="mb-1 font-semibold text-ink-3">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          <span className="text-ink-2">{p.name}:</span>
          <b className="tnum text-ink">{formatla(Number(p.value ?? 0), format)}</b>
        </p>
      ))}
    </div>
  )
}

/** Kartadagi kichik grafik — faqat shakl, o'qlarsiz */
export function Sparkline({ qiymatlar, rang = RANG.ok, balandlik = 44 }: { qiymatlar: number[]; rang?: string; balandlik?: number }) {
  const id = useId().replace(/:/g, '')
  const data = qiymatlar.map((v, i) => ({ i, v }))
  if (data.length < 2) return <div style={{ height: balandlik }} />
  return (
    <ResponsiveContainer width="100%" height={balandlik}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rang} stopOpacity={0.28} />
            <stop offset="100%" stopColor={rang} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={rang} strokeWidth={1.6} fill={`url(#sp${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Katta maydonli grafik (masalan kunlik tushum) */
export function MaydonGrafik({
  data, nom, format = 'som', balandlik = 280, rang = RANG.brand,
}: { data: { x: string; y: number }[]; nom: string; format?: Format; balandlik?: number; rang?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <ResponsiveContainer width="100%" height={balandlik}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`m${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={rang} stopOpacity={0.32} />
            <stop offset="95%" stopColor={rang} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={RANG.line} vertical={false} />
        <XAxis dataKey="x" tick={{ fontSize: 11, fill: RANG.ink3 }} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis tick={{ fontSize: 11, fill: RANG.ink3 }} tickLine={false} axisLine={false} width={46}
          tickFormatter={(v: number) => (format === 'foiz' ? `${v}%` : qisqa(v))} domain={format === 'foiz' ? [0, 100] : undefined} />
        <Tooltip content={<Maslahat format={format} />} cursor={{ stroke: RANG.line }} />
        <Area type="monotone" dataKey="y" name={nom} stroke={rang} strokeWidth={2.2} fill={`url(#m${id})`}
          dot={data.length <= 31 ? { r: 2.5, fill: rang, strokeWidth: 0 } : false} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Bir nechta chiziq (masalan davomat %) */
export function ChiziqGrafik({
  data, seriyalar, format = 'son', balandlik = 240,
}: { data: Record<string, string | number>[]; seriyalar: { kalit: string; nom: string; rang?: string }[]; format?: Format; balandlik?: number }) {
  return (
    <ResponsiveContainer width="100%" height={balandlik}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={RANG.line} vertical={false} />
        <XAxis dataKey="x" tick={{ fontSize: 11, fill: RANG.ink3 }} tickLine={false} axisLine={false} minTickGap={18} />
        <YAxis tick={{ fontSize: 11, fill: RANG.ink3 }} tickLine={false} axisLine={false} width={42}
          tickFormatter={(v: number) => (format === 'foiz' ? `${v}%` : qisqa(v))} domain={format === 'foiz' ? [0, 100] : undefined} />
        <Tooltip content={<Maslahat format={format} />} />
        {seriyalar.map((s, i) => (
          <Line key={s.kalit} type="monotone" dataKey={s.kalit} name={s.nom} stroke={s.rang ?? SERIYA[i]} strokeWidth={2.2}
            dot={{ r: 2.5, strokeWidth: 0, fill: s.rang ?? SERIYA[i] }} activeDot={{ r: 5 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Ustunli grafik: vertikal (oylar) yoki gorizontal (reyting) */
export function UstunGrafik({
  data, seriyalar, format = 'som', gorizontal = false, balandlik = 260,
}: {
  data: Record<string, string | number>[]
  seriyalar: { kalit: string; nom: string; rang?: string }[]
  format?: Format
  gorizontal?: boolean
  balandlik?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={balandlik}>
      <BarChart data={data} layout={gorizontal ? 'vertical' : 'horizontal'} margin={{ top: 10, right: 16, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={RANG.line} vertical={gorizontal} horizontal={!gorizontal} />
        {gorizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: RANG.ink3 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => qisqa(v)} />
            <YAxis type="category" dataKey="x" tick={{ fontSize: 11.5, fill: RANG.ink3 }} tickLine={false} axisLine={false} width={150} />
          </>
        ) : (
          <>
            <XAxis dataKey="x" tick={{ fontSize: 11, fill: RANG.ink3 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: RANG.ink3 }} tickLine={false} axisLine={false} width={46}
              tickFormatter={(v: number) => (format === 'foiz' ? `${v}%` : qisqa(v))} />
          </>
        )}
        <Tooltip content={<Maslahat format={format} />} cursor={{ fill: 'var(--color-surface-2)' }} />
        {seriyalar.map((s, i) => (
          <Bar key={s.kalit} dataKey={s.kalit} name={s.nom} fill={s.rang ?? SERIYA[i]} maxBarSize={gorizontal ? 22 : 36}
            radius={gorizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Halqa (donut) + yonida ro'yxat: ulush va summa */
export function HalqaGrafik({ data, format = 'som' }: { data: { nom: string; qiymat: number }[]; format?: Format }) {
  const jami = data.reduce((a, d) => a + d.qiymat, 0)
  const qatorlar = data.filter((d) => d.qiymat > 0).map((d, i) => ({ ...d, rang: SERIYA[i % SERIYA.length] }))
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="h-44 w-full sm:w-44 sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={qatorlar} dataKey="qiymat" nameKey="nom" innerRadius="58%" outerRadius="92%" paddingAngle={3} stroke="none">
              {qatorlar.map((d) => <Cell key={d.nom} fill={d.rang} />)}
            </Pie>
            <Tooltip content={<Maslahat format={format} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full flex-1 flex-col gap-2">
        {qatorlar.map((d) => (
          <li key={d.nom} className="flex items-center gap-2.5 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.rang }} />
            <span className="flex-1 text-ink-2">{d.nom}</span>
            <b className="tnum text-ink">{formatla(d.qiymat, format)}</b>
            <span className="tnum w-11 text-right text-[12px] text-ink-3">{jami ? Math.round((d.qiymat / jami) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
