-- ============================================================
--  0105 — "To'lov tasdiqlanmagan" hodisasi direktorga (Jamshid, 28–29.10)
-- ============================================================
--  To'lovni faqat direktor tasdiqlaydi (0006). Nazorat esa 2 kundan beri
--  tasdiqlanmagan to'lovni pulni QABUL QILGAN adminga (qabul_qildi) yozardi —
--  Muhammadamin javobgar bo'lib qolardi. Endi bu hodisaning mas'uli — direktor.
--
--  nazorat_yig (0077) ga tegilmaydi: hodisa yozilayotganda trigger mas'ulni
--  direktorga almashtiradi. Hali yangi turgan hodisalar ham ko'chiriladi;
--  yopilgan/ogohlantirilganlar — tarix, o'zgarmaydi.
-- ============================================================

create or replace function nazorat_direktor_profili() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where rol = 'direktor' and holat = 'faol' order by created_at limit 1
$$;

create or replace function nazorat_tolov_direktorga() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.turi = 'tolov_tasdiqlanmadi' then
    new.profile_id := coalesce(nazorat_direktor_profili(), new.profile_id);
  end if;
  return new;
end;
$$;

drop trigger if exists nazorat_tolov_direktorga on nazorat_hodisalar;
create trigger nazorat_tolov_direktorga before insert on nazorat_hodisalar
  for each row execute function nazorat_tolov_direktorga();

update nazorat_hodisalar
   set profile_id = nazorat_direktor_profili()
 where turi = 'tolov_tasdiqlanmadi' and holat = 'yangi'
   and nazorat_direktor_profili() is not null;
