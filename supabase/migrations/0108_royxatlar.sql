-- ============================================================
--  0108 — Sozlanadigan ro'yxatlar (Jamshid, 31.10)
-- ============================================================
--  Lid manbasi, xarajat toifasi, ketish sababi, woblar sababi endi kodda emas,
--  bazada: admin/direktor/manager Sozlamalar → Ro'yxatlar da qo'shadi, nomini
--  o'zgartiradi, yashiradi. Yozuvlar kalitni saqlaydi, shuning uchun nom
--  o'zgarsa eski yozuvlar ham yangi nom bilan ko'rinadi.
--    · o'chirish yo'q — yashirilgan variant eski yozuvlarda ko'rinib turadi;
--    · tizim = true — kod/baza shu kalitni ishlatadi (maosh, sayt, boshqa,
--      faollik): nomi o'zgaradi, lekin yashirilmaydi;
--    · enum va check o'rniga trigger: yangi qiymat ro'yxatdagi faol variant
--      bo'lishi kerak, eski qiymat o'zgarmasa tekshirilmaydi.
-- ============================================================

create table if not exists royxatlar (
  tur        text not null check (tur in ('lid_manba', 'xarajat_toifa', 'ketish_sabab', 'woblar_sabab')),
  kalit      text not null check (kalit ~ '^[a-z0-9_]+$'),
  nom        text not null check (length(btrim(nom)) between 1 and 60),
  tartib     int  not null default 100,
  faol       boolean not null default true,
  tizim      boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tur, kalit)
);

create unique index if not exists royxatlar_nom_uq on royxatlar (tur, lower(btrim(nom)));

comment on table royxatlar is 'Sozlanadigan ro''yxatlar (0108): lid manbasi, xarajat toifasi, ketish va woblar sababi.';

insert into royxatlar (tur, kalit, nom, tartib, tizim) values
  ('lid_manba', 'sayt', 'Sayt', 10, true),
  ('lid_manba', 'telegram', 'Telegram', 20, false),
  ('lid_manba', 'instagram', 'Instagram', 30, false),
  ('lid_manba', 'tavsiya', 'Tanishlar tavsiyasi', 40, false),
  ('lid_manba', 'boshqa', 'Boshqa', 1000, true),
  ('xarajat_toifa', 'ijara', 'Ijara', 10, false),
  ('xarajat_toifa', 'maosh', 'Maosh', 20, true),
  ('xarajat_toifa', 'kommunal', 'Kommunal', 30, false),
  ('xarajat_toifa', 'reklama', 'Reklama', 40, false),
  ('xarajat_toifa', 'jihoz', 'Jihoz', 50, false),
  ('xarajat_toifa', 'ofis', 'Ofis va kanstovar', 60, false),
  ('xarajat_toifa', 'soliq', 'Soliq', 70, false),
  ('xarajat_toifa', 'boshqa', 'Boshqa', 1000, true),
  ('ketish_sabab', 'narx', 'Narx qimmat', 10, false),
  ('ketish_sabab', 'ustoz', 'Ustoz yoqmadi', 20, false),
  ('ketish_sabab', 'vaqt', 'Vaqt to‘g‘ri kelmadi', 30, false),
  ('ketish_sabab', 'kochdi', 'Ko‘chib ketdi', 40, false),
  ('ketish_sabab', 'natija', 'Natija yo‘q', 50, false),
  ('ketish_sabab', 'boshqa_markaz', 'Boshqa markazga o‘tdi', 60, false),
  ('ketish_sabab', 'boshqa', 'Boshqa', 1000, true),
  ('woblar_sabab', 'faollik', 'Faollik', 10, true),
  ('woblar_sabab', 'uy_vazifasi', 'Uy vazifasi', 20, false),
  ('woblar_sabab', 'yordam', 'Yordam berdi', 30, false),
  ('woblar_sabab', 'qoida', 'Qoida buzdi', 40, false),
  ('woblar_sabab', 'boshqa', 'Boshqa', 1000, true)
on conflict (tur, kalit) do nothing;

alter table royxatlar enable row level security;
alter table royxatlar force row level security;

drop policy if exists royxatlar_oqish on royxatlar;
create policy royxatlar_oqish on royxatlar for select to authenticated using (true);

drop policy if exists royxatlar_admin on royxatlar;
create policy royxatlar_admin on royxatlar for all to authenticated
  using (app_is_admin()) with check (app_is_admin());

grant select, insert, update on royxatlar to authenticated;

/* Tizim varianti yashirilmaydi, kaliti va turi o'zgarmaydi */
create or replace function royxat_qoidasi() returns trigger
language plpgsql as $$
begin
  new.nom := btrim(new.nom);
  if new.tur <> old.tur or new.kalit <> old.kalit or new.tizim <> old.tizim then
    raise exception 'Ro''yxat kalitini o''zgartirib bo''lmaydi.';
  end if;
  if old.tizim and not new.faol then
    raise exception '"%" tizimda ishlatiladi, uni yashirib bo''lmaydi. Nomini o''zgartirsa bo''ladi.', old.nom;
  end if;
  return new;
end;
$$;

drop trigger if exists royxat_qoidasi on royxatlar;
create trigger royxat_qoidasi before update on royxatlar
  for each row execute function royxat_qoidasi();

/* Yozuvdagi qiymat: TG_ARGV[0] — ro'yxat turi, TG_ARGV[1] — ustun */
create or replace function royxat_qiymati_tekshir() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_yangi text := to_jsonb(new) ->> tg_argv[1];
begin
  if v_yangi is null then return new; end if;
  if tg_op = 'UPDATE' and v_yangi is not distinct from (to_jsonb(old) ->> tg_argv[1]) then return new; end if;
  if not exists (select 1 from royxatlar where tur = tg_argv[0] and kalit = v_yangi and faol) then
    raise exception 'Bu variant ro''yxatda yo''q yoki yashirilgan: %', v_yangi;
  end if;
  return new;
end;
$$;

drop function if exists woblr_tarix(date, date, uuid, text, text, int);

alter table leads alter column manba drop default;
alter table leads alter column manba type text using manba::text;
alter table leads alter column manba set default 'sayt';

alter table woblr alter column sabab drop default;
alter table woblr alter column sabab type text using sabab::text;
alter table woblr alter column sabab set default 'faollik';

alter table probniy_woblar alter column sabab drop default;
alter table probniy_woblar alter column sabab type text using sabab::text;
alter table probniy_woblar alter column sabab set default 'faollik';

drop type lead_source;
drop type woblr_reason;

alter table xarajatlar drop constraint if exists xarajatlar_toifa_check;
alter table students drop constraint if exists students_ketish_sababi_check;

drop trigger if exists royxat_lid_manba on leads;
create trigger royxat_lid_manba before insert or update on leads
  for each row execute function royxat_qiymati_tekshir('lid_manba', 'manba');

drop trigger if exists royxat_woblar on woblr;
create trigger royxat_woblar before insert or update on woblr
  for each row execute function royxat_qiymati_tekshir('woblar_sabab', 'sabab');

drop trigger if exists royxat_probniy_woblar on probniy_woblar;
create trigger royxat_probniy_woblar before insert or update on probniy_woblar
  for each row execute function royxat_qiymati_tekshir('woblar_sabab', 'sabab');

drop trigger if exists royxat_xarajat on xarajatlar;
create trigger royxat_xarajat before insert or update on xarajatlar
  for each row execute function royxat_qiymati_tekshir('xarajat_toifa', 'toifa');

drop trigger if exists royxat_ketish on students;
create trigger royxat_ketish before insert or update on students
  for each row execute function royxat_qiymati_tekshir('ketish_sabab', 'ketish_sababi');

create or replace function ketish_sababi_belgila(p_student text, p_turi text, p_izoh text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not app_is_staff() then
    raise exception 'Huquqingiz yo''q.';
  end if;
  if p_turi is null then
    raise exception 'Sababni tanlang.';
  end if;
  if p_turi = 'boshqa' and length(trim(coalesce(p_izoh, ''))) = 0 then
    raise exception '"Boshqa" tanlansa, sababini yozing.';
  end if;
  update students
     set ketish_sababi = p_turi,
         arxiv_sabab = coalesce(nullif(trim(p_izoh), ''), arxiv_sabab)
   where id = p_student and holat = 'ketgan';
  if not found then
    raise exception 'O''quvchi arxivda emas.';
  end if;
end;
$$;

/* sabab endi text (0108) */
create or replace function woblr_tarix(p_dan date DEFAULT NULL::date, p_gacha date DEFAULT NULL::date, p_bergan uuid DEFAULT NULL::uuid, p_student text DEFAULT NULL::text, p_group text DEFAULT NULL::text, p_limit integer DEFAULT 500)
 RETURNS TABLE(id bigint, vaqt timestamp with time zone, dars_sana date, student_id text, fish text, group_id text, guruh text, fan text, bergan_profile uuid, bergan text, ball integer, sabab text, izoh text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

#variable_conflict use_column

declare

  v_staff   boolean := auth.uid() is null or app_is_staff();

  v_ustoz   text := app_teacher_id();

  v_oquvchi text := coalesce(app_student_id(), app_farzand_id());

begin

  if not v_staff and v_ustoz is null and v_oquvchi is null then

    raise exception 'Woblar tarixini ko''rish huquqingiz yo''q.';

  end if;



  return query

  select w.id::bigint, w.created_at, l.sana, w.student_id, s.fish, w.group_id, g.nom, sb.nom,

         w.bergan_profile, coalesce(t.ism, p.ism, 'Admin'), w.ball::int, w.sabab, w.izoh

  from woblr w

  join students s on s.id = w.student_id

  left join lessons l on l.id = w.lesson_id

  left join groups g on g.id = w.group_id

  left join subjects sb on sb.id = g.subject_id

  left join profiles p on p.id = w.bergan_profile

  left join teachers t on t.profile_id = w.bergan_profile

  where (

      v_staff

      or (v_ustoz is not null and w.bergan_profile = auth.uid())

      or (v_ustoz is null and w.student_id = v_oquvchi)

    )

    and (p_dan is null or (w.created_at at time zone 'Asia/Tashkent')::date >= p_dan)

    and (p_gacha is null or (w.created_at at time zone 'Asia/Tashkent')::date <= p_gacha)

    and (p_bergan is null or w.bergan_profile = p_bergan)

    and (p_student is null or w.student_id = p_student)

    and (p_group is null or w.group_id = p_group)

  order by w.created_at desc

  limit least(greatest(coalesce(p_limit, 500), 1), 2000);

end;

$function$;

revoke all on function woblr_tarix(date, date, uuid, text, text, int) from public, anon;
grant execute on function woblr_tarix(date, date, uuid, text, text, int) to authenticated;
