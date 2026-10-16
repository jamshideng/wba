-- ============================================================
--  0073 — Probniyga ham woblar (Jamshid, 16.10)
-- ============================================================
--  Sinov darsidagi bola hali o'quvchi emas (student_id yo'q), shuning
--  uchun woblari alohida jadvalda — lid'ga bog'langan:
--    * ustoz davomat jurnalidan beradi; guruhning oylik limitidan ketadi;
--    * doimiy o'quvchiga o'tsa (probniy_doimiy) — davomat bilan birga
--      woblar tarixi ham o'quvchining woblr yozuvlariga ko'chadi
--      (asl sana, ustoz, guruh saqlanadi);
--    * yo'qotilsa (kelmadi / rad) — woblar lid bilan arxivda qoladi,
--      reyting va marketga kirmaydi.
-- ============================================================

create table if not exists probniy_woblar (
  id             bigserial primary key,
  lead_id        uuid not null references leads (id) on delete cascade,
  lesson_id      uuid references lessons (id) on delete set null,
  group_id       text references groups (id) on delete set null,
  teacher_id     text references teachers (id) on delete set null,
  bergan_profile uuid references profiles (id) on delete set null,
  ball           int not null check (ball <> 0 and ball between -100000 and 100000),
  sabab          woblr_reason not null default 'faollik',
  created_at     timestamptz not null default now()
);

create index if not exists probniy_woblar_lead_idx  on probniy_woblar (lead_id);
create index if not exists probniy_woblar_group_idx on probniy_woblar (group_id, created_at);

comment on table probniy_woblar is
  'Sinov darsidagi (hali o''quvchi bo''lmagan) bolaga berilgan woblar. Doimiy bo''lganda woblr ga ko''chadi (0073).';

-- Yozish faqat funksiyalar orqali; o'qish — xodim
alter table probniy_woblar enable row level security;
drop policy if exists probniy_woblar_staff_read on probniy_woblar;
create policy probniy_woblar_staff_read on probniy_woblar for select to authenticated
  using (app_is_staff());
grant select on probniy_woblar to authenticated;

drop trigger if exists probniy_woblar_audit on probniy_woblar;
create trigger probniy_woblar_audit after insert or update or delete on probniy_woblar
  for each row execute function audit_trigger();


/* Ustoz sarfi: o'quvchilarga + probniylarga bergani (sof) */
create or replace function guruh_woblar_sarfi(p_group text, p_davr text)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(x.ball), 0)::int
  from (
    select w.ball, w.group_id, w.bergan_profile, w.created_at from woblr w
    union all
    select p.ball, p.group_id, p.bergan_profile, p.created_at from probniy_woblar p
  ) x
  join groups g   on g.id = x.group_id
  join teachers t on t.id = g.teacher_id
  where x.group_id = p_group
    and x.bergan_profile = t.profile_id   -- admin shu guruhga bergani ustoz limitidan ketmaydi
    and to_char(x.created_at at time zone 'Asia/Tashkent', 'YYYY-MM') = p_davr
$$;


/*
 * Davomat jurnalidan probniyga woblar. Qaytaradi — bugungi jami.
 * Huquq va limit woblar_ber (0064) bilan bir xil.
 */
create or replace function probniy_woblar_ber(p_group text, p_lead uuid, p_ball int)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_dars  uuid;
  v_ustoz text;
  v_bugun date := bugun_toshkent();
  v_davr  text := to_char(bugun_toshkent(), 'YYYY-MM');
  v_limit int;
  v_sarf  int;
  v_jami  int;
begin
  if auth.uid() is not null and not (app_teaches_group(p_group) or app_is_admin()) then
    raise exception 'Bu guruhda woblar berish huquqingiz yo''q.';
  end if;
  if p_ball is null or p_ball = 0 then
    raise exception 'Woblar 0 bo''lmasin.';
  end if;
  if not exists (
    select 1 from leads
    where id = p_lead and group_id = p_group and student_id is null
      and holat in ('yangi', 'qongiroq', 'keldi')
  ) then
    raise exception 'Probniy bu guruhda emas.';
  end if;

  select teacher_id into v_ustoz from groups where id = p_group;
  select id into v_dars from lessons where group_id = p_group and sana = v_bugun;
  if v_dars is null then
    if not exists (select 1 from groups where id = p_group and guruh_dars_kunimi(kunlar, v_bugun)) then
      raise exception 'Bugun bu guruhning dars kuni emas.';
    end if;
    insert into lessons (group_id, sana) values (p_group, v_bugun)
    on conflict (group_id, sana) do nothing;
    select id into v_dars from lessons where group_id = p_group and sana = v_bugun;
  end if;

  -- Ustozga oylik limit (admin — limitsiz)
  if auth.uid() is not null and not app_is_admin() and p_ball > 0 then
    perform pg_advisory_xact_lock(hashtext('woblr-limit:' || p_group || ':' || v_davr));
    v_limit := guruh_woblar_limiti(p_group, v_davr);
    v_sarf  := guruh_woblar_sarfi(p_group, v_davr);
    if v_sarf + p_ball > v_limit then
      raise exception 'Oylik limit: bu guruh uchun % woblar qoldi (limit %, berilgan %).',
        greatest(v_limit - v_sarf, 0), v_limit, v_sarf;
    end if;
  end if;

  insert into probniy_woblar (lead_id, lesson_id, group_id, teacher_id, bergan_profile, ball)
  values (p_lead, v_dars, p_group, v_ustoz, auth.uid(), p_ball);

  select coalesce(sum(ball), 0)::int into v_jami
  from probniy_woblar where lesson_id = v_dars and lead_id = p_lead;
  return v_jami;
end;
$$;

revoke execute on function probniy_woblar_ber(text, uuid, int) from public, anon;
grant execute on function probniy_woblar_ber(text, uuid, int) to authenticated, service_role;


/* Jurnal uchun: guruhdagi probniylarning bugungi va jami woblari (ustoz ham ko'radi) */
create or replace function jurnal_probniy_woblar(p_group text, p_sana date)
returns table (lead_id uuid, bugun int, jami int)
language sql stable security definer set search_path = public as $$
  select p.lead_id,
         coalesce(sum(p.ball) filter (where l.sana = p_sana), 0)::int,
         sum(p.ball)::int
  from probniy_woblar p
  join leads ld on ld.id = p.lead_id
  left join lessons l on l.id = p.lesson_id
  where ld.group_id = p_group and ld.student_id is null
    and (app_is_staff() or app_teaches_group(p_group) or auth.uid() is null)
  group by p.lead_id
$$;

revoke execute on function jurnal_probniy_woblar(text, date) from public, anon;
grant execute on function jurnal_probniy_woblar(text, date) to authenticated, service_role;


/* Limit triggeri: doimiyga ko'chirishda (wba.woblr_kochir) tekshirilmaydi — woblar avval berilgan */
create or replace function woblr_guruh_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_davr  text;
  v_limit int;
  v_sarf  int;
begin
  -- 1) Guruh: darsdan → bo'lmasa o'quvchining shu ustozdagi faol guruhi
  if new.group_id is null and new.lesson_id is not null then
    select group_id into new.group_id from lessons where id = new.lesson_id;
  end if;
  if new.group_id is null and new.teacher_id is not null then
    select e.group_id into new.group_id
    from enrollments e join groups g on g.id = e.group_id
    where e.student_id = new.student_id and g.teacher_id = new.teacher_id and e.holat <> 'tugagan'
    order by g.nom limit 1;
  end if;

  if coalesce(current_setting('wba.woblr_kochir', true), '') = '1' then
    return new;
  end if;

  -- 2) Limit — faqat ustoz (sessiya bilan, admin emas) va faqat yangi yozuvda
  if tg_op = 'INSERT' and auth.uid() is not null and not app_is_admin() then
    if new.group_id is null or not exists (
      select 1 from enrollments e join groups g on g.id = e.group_id
      where e.group_id = new.group_id and e.student_id = new.student_id and e.holat <> 'tugagan'
        and g.teacher_id = app_teacher_id()
    ) then
      raise exception 'O''quvchi sizning guruhingizda topilmadi.';
    end if;
    if new.ball > 0 then
      v_davr := to_char(bugun_toshkent(), 'YYYY-MM');
      perform pg_advisory_xact_lock(hashtext('woblr-limit:' || new.group_id || ':' || v_davr));
      v_limit := guruh_woblar_limiti(new.group_id, v_davr);
      v_sarf  := guruh_woblar_sarfi(new.group_id, v_davr);
      if v_sarf + new.ball > v_limit then
        raise exception 'Oylik limit: bu guruh uchun % woblar qoldi (limit %, berilgan %).',
          greatest(v_limit - v_sarf, 0), v_limit, v_sarf;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function woblr_guruh_limit() from public, anon, authenticated;


/* Darhol xabar: ko'chirilgan eski woblar uchun yangi xabar chiqmaydi */
create or replace function woblr_xabar_yangila() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kun  date := (new.created_at at time zone 'Asia/Tashkent')::date;
  v_m    record;
  v_bid  bigint;
begin
  if coalesce(current_setting('wba.woblr_kochir', true), '') = '1' then
    return null;
  end if;

  select * into v_m from woblr_kunlik_matn(new.student_id, v_kun);

  select x.bildirishnoma_id into v_bid
  from woblr_xabar x
  join bildirishnomalar b on b.id = x.bildirishnoma_id
  where x.student_id = new.student_id and x.kun = v_kun;

  if v_bid is not null then
    update bildirishnomalar
       set sarlavha = v_m.sarlavha, matn = v_m.matn,
           tugash = greatest(tugash, now() + interval '2 days'), holat = 'faol'
     where id = v_bid;
    -- Yopgan bo'lsa ham — yangilangan xabar qayta chiqsin
    delete from bildirishnoma_holat where bildirishnoma_id = v_bid;
  else
    insert into bildirishnomalar (turi, sarlavha, matn, havola, havola_matn, kimga, filtr, tugash, yaratdi, manba)
    values ('eslatma', v_m.sarlavha, v_m.matn, '/crm/woblr/tarix', 'Woblar tarixi',
            array['oquvchi', 'ota_ona'], jsonb_build_object('oquvchi', new.student_id),
            now() + interval '2 days', new.bergan_profile, 'woblar')
    returning id into v_bid;

    insert into woblr_xabar (student_id, kun, bildirishnoma_id)
    values (new.student_id, v_kun, v_bid)
    on conflict (student_id, kun) do update set bildirishnoma_id = excluded.bildirishnoma_id;
  end if;

  return null;
end;
$$;


/* Doimiy qilish: davomat + woblar tarixi o'quvchiga ko'chadi */
create or replace function probniy_doimiy(p_lead uuid, p_boshlandi date default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_lead leads%rowtype;
  v_id   text;
begin
  if not app_is_staff() then
    raise exception 'Probniyni o''quvchi qilish huquqingiz yo''q.';
  end if;

  select * into v_lead from leads where id = p_lead for update;
  if not found then
    raise exception 'Probniy topilmadi.';
  end if;
  if v_lead.student_id is not null then
    raise exception 'Bu probniy allaqachon o''quvchi qilingan (%).', v_lead.student_id;
  end if;
  if v_lead.group_id is null then
    raise exception 'Guruh tanlanmagan — avval guruhni belgilang.';
  end if;

  v_id := oquvchi_qosh(jsonb_build_object(
    'fish',          v_lead.ism,
    'shaxsiy_tel',   v_lead.telefon,
    'tugilgan_sana', v_lead.tugilgan_sana,
    'group_id',      v_lead.group_id,
    'boshlandi',     coalesce(p_boshlandi, bugun_toshkent()),
    'izoh',          nullif(concat_ws(' · ', 'Probniydan', v_lead.izoh), 'Probniydan')
  ));

  -- Probniy kunlaridagi davomat o'quvchining tarixiga (pul emas — faqat davomat)
  insert into attendance (lesson_id, student_id, holat, belgiladi)
  select pd.lesson_id, v_id, pd.holat, pd.belgiladi
  from probniy_davomat pd
  where pd.lead_id = p_lead
  on conflict (lesson_id, student_id) do nothing;

  -- Woblar tarixi — asl sana, ustoz va guruh bilan (limit va xabar qayta ishlamaydi)
  perform set_config('wba.woblr_kochir', '1', true);
  insert into woblr (student_id, lesson_id, teacher_id, bergan_profile, ball, sabab, izoh, group_id, created_at)
  select v_id, p.lesson_id, p.teacher_id, p.bergan_profile, p.ball, p.sabab, 'Probniy davrida', p.group_id, p.created_at
  from probniy_woblar p
  where p.lead_id = p_lead
  order by p.id;
  delete from probniy_woblar where lead_id = p_lead;
  perform set_config('wba.woblr_kochir', '', true);

  update leads set holat = 'yozildi', student_id = v_id where id = p_lead;
  return v_id;
end;
$$;
