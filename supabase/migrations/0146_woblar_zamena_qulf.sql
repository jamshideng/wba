-- ============================================================
-- 0146 — zamena kuni woblarni faqat o'rinbosar beradi (Jamshid, 25.11)
--
-- Davomat zamena kuni guruh ustozida yopiq edi (0125, davomat_belgila).
-- Woblar esa ochiq qolgan edi — endi u ham yopiq: darsga zamena
-- qo'yilgan bo'lsa, o'rinbosardan boshqa ustoz woblar bera olmaydi.
-- Admin/rahbariyat va service_role (auth.uid() yo'q) cheklanmaydi.
-- Ko'chirilgan dars kuni — 0079 da allaqachon yopiq (hamma uchun).
-- ============================================================

create or replace function woblar_zamena_qulf() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_zamena text;
begin
  if new.lesson_id is null or auth.uid() is null or app_is_admin() then
    return new;
  end if;
  select l.zamena_teacher_id into v_zamena from lessons l where l.id = new.lesson_id;
  if v_zamena is not null and v_zamena is distinct from app_teacher_id() then
    raise exception 'Bu kun zamena: woblarni o''rinbosar ustoz beradi.';
  end if;
  return new;
end;
$$;
revoke execute on function woblar_zamena_qulf() from public, anon;

drop trigger if exists woblar_zamena_qulf on woblr;
create trigger woblar_zamena_qulf before insert on woblr
  for each row execute function woblar_zamena_qulf();
drop trigger if exists probniy_woblar_zamena_qulf on probniy_woblar;
create trigger probniy_woblar_zamena_qulf before insert on probniy_woblar
  for each row execute function woblar_zamena_qulf();
