/** 18×18 chiziqli ikonkalar. Emoji ishlatilmaydi — hammasi bir uslubda. */

type P = { className?: string; size?: number }

function Svg({ children, size = 18, className }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconDashboard = (p: P) => (
  <Svg {...p}>
    <rect x="2" y="2" width="6" height="6" rx="1" />
    <rect x="10" y="2" width="6" height="6" rx="1" />
    <rect x="2" y="10" width="6" height="6" rx="1" />
    <rect x="10" y="10" width="6" height="6" rx="1" />
  </Svg>
)

export const IconStudents = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="6" r="3" />
    <path d="M2 15c0-3.5 9.5-3.5 10 0" />
    <path d="M12.5 4.5a3 3 0 0 1 0 5" />
    <path d="M14 11.5c2 .6 2.5 2 2.5 3.5" />
  </Svg>
)

export const IconGroups = (p: P) => (
  <Svg {...p}>
    <path d="M9 2l7 4-7 4-7-4z" />
    <path d="M2 10l7 4 7-4" />
  </Svg>
)

export const IconTeacher = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="5.5" r="3" />
    <path d="M3 15.5c0-4.5 12-4.5 12 0" />
  </Svg>
)

export const IconAttendance = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3" width="13" height="12.5" rx="2" />
    <path d="M2.5 6.5h13" />
    <path d="M6 10.5l2 2 4-4" />
  </Svg>
)

export const IconWoblr = (p: P) => (
  <Svg {...p}>
    <path d="M9 2.5l2 4.3 4.8.6-3.4 3.3.9 4.7L9 13.1l-4.3 2.3.9-4.7L2.2 7.4l4.8-.6z" />
  </Svg>
)

export const IconPayments = (p: P) => (
  <Svg {...p}>
    <rect x="2" y="4.5" width="14" height="10" rx="2" />
    <path d="M2 8h14" />
    <path d="M12 11.5h2" />
  </Svg>
)

export const IconDebt = (p: P) => (
  <Svg {...p}>
    <path d="M9 2.5L16.5 15h-15z" />
    <path d="M9 7v3.5" />
    <path d="M9 12.8v.2" />
  </Svg>
)

export const IconLeads = (p: P) => (
  <Svg {...p}>
    <path d="M2 9l2.5-6h9L16 9v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    <path d="M2 9h4l1 2h4l1-2h4" />
  </Svg>
)

export const IconReports = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 15V2.5" />
    <path d="M2.5 15H16" />
    <path d="M6 12V8" />
    <path d="M9.5 12V5" />
    <path d="M13 12V9.5" />
  </Svg>
)

export const IconSettings = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="2.6" />
    <path d="M9 1.8v2M9 14.2v2M1.8 9h2M14.2 9h2M3.9 3.9l1.4 1.4M12.7 12.7l1.4 1.4M14.1 3.9l-1.4 1.4M5.3 12.7l-1.4 1.4" />
  </Svg>
)

export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.2" />
    <path d="M11.8 11.8L15.5 15.5" />
  </Svg>
)

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="7" />
    <path d="M9 5v4.5" />
    <path d="M9 12v.2" />
  </Svg>
)

/** Xabar yuborish (Telegram e'lonlari) — qog'oz samolyot */
export const IconSend = (p: P) => (
  <Svg {...p}>
    <path d="M16 2 8 10" />
    <path d="M16 2 11 16l-3-6-6-3 14-5Z" />
  </Svg>
)

export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M11 3.5L5.5 9l5.5 5.5" />
  </Svg>
)

export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M4 7l5 5 5-5" />
  </Svg>
)

export const IconLogout = (p: P) => (
  <Svg {...p}>
    <path d="M7 15.5H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5h3" />
    <path d="M11.5 12L15 9l-3.5-3" />
    <path d="M15 9H6.5" />
  </Svg>
)

export const IconPhone = (p: P) => (
  <Svg {...p}>
    <path d="M6 2.5l1.8 3.2-1.5 1.4a9 9 0 0 0 4.6 4.6l1.4-1.5 3.2 1.8v2.5a1.5 1.5 0 0 1-1.7 1.5C7.6 15.2 2.8 10.4 2 4.2A1.5 1.5 0 0 1 3.5 2.5z" />
  </Svg>
)

export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M9 16s5.5-5 5.5-9A5.5 5.5 0 0 0 3.5 7c0 4 5.5 9 5.5 9z" />
    <circle cx="9" cy="7" r="2" />
  </Svg>
)

export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="3.4" />
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.8 3.8l1.4 1.4M12.8 12.8l1.4 1.4M14.2 3.8l-1.4 1.4M5.2 12.8l-1.4 1.4" />
  </Svg>
)

export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M15 10.5A6 6 0 1 1 7.5 3a4.6 4.6 0 0 0 7.5 7.5z" />
  </Svg>
)

export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="7" />
    <path d="M2 9h14M9 2c2 2.4 2 11.6 0 14M9 2c-2 2.4-2 11.6 0 14" />
  </Svg>
)

export const IconArxiv = (p: P) => (
  <Svg {...p}>
    <rect x="2" y="3" width="14" height="4" rx="1" />
    <path d="M3.5 7v7a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7" />
    <path d="M7.5 10h3" />
  </Svg>
)

export const IconXarajat = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="13" height="10" rx="1.5" />
    <path d="M2.5 7.5h13" />
    <path d="M9 10v2.5M7.75 11.25 9 12.5l1.25-1.25" />
  </Svg>
)

export const IconAudit = (p: P) => (
  <Svg {...p}>
    <path d="M9 2.5 3.5 4.5v4c0 3.2 2.3 5.8 5.5 7 3.2-1.2 5.5-3.8 5.5-7v-4L9 2.5Z" />
    <path d="m6.75 9 1.5 1.5 3-3" />
  </Svg>
)

export const IconJadval = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="3.5" width="13" height="12" rx="1.5" />
    <path d="M2.5 7h13M6 2v3M12 2v3M5.5 10h2M10.5 10h2M5.5 12.75h2" />
  </Svg>
)

export const IconMenyu = (p: P) => (
  <Svg {...p}>
    <path d="M3 5h12" />
    <path d="M3 9h12" />
    <path d="M3 13h8" />
  </Svg>
)
