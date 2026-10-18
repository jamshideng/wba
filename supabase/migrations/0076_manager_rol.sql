-- ============================================================
--  0076 — MANAGER roli (Jamshid, 17–18.10)
-- ============================================================
--  Enum qiymati alohida migratsiyada: yangi qiymat shu tranzaksiya
--  ichida ishlatilmaydi (Postgres cheklovi). Huquqlar — 0077.
-- ============================================================

alter type user_role add value if not exists 'manager';
