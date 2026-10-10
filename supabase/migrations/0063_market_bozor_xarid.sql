-- ============================================================
--  0063 — Woblar market: an'anaviy bozordan sotib olish
-- ============================================================
--  Jamshid (10.10): bozorda Marketga qo'yilmagan narsalar ham sotiladi.
--  O'quvchi "An'anaviy bozordan sotib olish" ni tanlaydi, NIMA olganini
--  va NECHA woblar ekanini o'zi yozadi, "To'lov qilish" ni bosadi —
--  woblar yechiladi, chek chiqadi. Chekni adminga ko'rsatadi va narsasini
--  olib ketadi (admin "Berildi" qiladi — mavjud oqim).
--
--  Mahsulot jadvaliga bog'lanmaydi (reward_id = null, 0043 dan ruxsat),
--  ombor hisobi yo'q. Bekor qilinsa woblar qaytadi (market_bekor o'zgarmaydi).
-- ============================================================

alter table woblr_redemptions add column if not exists tur text not null default 'market';
alter table woblr_redemptions drop constraint if exists woblr_redemptions_tur_check;
alter table woblr_redemptions add constraint woblr_redemptions_tur_check check (tur in ('market', 'bozor'));
comment on column woblr_redemptions.tur is
  'market — Market mahsuloti; bozor — an''anaviy bozordan o''quvchi o''zi yozgan xarid (reward_id null).';

create or replace function market_bozor_xarid(p_nom text, p_ball int)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_oquvchi text := app_student_id();
  v_nom     text := nullif(regexp_replace(trim(coalesce(p_nom, '')), '\s+', ' ', 'g'), '');
  v_balans  int;
  v_kod     text;
begin
  if v_oquvchi is null then
    raise exception 'Xaridni faqat o''quvchi o''z hisobidan qiladi.';
  end if;
  if v_nom is null or length(v_nom) < 2 or length(v_nom) > 120 then
    raise exception 'Nima sotib olganingizni yozing (2–120 belgi).';
  end if;
  if p_ball is null or p_ball < 1 or p_ball > 100000 then
    raise exception 'Woblar soni 1 dan 100 000 gacha bo''lsin.';
  end if;

  -- Bir o'quvchining xaridlari navbat bilan (ikki marta bosish ortiqcha yechmaydi)
  perform pg_advisory_xact_lock(hashtext('market:' || v_oquvchi));

  v_balans := woblar_balansi(v_oquvchi);
  if v_balans < p_ball then
    raise exception 'Woblar yetmaydi: kerak %, sizda %.', p_ball, v_balans;
  end if;

  v_kod := market_kod();
  insert into woblr_redemptions (student_id, reward_id, ball, soni, kod, holat, mahsulot_nomi, tur)
  values (v_oquvchi, null, p_ball, 1, v_kod, 'kutilmoqda', v_nom, 'bozor');
  return v_kod;
end;
$$;

comment on function market_bozor_xarid(text, int) is
  'An''anaviy bozor: o''quvchi nom va woblarni o''zi yozadi, woblar yechiladi (holat kutilmoqda), chek kodi qaytadi.';

revoke execute on function market_bozor_xarid(text, int) from public, anon;
grant  execute on function market_bozor_xarid(text, int) to authenticated, service_role;
