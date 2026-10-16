-- ============================================================
--  0071 — WOBLAR: O'QUVCHIGA DARHOL XABAR + WOBLAR TARIXI (Jamshid, 16.10)
--
--  1) Woblar berilishi bilan o'quvchi (va ota-onasi) xabar oladi:
--     saytda bildirishnoma, telefonda push (PWA), Telegram'da (ulangan
--     bo'lsa). Bir kunda bir necha marta berilsa ham XABAR BITTA —
--     u yangilanadi: "Bugun +5 woblar oldingiz" (bildirishnoma qayta
--     chiqadi, push shu teg bilan almashadi, Telegram xabari tahrirlanadi).
--
--     • woblr_xabar — (o'quvchi, kun) → bildirishnoma va Telegram xabarlari.
--     • Trigger (woblr insert) bildirishnomani yozadi/yangilaydi — qaysi
--       yo'l bilan berilganidan qat'i nazar (davomat, Woblar sahifasi, admin).
--     • woblr_xabar_manzil — push obunalari va Telegram chatlari; faqat
--       shu bolaga woblar bera oladigan odam (admin yoki uning ustozi)
--       chaqira oladi. service_role kerak emas.
--
--  2) woblr_tarix — kim, kimga, qaysi dars/guruhda, nechta, nima uchun:
--       • o'quvchi / ota-ona — faqat o'ziniki;
--       • ustoz — faqat O'ZI bergan woblar;
--       • admin / direktor / qabulxona — hammasi (filtrlar bilan).
--
--  bildirishnomalar.manba = 'woblar' — avtomatik xabarlar admin
--  ro'yxatini to'ldirib yubormasin (u yerda faqat qo'lda yozilganlar).
-- ============================================================

alter table bildirishnomalar add column if not exists manba text;
comment on column bildirishnomalar.manba is 'null — admin yozgan; ''woblar'' — woblar berilganda avtomatik (0071).';

create table if not exists woblr_xabar (
  student_id       text not null references students (id) on delete cascade,
  kun              date not null,
  bildirishnoma_id bigint references bildirishnomalar (id) on delete set null,
  tg               jsonb not null default '[]'::jsonb,   -- [{"chat": 123, "msg": 456}]
  primary key (student_id, kun)
);
comment on table woblr_xabar is 'Bir bolaga bir kunda bitta woblar xabari: bildirishnoma va Telegram xabar ID''lari (0071).';

-- Siyosat yo'q: faqat quyidagi security definer funksiyalar orqali
alter table woblr_xabar enable row level security;

/* Bugungi woblar matni: sarlavha, qatorlar (fan/guruh · kim berdi: ±N), balans */
create or replace function woblr_kunlik_matn(p_student text, p_kun date)
returns table (sarlavha text, matn text, jami int)
language sql stable security definer set search_path = public as $$
  with bugun as (
    select coalesce(sb.nom, g.nom, 'Woblar') as fan,
           coalesce(t.ism, p.ism, 'Admin') as kim,
           sum(w.ball)::int as ball
    from woblr w
    left join groups g on g.id = w.group_id
    left join subjects sb on sb.id = g.subject_id
    left join profiles p on p.id = w.bergan_profile
    left join teachers t on t.profile_id = w.bergan_profile
    where w.student_id = p_student
      and (w.created_at at time zone 'Asia/Tashkent')::date = p_kun
    group by 1, 2
  ),
  j as (select coalesce(sum(ball), 0)::int as jami from bugun),
  balans as (
    select (coalesce((select sum(ball) from woblr where student_id = p_student), 0)
          - coalesce((select sum(ball) from woblr_redemptions where student_id = p_student and holat <> 'bekor'), 0))::int as b
  )
  select
    case when j.jami >= 0 then 'Bugun +' || j.jami || ' woblar oldingiz'
         else 'Bugun ' || j.jami || ' woblar' end,
    coalesce((select string_agg(fan || ' · ' || kim || ': ' || case when ball > 0 then '+' else '' end || ball, E'\n' order by fan, kim) from bugun), '')
      || E'\nBalans: ' || (select b from balans) || ' W',
    j.jami
  from j;
$$;

create or replace function woblr_xabar_yangila() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kun  date := (new.created_at at time zone 'Asia/Tashkent')::date;
  v_m    record;
  v_bid  bigint;
begin
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

drop trigger if exists woblr_xabar on woblr;
create trigger woblr_xabar after insert on woblr
  for each row execute function woblr_xabar_yangila();

/* Shu bolaga woblar bera oladiganmi (admin yoki uning ustozi) */
create or replace function woblr_xabar_huquq(p_student text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null or app_is_admin() or app_teaches_student(p_student);
$$;

/* Push va Telegram uchun: matn, obunalar, chatlar (oldingi xabar ID'si bilan) */
create or replace function woblr_xabar_manzil(p_student text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_kun date := bugun_toshkent();
  v_m   record;
  v_x   woblr_xabar;
  v_b   bildirishnomalar;
begin
  if not woblr_xabar_huquq(p_student) then
    raise exception 'Bu o''quvchiga xabar yuborish huquqingiz yo''q.';
  end if;

  select * into v_x from woblr_xabar where student_id = p_student and kun = v_kun;
  if v_x.student_id is null then return null; end if;
  select * into v_b from bildirishnomalar where id = v_x.bildirishnoma_id;
  select * into v_m from woblr_kunlik_matn(p_student, v_kun);

  return jsonb_build_object(
    'sarlavha', v_m.sarlavha,
    'matn', v_m.matn,
    'push', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', o.endpoint, 'p256dh', o.p256dh, 'auth', o.auth))
      from push_obunalar o
      where v_b.id is not null and bildirishnoma_profilga(o.profile_id, v_b.kimga, v_b.filtr)
    ), '[]'::jsonb),
    'tg', coalesce((
      select jsonb_agg(jsonb_build_object(
        'chat', u.chat_id,
        'msg', (select (e ->> 'msg')::bigint from jsonb_array_elements(v_x.tg) e where (e ->> 'chat')::bigint = u.chat_id limit 1)))
      from (select distinct chat_id from telegram_ulanish
            where student_id = p_student and kim in ('oquvchi', 'ota_ona') and holat = 'faol') u
    ), '[]'::jsonb)
  );
end;
$$;

/* Yuborilgan Telegram xabari ID'si — keyingi safar tahrirlash uchun */
create or replace function woblr_xabar_tg_saqla(p_student text, p_chat bigint, p_msg bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not woblr_xabar_huquq(p_student) then
    raise exception 'Huquq yo''q.';
  end if;
  update woblr_xabar
     set tg = (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(tg) e where (e ->> 'chat')::bigint <> p_chat)
              || jsonb_build_array(jsonb_build_object('chat', p_chat, 'msg', p_msg))
   where student_id = p_student and kun = bugun_toshkent();
end;
$$;

/* Eskirgan push obunasi (qurilma 404/410) — woblar yuborgan ustoz ham o'chira olsin */
create or replace function woblr_push_eskirgan(p_student text, p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not woblr_xabar_huquq(p_student) then return; end if;
  delete from push_obunalar o
  where o.endpoint = p_endpoint
    and exists (select 1 from bildirishnomalar b join woblr_xabar x on x.bildirishnoma_id = b.id
                where x.student_id = p_student and bildirishnoma_profilga(o.profile_id, b.kimga, b.filtr));
end;
$$;

revoke all on function woblr_kunlik_matn(text, date) from public, anon;
revoke all on function woblr_xabar_manzil(text) from public, anon;
revoke all on function woblr_xabar_tg_saqla(text, bigint, bigint) from public, anon;
revoke all on function woblr_push_eskirgan(text, text) from public, anon;
grant execute on function woblr_xabar_manzil(text) to authenticated;
grant execute on function woblr_xabar_tg_saqla(text, bigint, bigint) to authenticated;
grant execute on function woblr_push_eskirgan(text, text) to authenticated;

-- ------------------------------------------------------------
--  Woblar tarixi
-- ------------------------------------------------------------
create or replace function woblr_tarix(
  p_dan     date default null,
  p_gacha   date default null,
  p_bergan  uuid default null,
  p_student text default null,
  p_group   text default null,
  p_limit   int  default 500
) returns table (
  id            bigint,
  vaqt          timestamptz,
  dars_sana     date,
  student_id    text,
  fish          text,
  group_id      text,
  guruh         text,
  fan           text,
  bergan_profile uuid,
  bergan        text,
  ball          int,
  sabab         woblr_reason,
  izoh          text
)
language plpgsql stable security definer set search_path = public as $$
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
$$;

revoke all on function woblr_tarix(date, date, uuid, text, text, int) from public, anon;
grant execute on function woblr_tarix(date, date, uuid, text, text, int) to authenticated;

comment on function woblr_tarix is
  'Woblar tarixi (0071): xodim — hammasi; ustoz — o''zi bergan; o''quvchi/ota-ona — o''ziniki.';
