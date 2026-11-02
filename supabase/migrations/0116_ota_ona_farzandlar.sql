-- ============================================================
--  0116 — Ota-ona kabineti: bir nechta farzand (Jamshid, 02.11)
-- ============================================================
--  1. students.ota_ona_id — har o'quvchiga BITTA ota-ona hisobi, bir
--     ota-onada bir nechta farzand. Eski profiles.oquvchi_id ko'chiriladi
--     va endi faqat moslik uchun qoladi (yozilmaydi, o'qilmaydi).
--  2. app_farzandmi(id) — RLS va funksiyalar endi "shu o'quvchi menikimi".
--     app_farzand_id() — birinchi farzand (eski chaqiruvlar uchun).
--  3. Ota-ona RLS qoidalari (0019, 0021, 0051, 0104) qayta yoziladi;
--     tuzatishlar va market buyurtmalarini o'qish qo'shiladi.
--  4. Bildirishnoma, push, Telegram — har farzand bo'yicha.
--  5. Market: ota-ona farzand nomidan buyurtma beradi (farzandning
--     woblaridan); buyurtmada buyurtmachi profili saqlanadi.
--  6. Admin: ota_ona_biriktir / ota_ona_uzish (admin, manager, direktor).
--  7. teachers.telegram_user + ota-onaga ustoz ma'lumoti (farzand_ustozi).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bog'lanish
-- ------------------------------------------------------------
alter table students add column if not exists ota_ona_id uuid references profiles (id) on delete set null;
create index if not exists students_ota_ona_idx on students (ota_ona_id);
comment on column students.ota_ona_id is
  'Ota-ona hisobi (profiles, rol=ota_ona). Bitta o''quvchi — bitta ota-ona; bir ota-onada bir nechta farzand (0116).';

update students s
   set ota_ona_id = p.id
  from profiles p
 where p.oquvchi_id = s.id and p.rol = 'ota_ona' and s.ota_ona_id is null;

comment on column profiles.oquvchi_id is
  'ESKI (0019). 0116 dan bog''lanish students.ota_ona_id da — bu ustun ishlatilmaydi.';

-- Bog'lanadigan profil faqat ota-ona bo'lsin
create or replace function students_ota_ona_tekshir() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ota_ona_id is not null and new.ota_ona_id is distinct from old.ota_ona_id
     and not exists (select 1 from profiles where id = new.ota_ona_id and rol = 'ota_ona') then
    raise exception 'Faqat ota-ona hisobini biriktirish mumkin.';
  end if;
  return new;
end;
$$;
drop trigger if exists students_ota_ona_tekshir on students;
create trigger students_ota_ona_tekshir before insert or update of ota_ona_id on students
  for each row execute function students_ota_ona_tekshir();

-- ------------------------------------------------------------
-- 2. Yordamchi funksiyalar
-- ------------------------------------------------------------
create or replace function app_farzandmi(p_student text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_student is not null and auth.uid() is not null
     and exists (select 1 from students where id = p_student and ota_ona_id = auth.uid())
$$;
revoke execute on function app_farzandmi(text) from public, anon;
grant  execute on function app_farzandmi(text) to authenticated, service_role;

create or replace function app_farzand_id() returns text
language sql stable security definer set search_path = public as $$
  select id from students where ota_ona_id = auth.uid() order by holat = 'ketgan', fish limit 1
$$;

-- ------------------------------------------------------------
-- 3. RLS — ota-ona hamma farzandlarini o'qiydi
-- ------------------------------------------------------------
drop policy if exists students_parent_read on students;
create policy students_parent_read on students for select to authenticated
  using (ota_ona_id = auth.uid());

drop policy if exists enrollments_parent_read on enrollments;
create policy enrollments_parent_read on enrollments for select to authenticated
  using (app_farzandmi(student_id));

drop policy if exists groups_parent_read on groups;
create policy groups_parent_read on groups for select to authenticated
  using (exists (
    select 1 from enrollments e
    where e.group_id = groups.id and app_farzandmi(e.student_id) and e.holat <> 'tugagan'
  ));

drop policy if exists lessons_parent_read on lessons;
create policy lessons_parent_read on lessons for select to authenticated
  using (exists (
    select 1 from enrollments e
    where e.group_id = lessons.group_id and app_farzandmi(e.student_id) and e.holat <> 'tugagan'
  ));

drop policy if exists attendance_parent_read on attendance;
create policy attendance_parent_read on attendance for select to authenticated
  using (app_farzandmi(student_id));

drop policy if exists woblr_parent_read on woblr;
create policy woblr_parent_read on woblr for select to authenticated
  using (app_farzandmi(student_id));

drop policy if exists payments_parent_read on payments;
create policy payments_parent_read on payments for select to authenticated
  using (app_farzandmi(student_id));

drop policy if exists invoices_parent_read on invoices;
create policy invoices_parent_read on invoices for select to authenticated
  using (exists (
    select 1 from enrollments e
    where e.id = invoices.enrollment_id and app_farzandmi(e.student_id)
  ));

drop policy if exists tuzatishlar_parent_read on tuzatishlar;
create policy tuzatishlar_parent_read on tuzatishlar for select to authenticated
  using (exists (
    select 1 from enrollments e
    where e.id = tuzatishlar.enrollment_id and app_farzandmi(e.student_id)
  ));

drop policy if exists redemptions_parent_read on woblr_redemptions;
create policy redemptions_parent_read on woblr_redemptions for select to authenticated
  using (app_farzandmi(student_id));

drop policy if exists telegram_ulanish_own_read on telegram_ulanish;
create policy telegram_ulanish_own_read on telegram_ulanish for select to authenticated
  using (
    profile_id = auth.uid()
    or (kim = 'oquvchi' and student_id = app_student_id())
    or (kim = 'ota_ona' and app_farzandmi(student_id))
    or (teacher_id is not null and teacher_id = app_teacher_id())
  );

drop policy if exists oylik_natijalar_oz on oylik_test_natijalar;
create policy oylik_natijalar_oz on oylik_test_natijalar for select to authenticated
  using (elon_qilingan and (student_id = app_student_id() or app_farzandmi(student_id)));

-- ------------------------------------------------------------
-- 4. Funksiyalarni moslash (matnni almashtirib — oldingi o'zgarishlar saqlanadi)
-- ------------------------------------------------------------
do $$
declare
  v_def text;
  v_eski text;
  v_yangi text;
begin
  -- 4.1 oylik test: o'quvchi yoki ota-onaning istalgan farzandi
  foreach v_eski in array array['oylik_natijalarim()', 'oylik_test_menga_ochiqmi(uuid)'] loop
    v_def := pg_get_functiondef(v_eski::regprocedure);
    if position('in (app_student_id(), app_farzand_id())' in v_def) = 0 then
      raise exception '0116: % kutilgan ko''rinishda emas', v_eski;
    end if;
    execute replace(v_def, 'student_id in (app_student_id(), app_farzand_id())',
                    'student_id in (select app_student_id() union all select id from students where ota_ona_id = auth.uid())');
  end loop;

  -- 4.2 woblar tarixi: ota-ona tanlagan farzand (p_student), bo'lmasa birinchisi
  v_def := pg_get_functiondef('woblr_tarix(date, date, uuid, text, text, integer)'::regprocedure);
  v_eski := 'coalesce(app_student_id(), app_farzand_id())';
  if position(v_eski in v_def) = 0 then raise exception '0116: woblr_tarix kutilgan ko''rinishda emas'; end if;
  execute replace(v_def, v_eski,
    'coalesce(app_student_id(), case when app_farzandmi(p_student) then p_student end, app_farzand_id())');

  -- 4.3 bildirishnoma_menga — ota-onaning istalgan farzandi mos kelsa
  v_def := pg_get_functiondef('bildirishnoma_menga(text[], jsonb)'::regprocedure);
  v_eski := 'select oquvchi_id into v_student from profiles where id = auth.uid() and rol = ''ota_ona'';';
  if position(v_eski in v_def) = 0 then raise exception '0116: bildirishnoma_menga kutilgan ko''rinishda emas'; end if;
  v_def := replace(v_def, v_eski,
    'select s.id into v_student from students s
      where s.ota_ona_id = auth.uid() and s.holat <> ''ketgan''
        and (v_oquvchi is null or s.id = v_oquvchi)
        and (v_guruh is null or exists (select 1 from enrollments e where e.student_id = s.id and e.group_id = v_guruh and e.holat <> ''tugagan''))
        and (v_fan is null or exists (select 1 from enrollments e join groups g on g.id = e.group_id
                                      where e.student_id = s.id and g.subject_id = v_fan and e.holat <> ''tugagan''))
        and (not v_qarzdor or coalesce((select qarz from v_student_balance where student_id = s.id), 0) > 0)
      order by s.fish limit 1;');
  execute v_def;

  -- 4.4 bildirishnoma_profilga (push oluvchilari) — xuddi shunday
  v_def := pg_get_functiondef('bildirishnoma_profilga(uuid, text[], jsonb)'::regprocedure);
  v_eski := 'select oquvchi_id into v_student from profiles where id = p_profile;';
  if position(v_eski in v_def) = 0 then raise exception '0116: bildirishnoma_profilga kutilgan ko''rinishda emas'; end if;
  v_def := replace(v_def, v_eski,
    'select s.id into v_student from students s
      where s.ota_ona_id = p_profile and s.holat <> ''ketgan''
        and (v_oquvchi is null or s.id = v_oquvchi)
        and (v_guruh is null or exists (select 1 from enrollments e where e.student_id = s.id and e.group_id = v_guruh and e.holat <> ''tugagan''))
        and (v_fan is null or exists (select 1 from enrollments e join groups g on g.id = e.group_id
                                      where e.student_id = s.id and g.subject_id = v_fan and e.holat <> ''tugagan''))
        and (not v_qarzdor or coalesce((select qarz from v_student_balance where student_id = s.id), 0) > 0)
      order by s.fish limit 1;');
  execute v_def;

  -- 4.5 Telegram: ota-ona ulanganda — hamma farzandlari bo'yicha
  v_def := pg_get_functiondef('telegram_ula_token(text, bigint, text)'::regprocedure);
  v_eski := 'from profiles p where p.id = v_profil and p.oquvchi_id is not null;';
  if position(v_eski in v_def) = 0 then raise exception '0116: telegram_ula_token kutilgan ko''rinishda emas'; end if;
  v_def := replace(v_def, 'perform telegram_ula_qator(p_chat, ''ota_ona'', p.oquvchi_id, null, null, null, p_tg_ism)',
                          'perform telegram_ula_qator(p_chat, ''ota_ona'', s.id, null, null, null, p_tg_ism)');
  execute replace(v_def, v_eski, 'from students s where s.ota_ona_id = v_profil;');

  -- 4.6 O'quvchini birlashtirish: ota-ona bog'lanishi ham o'tadi
  v_def := pg_get_functiondef('oquvchi_birlashtir(text, text)'::regprocedure);
  v_eski := 'update profiles          set oquvchi_id = a.id where oquvchi_id = b.id;';
  if position(v_eski in v_def) = 0 then raise exception '0116: oquvchi_birlashtir kutilgan ko''rinishda emas'; end if;
  execute replace(v_def, v_eski, v_eski ||
    ' update students set ota_ona_id = coalesce(ota_ona_id, (select ota_ona_id from students where id = b.id)) where id = a.id;');

  -- 4.7 O'chirish to'sig'i: ota-ona biriktirilgan o'quvchi
  v_def := pg_get_functiondef('oquvchi_ochirish_tosiqlar(text)'::regprocedure);
  v_eski := 'exists (select 1 from profiles where oquvchi_id = p_student)';
  if position(v_eski in v_def) = 0 then raise exception '0116: oquvchi_ochirish_tosiqlar kutilgan ko''rinishda emas'; end if;
  execute replace(v_def, v_eski,
    '(exists (select 1 from profiles where oquvchi_id = p_student) or exists (select 1 from students where id = p_student and ota_ona_id is not null))');
end $$;

-- ------------------------------------------------------------
-- 5. Market: ota-ona farzand nomidan
-- ------------------------------------------------------------
alter table woblr_redemptions add column if not exists buyurtmachi uuid references profiles (id) on delete set null;
comment on column woblr_redemptions.buyurtmachi is
  'Kim buyurtma berdi: o''quvchining o''zi yoki ota-onasi (0116). NULL — eski yozuvlar.';

do $$
declare
  v_def text := pg_get_functiondef('market_buyurtma(uuid, integer)'::regprocedure);
begin
  if position('v_oquvchi text := app_student_id();' in v_def) = 0
     or position('insert into woblr_redemptions (student_id, reward_id, ball, soni, kod, holat, mahsulot_nomi)' in v_def) = 0 then
    raise exception '0116: market_buyurtma kutilgan ko''rinishda emas';
  end if;
  -- Yangi 3 argumentli funksiya: p_student — ota-ona tanlagan farzand
  v_def := replace(v_def, 'market_buyurtma(p_reward uuid, p_soni integer DEFAULT 1)',
                          'market_buyurtma_farzand(p_student text, p_reward uuid, p_soni integer DEFAULT 1)');
  v_def := replace(v_def, 'v_oquvchi text := app_student_id();',
                          'v_oquvchi text := case when app_farzandmi(p_student) then p_student end;');
  v_def := replace(v_def, 'raise exception ''Buyurtmani faqat o''''quvchi o''''z hisobidan beradi.'';',
                          'raise exception ''Bu o''''quvchi sizning farzandingiz emas.'';');
  v_def := replace(v_def, 'insert into woblr_redemptions (student_id, reward_id, ball, soni, kod, holat, mahsulot_nomi)',
                          'insert into woblr_redemptions (student_id, reward_id, ball, soni, kod, holat, mahsulot_nomi, buyurtmachi)');
  v_def := replace(v_def, 'v_m.nom);', 'v_m.nom, auth.uid());');
  execute v_def;
end $$;
revoke execute on function market_buyurtma_farzand(text, uuid, integer) from public, anon;
grant  execute on function market_buyurtma_farzand(text, uuid, integer) to authenticated;

-- O'quvchining o'z buyurtmasida ham buyurtmachi yoziladi
do $$
declare
  v_def text := pg_get_functiondef('market_buyurtma(uuid, integer)'::regprocedure);
begin
  v_def := replace(v_def, 'insert into woblr_redemptions (student_id, reward_id, ball, soni, kod, holat, mahsulot_nomi)',
                          'insert into woblr_redemptions (student_id, reward_id, ball, soni, kod, holat, mahsulot_nomi, buyurtmachi)');
  execute replace(v_def, 'v_m.nom);', 'v_m.nom, auth.uid());');
end $$;

-- ------------------------------------------------------------
-- 6. Admin: biriktirish / uzish
-- ------------------------------------------------------------
create or replace function ota_ona_biriktir(p_ota_ona uuid, p_student text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_eski uuid;
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Ota-ona biriktirish huquqingiz yo''q.';
  end if;
  if not exists (select 1 from profiles where id = p_ota_ona and rol = 'ota_ona') then
    raise exception 'Ota-ona hisobi topilmadi.';
  end if;
  select ota_ona_id into v_eski from students where id = p_student;
  if not found then raise exception 'O''quvchi topilmadi.'; end if;
  if v_eski = p_ota_ona then return; end if;
  if v_eski is not null then
    raise exception 'Bu o''quvchiga boshqa ota-ona biriktirilgan — avval uni uzing.';
  end if;

  update students set ota_ona_id = p_ota_ona where id = p_student;

  -- Ota-ona botga ulangan bo'lsa — yangi farzand bo'yicha ham xabar olsin
  insert into telegram_ulanish (chat_id, kim, student_id, tg_ism, holat)
  select distinct t.chat_id, 'ota_ona', p_student, t.tg_ism, 'faol'
    from telegram_ulanish t
   where t.kim = 'ota_ona' and t.holat = 'faol'
     and t.student_id in (select id from students where ota_ona_id = p_ota_ona and id <> p_student)
     and not exists (select 1 from telegram_ulanish x
                      where x.chat_id = t.chat_id and x.kim = 'ota_ona' and x.student_id = p_student and x.holat = 'faol');
end;
$$;
revoke execute on function ota_ona_biriktir(uuid, text) from public, anon;
grant  execute on function ota_ona_biriktir(uuid, text) to authenticated, service_role;

create or replace function ota_ona_uzish(p_student text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_admin() then
    raise exception 'Ota-onani uzish huquqingiz yo''q.';
  end if;
  update students set ota_ona_id = null where id = p_student;
  update profiles set oquvchi_id = null where oquvchi_id = p_student and rol = 'ota_ona';
  -- Bot ulanishi shu farzand bo'yicha uziladi (ulanish yozuvi — biznes ma'lumoti emas)
  delete from telegram_ulanish where kim = 'ota_ona' and student_id = p_student;
end;
$$;
revoke execute on function ota_ona_uzish(text) from public, anon;
grant  execute on function ota_ona_uzish(text) to authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Ustoz Telegram username + ota-onaga ustoz ma'lumoti
-- ------------------------------------------------------------
alter table teachers add column if not exists telegram_user text;
alter table teachers drop constraint if exists teachers_telegram_user_shakl;
alter table teachers add constraint teachers_telegram_user_shakl
  check (telegram_user is null or telegram_user ~ '^[A-Za-z][A-Za-z0-9_]{3,31}$');
comment on column teachers.telegram_user is 'Telegram username, @ siz (admin kiritadi). Bo''sh bo''lsa ota-onaga ko''rinmaydi (0116).';

create or replace function farzand_ustozi(p_teacher text)
returns table (ism text, telefon text, telegram_user text)
language sql stable security definer set search_path = public as $$
  select t.ism, t.telefon, t.telegram_user
    from teachers t
   where t.id = p_teacher
     and (app_is_staff()
          or exists (select 1 from enrollments e join groups g on g.id = e.group_id
                      where g.teacher_id = t.id and e.holat <> 'tugagan'
                        and (e.student_id = app_student_id() or app_farzandmi(e.student_id))))
$$;
revoke execute on function farzand_ustozi(text) from public, anon;
grant  execute on function farzand_ustozi(text) to authenticated;

-- ------------------------------------------------------------
-- 8. Oylik test natijalari — bitta farzand bo'yicha (ota-ona kabineti)
--    oylik_natijalarim() o'quvchi kabineti uchun qoladi.
-- ------------------------------------------------------------
create or replace function oylik_natijalari_farzand(p_student text)
returns table (davr text, guruh text, fan text, turi text, maks numeric, bolimlar jsonb, keldi boolean,
               ball numeric, bolim_ballar numeric[], foiz numeric, izoh text, orin bigint, jami bigint)
language sql stable security definer set search_path = public as $$
  with e as (
    select n.*, rank() over (partition by n.test_id order by n.foiz desc nulls last) as orin,
           count(n.foiz) over (partition by n.test_id) as jami
      from oylik_test_natijalar n
     where n.elon_qilingan
       and n.test_id in (select test_id from oylik_test_natijalar where student_id = p_student and elon_qilingan)
  )
  select t.davr, g.nom, s2.nom, t.turi, t.maks, t.bolimlar,
         e.keldi, e.ball, e.bolim_ballar, e.foiz, e.izoh,
         case when e.foiz is not null then e.orin end, e.jami
    from e
    join oylik_testlar t on t.id = e.test_id
    join groups g on g.id = t.group_id
    left join subjects s2 on s2.id = g.subject_id
   where e.student_id = p_student
     and (p_student = app_student_id() or app_farzandmi(p_student) or app_is_staff())
   order by t.davr desc, g.nom
$$;
revoke execute on function oylik_natijalari_farzand(text) from public, anon;
grant  execute on function oylik_natijalari_farzand(text) to authenticated;

-- ------------------------------------------------------------
-- 9. Profil qulfi (0032): ota-ona endi ISMINI o'zi to'g'rilaydi (Jamshid, 02.11).
--    Login (email) hamon faqat admin orqali; o'quvchi uchun o'zgarishsiz.
-- ------------------------------------------------------------
create or replace function profil_oquvchi_qulf() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.id
     and old.rol in ('oquvchi', 'ota_ona')
     and not app_is_admin()
     and ((old.rol = 'oquvchi' and new.ism is distinct from old.ism) or new.email is distinct from old.email) then
    raise exception 'Ism va loginni o''zingiz o''zgartira olmaysiz — markaz adminiga murojaat qiling.';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 10. Market: ota-ona farzandining olib ketilmagan buyurtmasini bekor qila oladi
-- ------------------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('market_bekor(text, text)'::regprocedure);
  v_eski text := 'v_b.student_id is distinct from app_student_id() then';
begin
  if position(v_eski in v_def) = 0 then raise exception '0116: market_bekor kutilgan ko''rinishda emas'; end if;
  execute replace(v_def, v_eski, 'v_b.student_id is distinct from app_student_id() and not app_farzandmi(v_b.student_id) then');
end $$;
