/**
 * Baza tiplari.
 *
 * Supabase ulangandan keyin buni avtomatik generatsiya qilish mumkin:
 *   npx supabase gen types typescript --project-id <id> > src/lib/types.ts
 * Hozircha 0001–0004 migratsiyalariga qo'lda mos yozilgan.
 */

export type UserRole = 'admin' | 'direktor' | 'qabulxona' | 'ustoz' | 'oquvchi' | 'ota_ona'
export type AccountStatus = 'faol' | 'bloklangan'
export type StudentStatus = 'faol' | 'tanaffus' | 'ketgan'
export type GroupStatus = 'faol' | 'yopilgan'
export type DayType = 'toq' | 'juft' | 'dam_olish' | 'har_kuni'
export type EnrollmentStatus = 'faol' | 'tanaffus' | 'tugagan'
export type AttendanceStatus = 'keldi' | 'kechikdi' | 'sababli' | 'kelmadi'
export type PaymentMethod = 'naqd' | 'karta' | 'click' | 'payme'
export type InvoiceStatus = 'ochiq' | 'yopilgan' | 'bekor'
/** Botdagi Probniylar: Probniy→yangi · Doimiy→yozildi · Kelmadi→kelmadi · Rad etdi→rad */
export type LeadStatus = 'yangi' | 'qongiroq' | 'keldi' | 'kelmadi' | 'yozildi' | 'rad'
export type LeadSource = 'sayt' | 'telegram' | 'instagram' | 'tavsiya' | 'boshqa'
export type WoblrReason = 'faollik' | 'uy_vazifasi' | 'yordam' | 'qoida' | 'boshqa'
export type SalaryType = 'foiz' | 'oquvchi_soni' | 'fiks'
export type PaymentSource = 'crm' | 'sheets' | 'telegram'

export type Profile = {
  id: string
  rol: UserRole
  ism: string
  telefon: string | null
  /** Kirish uchun email — auth.users dan ko'chiriladi (0012) */
  email: string | null
  /** Ota-ona hisobi bog'langan o'quvchi (faqat rol=ota_ona uchun, 0019) */
  oquvchi_id: string | null
  holat: AccountStatus
  created_at: string
  updated_at: string
}

export type Subject = {
  id: string
  nom: string
  qisqa_tavsif: string | null
  yosh_chegarasi: string | null
  tartib: number
  saytda: boolean
  holat: GroupStatus
}

export type Level = {
  id: number
  subject_id: string
  nom: string
  tartib: number
}

export type Teacher = {
  id: string
  profile_id: string | null
  ism: string
  telefon: string | null
  telegram_id: number | null
  maosh_turi: SalaryType | null
  maosh_qiymati: number | null
  holat: AccountStatus
  created_at: string
  updated_at: string
}

export type Student = {
  id: string
  profile_id: string | null
  fish: string
  tugilgan_sana: string | null
  ota_tel: string | null
  ona_tel: string | null
  shaxsiy_tel: string | null
  qoshilgan_sana: string
  holat: StudentStatus
  izoh: string | null
  /** Arxivga o'tgan kun va sabab (0030) */
  arxiv_sana: string | null
  arxiv_sabab: string | null
  /** 0046 — tanaffusdagi o'quvchi qachon qaytadi va nega */
  qaytish_sana: string | null
  tanaffus_sabab: string | null
  created_at: string
  updated_at: string
}

export type Group = {
  id: string
  nom: string
  subject_id: string | null
  level_id: number | null
  teacher_id: string | null
  boshlanish: string
  tugash: string
  kun_turi: DayType
  /** ISO hafta kunlari (1 = dushanba … 7 = yakshanba) — 0028 */
  kunlar: number[]
  oylik_narx: number
  sigim: number
  holat: GroupStatus
  created_at: string
  updated_at: string
}

export type Enrollment = {
  id: string
  /** Sheets qatorining ID'si (Q001 / T0001 / P001); CRM'da yaratilganda null */
  sheets_id: string | null
  student_id: string
  group_id: string
  boshlandi: string
  tugadi: string | null
  chegirma_summa: number
  /** 0 — chegirma yo'q, N — N oy, null — muddatsiz */
  chegirma_oy: number | null
  chegirma2_summa: number
  chegirma2_oy: number | null
  chegirma_sabab: string | null
  /** VIP — to'lamaydi (0030) */
  vip: boolean
  vip_dan: string | null
  holat: EnrollmentStatus
  created_at: string
  updated_at: string
}

export type Lesson = {
  id: string
  group_id: string
  sana: string
  mavzu: string | null
  otkazildi: boolean
  created_at: string
}

export type Attendance = {
  id: string
  lesson_id: string
  student_id: string
  holat: AttendanceStatus
  belgiladi: string | null
  created_at: string
  updated_at: string
}

export type Woblr = {
  id: number
  student_id: string
  lesson_id: string | null
  teacher_id: string | null
  bergan_profile: string | null
  ball: number
  sabab: WoblrReason
  izoh: string | null
  created_at: string
}

export type WoblrReward = {
  id: string
  nom: string
  tavsif: string | null
  narx_ball: number
  qolgan_soni: number
  holat: GroupStatus
  created_at: string
  /** Woblar Market (0040) */
  toifa: string | null
  rasm_url: string | null
  /** 0042 — barcha rasmlar, birinchisi = rasm_url */
  rasmlar: string[]
  /** 0042 — sotuvda: hozir bor; oldindan: oldindan buyurtma, keyin keladi */
  rejim: 'sotuvda' | 'oldindan'
  kelish_sana: string | null
  cheksiz: boolean
  tartib: number
  updated_at: string
}

/** Woblar Market buyurtmasi (0040) */
export type WoblrRedemption = {
  id: string
  student_id: string
  /** 0043: mahsulot o'chirilsa bo'shaydi — nomi mahsulot_nomi'da qoladi */
  reward_id: string | null
  ball: number
  berdi: string | null
  created_at: string
  kod: string | null
  soni: number
  holat: 'buyurtma' | 'kutilmoqda' | 'berildi' | 'bekor'
  mahsulot_nomi: string | null
  keldi_vaqt: string | null
  berildi_vaqt: string | null
  bekor_sabab: string | null
  bekor_qildi: string | null
}

export type Invoice = {
  id: string
  enrollment_id: string
  davr: string
  summa: number
  chegirma: number
  /** Shu oyga qo'lda ayirilgan summa (0029) */
  tuzatish: number
  holat: InvoiceStatus
  created_at: string
  updated_at: string
}

export type Payment = {
  id: number
  /** Sheets qatorining ID'si (Q001 / T0001 / P001); CRM'da yaratilganda null */
  sheets_id: string | null
  student_id: string
  enrollment_id: string | null
  sana: string
  davr: string
  summa: number
  /** Ko'chirilgan to'lovda usul bo'lmasligi mumkin — manbada yozilmagan */
  usul: PaymentMethod | null
  manba: PaymentSource
  tasdiqlangan: boolean
  tasdiqladi: string | null
  tasdiqlangan_vaqt: string | null
  qabul_qildi: string | null
  bekor: boolean
  bekor_sabab: string | null
  izoh: string | null
  created_at: string
  updated_at: string
}

export type Lead = {
  id: string
  /** Sheets qatorining ID'si (Q001 / T0001 / P001); CRM'da yaratilganda null */
  sheets_id: string | null
  ism: string
  telefon: string
  subject_id: string | null
  manba: LeadSource
  holat: LeadStatus
  izoh: string | null
  student_id: string | null
  group_id: string | null
  tugilgan_sana: string | null
  sinov_sana: string | null
  created_at: string
  updated_at: string
}

/** 0001 · o'chirilmaydigan iz: kim, qachon, nimani o'zgartirdi */
export type AuditLog = {
  id: number
  profile_id: string | null
  amal: string
  jadval: string
  obyekt_id: string | null
  eski: unknown
  yangi: unknown
  created_at: string
}

export type Setting = {
  kalit: string
  qiymat: unknown
  tavsif: string | null
  ozgartirdi: string | null
  updated_at: string
}

/* ---------- View'lar ---------- */

/** Yozilish kesimida: 0002_functions.sql dagi v_enrollment_balance */
export type EnrollmentBalance = {
  enrollment_id: string
  student_id: string
  group_id: string
  hisoblangan: number
  chegirma: number
  tolangan: number
  tasdiqlangan: number
  qarz: number
}

export type StudentBalance = {
  student_id: string
  fish: string
  holat: StudentStatus
  hisoblangan: number
  chegirma: number
  tolangan: number
  tasdiqlangan: number
  qarz: number
}

export type Qarzdor = {
  student_id: string
  fish: string
  qarz: number
  ota_tel: string | null
  ona_tel: string | null
  shaxsiy_tel: string | null
  guruhlar: string | null
}

export type DashboardStats = {
  oquvchilar: number
  guruhlar: number
  ustozlar: number
  qarzdorlar: number
  jami_qarz: number
  joriy_oy_tushumi: number
  joriy_oy_tolovlari: number
  chegirma: number
  tasdiqlanmagan_soni: number
  tasdiqlanmagan_summa: number
  /** Faol yozilishlar — 2 fanli bola 2 marta (0041) */
  fan_boyicha: number
}

export type TeacherStats = {
  teacher_id: string
  ism: string
  holat: AccountStatus
  guruhlar: number
  oquvchilar: number
  tushum: number
  qarz: number
}

export type GroupStats = {
  group_id: string
  nom: string
  teacher_id: string | null
  oylik_narx: number
  oquvchilar: number
  tushum: number
  qarz: number
}

export type AttendanceMonthly = {
  student_id: string
  davr: string
  group_id: string
  darslar: number
  kelgan: number
  foiz: number
}

export type WoblrBalance = {
  student_id: string
  fish: string
  jami_ball: number
  sarflangan: number
  balans: number
  oxirgi: string | null
}

export type MonthlyIncome = {
  davr: string
  tushum: number
  tolovlar: number
  tasdiqlangan: number | null
}

export type LeaderboardRow = {
  orin: number
  student_id: string
  fish: string
  ball: number
}

/* ---------- Telegram bot va e'lonlar (0021) ---------- */

export type TelegramKim = 'oquvchi' | 'ota_ona' | 'ustoz' | 'xodim'

export type TelegramUlanish = {
  id: number
  chat_id: number
  kim: TelegramKim
  student_id: string | null
  teacher_id: string | null
  profile_id: string | null
  telefon: string | null
  tg_ism: string | null
  holat: 'faol' | 'bloklagan'
  created_at: string
  updated_at: string
}

export type ElonTuri = 'umumiy' | 'tolov' | 'test' | 'majlis'
export type ElonFiltr = { guruh?: string; fan?: string; qarzdor?: boolean }

export type Elon = {
  id: number
  turi: ElonTuri
  matn: string
  kimga: TelegramKim[]
  filtr: ElonFiltr
  yaratdi: string | null
  created_at: string
  yuborildi_at: string | null
  jami: number
  yetkazildi: number
  xato: number
}

export type ElonYetkazish = {
  id: number
  elon_id: number
  chat_id: number
  kim: TelegramKim
  student_id: string | null
  holat: 'navbatda' | 'yetkazildi' | 'xato' | 'bloklagan'
  xato_matn: string | null
  yuborildi_at: string | null
}

/** elon_oluvchilar() — chat_id bo'sh bo'lsa, odam botga ulanmagan */
export type ElonOluvchi = {
  kim: TelegramKim
  nishon: string
  ism: string
  chat_id: number | null
  student_id: string | null
  qarz: number | null
}

export type UlanishNatija = { kim: TelegramKim; ism: string }

/** keyingi_darslar() — guruh jadvalidan hisoblangan keyingi dars (0020). */
export type KeyingiDars = {
  group_id: string
  nom: string
  sana: string
  boshlanish: string
  tugash: string
}

/** 0007_davomat.sql · bugun darsi bor guruhlar */
export type BugungiDars = {
  group_id: string
  nom: string
  teacher_id: string | null
  boshlanish: string
  tugash: string
  kun_turi: DayType
  sana: string
  lesson_id: string | null
  belgilangan: boolean
  oquvchilar: number
  kunlar: number[]
}

/** 0029 · oyma-oy qo'lda ayirish */
export type Tuzatish = {
  id: number
  enrollment_id: string
  davr: string
  summa: number
  sabab: string
  kiritdi: string | null
  bekor: boolean
  bekor_sabab: string | null
  bekor_qildi: string | null
  created_at: string
}

/** Markaz xarajati (0033). O'chirilmaydi — bekor qilinadi. */
export type Xarajat = {
  id: number
  sana: string
  toifa: 'ijara' | 'maosh' | 'kommunal' | 'reklama' | 'jihoz' | 'ofis' | 'soliq' | 'boshqa'
  summa: number
  izoh: string | null
  kiritgan: string | null
  bekor: boolean
  bekor_sabab: string | null
  created_at: string
  updated_at: string
}

/** davomat_saqla() qaytaradigan natija */
export type DavomatNatija = {
  dars_id: string
  davomat: number
  ball: number
}

/** 0047 · Sayt ichidagi bildirishnoma */
export type Bildirishnoma = {
  id: number
  turi: 'eslatma' | 'elon' | 'reklama' | 'sorovnoma'
  sarlavha: string
  matn: string | null
  havola: string | null
  havola_matn: string | null
  kimga: TelegramKim[]
  filtr: ElonFiltr
  muhim: boolean
  kop_tanlov: boolean
  natija_ochiq: boolean
  boshlanish: string
  tugash: string | null
  holat: 'faol' | 'yopilgan'
  yaratdi: string | null
  created_at: string
}

/** 0045 · hisobot_grafik() — kunlik qatorlar va trend */
export type HisobotGrafik = {
  kunlar: { sana: string; tushum: number; belgi: number; kelgan: number; yangi: number }[]
  joriy: { tushum: number; tolov: number; belgi: number; kelgan: number; yangi: number }
  oldingi: { tushum: number; belgi: number; kelgan: number; yangi: number }
  guruhlar: { id: string; nom: string; tushum: number }[]
  qarzdorlar: number
}

/** 0044 · Hisobotlar bo'limlari */
export type HisobotMoliya = {
  oylar: { davr: string; hisoblangan: number; chegirma: number; vip: number; tuzatish: number; yigilgan: number; yozilish: number }[]
  qarz_oylar: { davr: string; qarz: number }[]
  qarz: number
  qarzdor_yozilish: number
  oldindan: number
  keyingi_davr: string
  keyingi_kutilgan: number
  boglanmagan_tolov: number
}
export type HisobotOquvchilar = {
  oylar: {
    davr: string; yangi_bola: number; yangi_fan: number; ketgan_bola: number; tugagan_fan: number
    faol_bola: number; faol_fan: number; probniy: number; probniy_yozildi: number
  }[]
  fanlar: { fan: string; yozilish: number; bola: number; guruh: number }[]
  faol_bola: number
  faol_fan: number
  ikki_fanli: number
  vip: number
  arxiv: number
}
export type HisobotUstoz = {
  id: string; ism: string; guruh: number; yozilish: number; belgi: number; kelgan: number
  dars: number; tushum: number; qarz: number; woblar: number
}
export type HisobotDavomat = {
  jami_belgi: number
  jami_kelgan: number
  haftalar: { hafta: string; belgi: number; kelgan: number }[]
  guruhlar: { id: string; nom: string; ustoz: string; oquvchi: number; belgi: number; kelgan: number }[]
  qoldiruvchilar: { student_id: string; fish: string; guruh: string; belgi: number; kelmadi: number }[]
}

/** 0010 · tushum_hisobot() natijasi */
export type HisobotQator = { nom: string; summa: number; soni: number }
export type Hisobot = {
  tushum: number
  soni: number
  odam: number
  tasdiqlanmagan: number
  usul: HisobotQator[]
  ustoz: HisobotQator[]
  yonalish: HisobotQator[]
  kunlar: { sana: string; summa: number; soni: number }[]
  davomat: { belgilar: number; kelgan: number; kelmadi: number; sababli: number }
  darslar: { kutilgan: number; qilinmagan: number }
  qilinmagan: { ustoz: string; nom: string; sana: string }[]
  probniy: { jami: number; kutilmoqda: number; yozildi: number; kelmadi: number; rad: number }
}

/* ---------- Supabase klient uchun sxema ---------- */

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type View<Row> = { Row: Row; Relationships: [] }

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>
      telegram_ulanish: Table<TelegramUlanish>
      elonlar: Table<Elon>
      bildirishnomalar: Table<Bildirishnoma>
      bildirishnoma_variantlar: Table<{ id: number; bildirishnoma_id: number; savol_id: number; matn: string; tartib: number }>
      bildirishnoma_savollar: Table<{ id: number; bildirishnoma_id: number; matn: string; kop_tanlov: boolean; tartib: number }>
      elon_yetkazish: Table<ElonYetkazish>
      subjects: Table<Subject>
      levels: Table<Level>
      teachers: Table<Teacher>
      students: Table<Student>
      groups: Table<Group>
      enrollments: Table<Enrollment>
      lessons: Table<Lesson>
      attendance: Table<Attendance>
      woblr: Table<Woblr>
      woblr_rewards: Table<WoblrReward>
      woblr_redemptions: Table<WoblrRedemption>
      invoices: Table<Invoice>
      payments: Table<Payment>
      leads: Table<Lead>
      tuzatishlar: Table<Tuzatish>
      xarajatlar: Table<Xarajat>
      dam_kunlar: Table<{ sana: string; sabab: string; kiritdi: string | null; created_at: string }>
      settings: Table<Setting>
      audit_log: Table<AuditLog>
    }
    Views: {
      v_enrollment_balance: View<EnrollmentBalance>
      v_student_balance: View<StudentBalance>
      v_qarzdorlar: View<Qarzdor>
      v_dashboard: View<DashboardStats>
      v_teacher_stats: View<TeacherStats>
      v_group_stats: View<GroupStats>
      v_attendance_monthly: View<AttendanceMonthly>
      v_woblr_balance: View<WoblrBalance>
      v_monthly_income: View<MonthlyIncome>
      v_bugungi_darslar: View<BugungiDars>
      v_arxiv_oquvchilar: View<{ student_id: string; fish: string; arxiv_sana: string | null; arxiv_sabab: string | null; qarz: number; guruhlar: string | null }>
    }
    Functions: {
      woblr_leaderboard: {
        Args: { p_group?: string | null; p_davr?: string | null; p_fan?: string | null }
        Returns: LeaderboardRow[]
      }
      keyingi_darslar: {
        Args: { p_student: string; p_soni?: number }
        Returns: KeyingiDars[]
      }
      create_monthly_invoices: { Args: { p_davr?: string }; Returns: number }
      generate_lessons: {
        Args: { p_group: string; p_from: string; p_to: string }
        Returns: number
      }
      davomat_saqla: {
        Args: {
          p_group: string
          p_sana: string
          p_belgilar: Record<string, AttendanceStatus>
          p_ballar?: Record<string, number>
          p_mavzu?: string | null
        }
        Returns: DavomatNatija
      }
      dars_kunimi: { Args: { p_kun: DayType; p_sana: string }; Returns: boolean }
      guruh_dars_kunimi: { Args: { p_kunlar: number[]; p_sana: string }; Returns: boolean }
      dam_kunimi: { Args: { p_sana: string }; Returns: boolean }
      kunlik_band: { Args: { p_kun: string }; Returns: boolean }
      market_buyurtma: { Args: { p_reward: string; p_soni?: number }; Returns: string }
      market_berildi: { Args: { p_kod: string }; Returns: undefined }
      market_bekor: { Args: { p_kod: string; p_sabab?: string | null }; Returns: undefined }
      market_keldi: { Args: { p_kod: string }; Returns: string }
      market_mahsulot_ochir: { Args: { p_reward: string }; Returns: { student_id: string; kod: string }[] }
      market_mahsulot_keldi: {
        Args: { p_reward: string; p_sotuvga?: boolean }
        Returns: { student_id: string; kod: string }[]
      }
      davomat_belgila: {
        Args: { p_group: string; p_sana: string; p_belgilar: Record<string, AttendanceStatus | null> }
        Returns: number
      }
      jurnal_probniylar: {
        Args: { p_group: string; p_dan: string; p_gacha: string }
        Returns: { lead_id: string; ism: string; dan: string; belgilar: Record<string, AttendanceStatus> }[]
      }
      probniy_belgila: {
        Args: { p_group: string; p_sana: string; p_lead: string; p_holat: AttendanceStatus | null }
        Returns: undefined
      }
      vip_ozgartir: { Args: { p_enrollment: string; p_vip: boolean; p_dan?: string | null }; Returns: number }
      oquvchi_arxivla: { Args: { p_student: string; p_sana?: string | null; p_sabab?: string | null }; Returns: number }
      oquvchi_arxivdan: { Args: { p_student: string }; Returns: undefined }
      yozilish_oylari: {
        Args: { p_student: string }
        Returns: { enrollment_id: string; davr: string; narx: number; chegirma: number; tuzatish: number; kerak: number; tolangan: number; holat: string }[]
      }
      keyingi_oylar: { Args: { p_student: string }; Returns: { enrollment_id: string; summa: number | null }[] }
      oylik_moliya: {
        Args: { p_davr: string }
        Returns: { davr: string; tushum: number; xarajat: number; foyda: number; toifalar: { toifa: string; summa: number; soni: number }[] }
      }
      keyingi_oy_summasi: { Args: { p_enrollment: string; p_davr?: string | null }; Returns: number }
      tuzatish_qosh: {
        Args: { p_enrollment: string; p_davr: string; p_summa: number; p_sabab: string }
        Returns: number
      }
      tuzatish_bekor: { Args: { p_id: number; p_sabab?: string | null }; Returns: undefined }
      woblar_ber: { Args: { p_group: string; p_student: string; p_ball: number }; Returns: number }
      keyingi_id: { Args: { p_jadval: string; p_prefiks: string; p_uzunlik?: number }; Returns: string }
      oquvchi_qosh: { Args: { p: Record<string, unknown> }; Returns: string }
      guruhga_biriktir: {
        Args: { p_student: string; p_group: string; p_boshlandi?: string | null; p_chegirma?: Record<string, unknown> }
        Returns: string
      }
      guruhdan_chiqar: { Args: { p_enrollment: string; p_sana?: string | null }; Returns: undefined }
      yozilish_hisoblari: { Args: { p_enrollment: string }; Returns: number }
      probniy_doimiy: { Args: { p_lead: string; p_boshlandi?: string | null }; Returns: string }
      tushum_hisobot: { Args: { p_dan: string; p_gacha: string }; Returns: Hisobot }
      hisobot_grafik: { Args: { p_dan: string; p_gacha: string }; Returns: HisobotGrafik }
      hisobot_moliya: { Args: { p_oylar?: number }; Returns: HisobotMoliya }
      hisobot_oquvchilar: { Args: { p_oylar?: number }; Returns: HisobotOquvchilar }
      hisobot_ustozlar: { Args: { p_dan: string; p_gacha: string }; Returns: HisobotUstoz[] }
      hisobot_davomat: { Args: { p_dan: string; p_gacha: string }; Returns: HisobotDavomat }
      chegirma_ozgartir: { Args: { p_enrollment: string; p: Record<string, unknown> }; Returns: number }
      telegram_token_ol: { Args: Record<string, never>; Returns: string }
      telegram_ula_token: { Args: { p_token: string; p_chat: number; p_tg_ism: string }; Returns: UlanishNatija[] }
      telegram_ula_telefon: { Args: { p_tel: string; p_chat: number; p_tg_ism: string }; Returns: UlanishNatija[] }
      telegram_ula_qator: {
        Args: {
          p_chat: number; p_kim: TelegramKim; p_student: string | null; p_teacher: string | null
          p_profile: string | null; p_tel: string | null; p_tg_ism: string
        }
        Returns: undefined
      }
      telegram_bloklagan: { Args: { p_chat: number }; Returns: undefined }
      elon_oluvchilar: { Args: { p_kimga: TelegramKim[]; p_filtr?: ElonFiltr }; Returns: ElonOluvchi[] }
      bildirishnoma_belgila: { Args: { p_id: number; p_yopildi?: boolean }; Returns: undefined }
      sorovnomaga_javob: { Args: { p_id: number; p_variantlar: number[] }; Returns: undefined }
      sorovnoma_natija: { Args: { p_id: number }; Returns: { variant_id: number; matn: string; ovoz: number; jami: number }[] }
      bildirishnoma_statistika: { Args: Record<string, never>; Returns: { bildirishnoma_id: number; korgan: number; yopgan: number; javob_bergan: number }[] }
      mening_bildirishnomalarim: { Args: Record<string, never>; Returns: unknown }
      rate_limit_hit: {
        Args: { p_bucket: string; p_kalit: string; p_limit: number; p_oyna_sek: number }
        Returns: boolean
      }
    }
    Enums: {
      user_role: UserRole
      account_status: AccountStatus
      student_status: StudentStatus
      group_status: GroupStatus
      day_type: DayType
      enrollment_status: EnrollmentStatus
      attendance_status: AttendanceStatus
      payment_method: PaymentMethod
      invoice_status: InvoiceStatus
      lead_status: LeadStatus
      lead_source: LeadSource
      woblr_reason: WoblrReason
      salary_type: SalaryType
    }
    CompositeTypes: Record<string, never>
  }
}
