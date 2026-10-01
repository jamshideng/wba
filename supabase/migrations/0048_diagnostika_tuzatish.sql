-- ============================================================
--  0048 — Diagnostika tuzatishlari (Supabase maslahatchisi uslubidagi tekshiruv, 02.10)
--
--  1. search_path o'rnatilmagan funksiyalar — qat'iy public (search_path
--     o'zgartirib boshqa sxemadagi soxta funksiyani "uloqtirib" bo'lmasin).
--  2. Kirmagan (anon) foydalanuvchi chaqira oladigan security definer
--     funksiyalar yopildi: tuzatish_jami / vip_oymi ma'lumot ko'rsatardi.
--     Kirganlarga ochiq qoladi (keyingi_oy_summasi — invoker — ularni chaqiradi).
--  3. Ko'p ishlatiladigan bog'lanishlarga indeks (qarz, market, Telegram,
--     bildirishnoma) — hozir ma'lumot kichik, o'sganda sekinlashmasin.
-- ============================================================

-- 1. search_path
alter function block_payment_delete() set search_path = public;
alter function bugun_toshkent() set search_path = public;
alter function chegirma_oyda(integer, numeric, integer, numeric, integer) set search_path = public;
alter function dars_kunimi(day_type, date) set search_path = public;
alter function davr_boshi(text) set search_path = public;
alter function davr_oxiri(text) set search_path = public;
alter function oy_raqami(date, text) set search_path = public;
alter function set_updated_at() set search_path = public;
alter function tel9(text) set search_path = public;
alter function tuzatish_ochirilmaydi() set search_path = public;

-- 2. anon'dan yopish
revoke execute on function guruh_dars_kunimi(smallint[], date) from public, anon;
revoke execute on function tuzatish_jami(uuid, text) from public, anon;
revoke execute on function vip_oymi(uuid, text) from public, anon;
revoke execute on function invoice_tuzatish_qoy() from public, anon;
revoke execute on function invoice_vip_qoy() from public, anon;
grant execute on function guruh_dars_kunimi(smallint[], date) to authenticated, service_role;
grant execute on function tuzatish_jami(uuid, text) to authenticated, service_role;
grant execute on function vip_oymi(uuid, text) to authenticated, service_role;

-- 3. Indekslar
create index if not exists payments_enrollment_idx            on payments (enrollment_id);
create index if not exists woblr_redemptions_reward_idx       on woblr_redemptions (reward_id);
create index if not exists woblr_teacher_idx                  on woblr (teacher_id);
create index if not exists groups_subject_idx                 on groups (subject_id);
create index if not exists leads_student_idx                  on leads (student_id);
create index if not exists telegram_ulanish_teacher_idx       on telegram_ulanish (teacher_id);
create index if not exists telegram_ulanish_profile_idx       on telegram_ulanish (profile_id);
create index if not exists profiles_oquvchi_idx               on profiles (oquvchi_id);
create index if not exists audit_log_profile_idx              on audit_log (profile_id);
create index if not exists bildirishnoma_javoblar_variant_idx on bildirishnoma_javoblar (variant_id);
create index if not exists bildirishnoma_javoblar_profil_idx  on bildirishnoma_javoblar (profile_id);
create index if not exists bildirishnoma_holat_profil_idx     on bildirishnoma_holat (profile_id);
