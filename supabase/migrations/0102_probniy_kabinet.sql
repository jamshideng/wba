-- ============================================================
--  0102 — PROBNIY KABINETI, 1-bosqich (Jamshid, 25.10)
-- ============================================================
--  Lid "Sinov darsi" bosqichida bo'lsa, admin unga kabinet ochadi
--  (login-parol; keyin bot orqali ham). Kabinetda: guruh va ustoz,
--  keyingi darslar, probniy davomati, woblar, "Guruhga yozilmoqchiman".
--  Narx ko'rsatilmaydi. Bola va ota-ona — bitta kabinet.
--    · profiles.rol = 'probniy', profiles.lead_id — qaysi lid;
--    · hamma ma'lumot BITTA definer funksiyadan (probniy_kabinet) — probniy
--      jadvallarni to'g'ridan-to'g'ri o'qimaydi, boshqa hech kimni ko'rmaydi;
--    · kabinet "Sinov darsi" bosqichi tugaguncha ochiq: o'quvchi bo'lsa —
--      hisob o'quvchi kabinetiga aylanadi; "Yo'qotildi" ga tushsa — 7 kundan
--      keyin yopiladi.
--  Eslatma: yangi enum qiymati shu tranzaksiyada ishlatilmaydi —
--  shuning uchun solishtirish rol::text bilan.
-- ============================================================

alter type user_role add value if not exists 'probniy';

alter table profiles add column if not exists lead_id uuid references leads (id) on delete set null;
create index if not exists profiles_lead_idx on profiles (lead_id) where lead_id is not null;
comment on column profiles.lead_id is 'Probniy kabineti bog''langan lid (faqat rol=probniy uchun, 0102).';

create or replace function app_lead_id() returns uuid
language sql stable security definer set search_path = public as $$
  select lead_id from profiles where id = auth.uid() and rol::text = 'probniy' and holat = 'faol'
$$;
revoke execute on function app_lead_id() from public, anon;
grant execute on function app_lead_id() to authenticated;

/* Kabinet ma'lumoti — faqat o'z lidi */
create or replace function probniy_kabinet() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l       leads%rowtype;
  g       groups%rowtype;
  v_holat text;
  v_bugun date := bugun_toshkent();
begin
  select * into l from leads where id = app_lead_id();
  if not found then
    return null;
  end if;

  v_holat := case
    when l.student_id is not null or l.holat = 'yozildi' then 'oquvchi'
    when l.holat in ('rad', 'kelmadi') then
      case when l.updated_at < now() - interval '7 days' then 'yopiq' else 'yoqotildi' end
    when lid_sinovdami(l) then 'sinov'
    else 'kutilmoqda'
  end;

  select * into g from groups where id = l.group_id;

  return jsonb_build_object(
    'holat', v_holat,
    'ism', l.ism,
    'sinov_sana', l.sinov_sana,
    'yozilmoqchi', 'yozilmoqchi' = any (coalesce(l.teglar, '{}')),
    'guruh', case when g.id is null then null else jsonb_build_object(
      'nom', g.nom, 'boshlanish', g.boshlanish, 'tugash', g.tugash, 'kunlar', g.kunlar,
      'fan', (select s.nom from subjects s where s.id = g.subject_id),
      'ustoz', (select t.ism from teachers t where t.id = g.teacher_id)) end,
    -- Keyingi 14 kundagi dars kunlari (ko'chirishlar hisobga olingan)
    'darslar', case when g.id is null or v_holat <> 'sinov' then '[]'::jsonb else coalesce((
      select jsonb_agg(k::date order by k)
      from generate_series(v_bugun, v_bugun + 14, interval '1 day') k
      where guruh_dars_kuni(g.id, k::date)), '[]'::jsonb) end,
    'davomat', coalesce((
      select jsonb_agg(jsonb_build_object('sana', ls.sana, 'holat', pd.holat) order by ls.sana)
      from probniy_davomat pd join lessons ls on ls.id = pd.lesson_id
      where pd.lead_id = l.id), '[]'::jsonb),
    'woblar', coalesce((select sum(w.ball) from probniy_woblar w where w.lead_id = l.id), 0)
  );
end;
$$;
revoke execute on function probniy_kabinet() from public, anon;
grant execute on function probniy_kabinet() to authenticated;

/* "Guruhga yozilmoqchiman" — lidga belgi va bugungi aloqa; xodimga xabar (server action) */
create or replace function probniy_yozilmoqchi() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l leads%rowtype;
begin
  select * into l from leads where id = app_lead_id() for update;
  if not found or not lid_sinovdami(l) then
    raise exception 'Kabinet faol emas.';
  end if;
  if not ('yozilmoqchi' = any (coalesce(l.teglar, '{}'))) then
    update leads
       set teglar = array_append(coalesce(teglar, '{}'), 'yozilmoqchi'),
           keyingi_aloqa = now()
     where id = l.id;
  end if;
  return jsonb_build_object('ism', l.ism, 'telefon', l.telefon,
                            'guruh', (select nom from groups where id = l.group_id));
end;
$$;
revoke execute on function probniy_yozilmoqchi() from public, anon;
grant execute on function probniy_yozilmoqchi() to authenticated;

/* Lid o'quvchi bo'lsa — probniy hisobi o'quvchi hisobiga aylanadi (login o'sha) */
create or replace function leads_probniy_oquvchiga() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid;
begin
  if new.student_id is null or old.student_id is not distinct from new.student_id then
    return new;
  end if;
  select id into v_pid from profiles where lead_id = new.id and rol::text = 'probniy' limit 1;
  if v_pid is null then
    return new;
  end if;
  update profiles set rol = 'oquvchi', lead_id = null where id = v_pid;
  update students set profile_id = v_pid where id = new.student_id and profile_id is null;
  return new;
end;
$$;

drop trigger if exists leads_probniy_oquvchiga on leads;
create trigger leads_probniy_oquvchiga after update on leads
  for each row execute function leads_probniy_oquvchiga();
