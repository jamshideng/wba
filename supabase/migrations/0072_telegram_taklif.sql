-- ============================================================
--  0072 — TELEGRAM BOTGA ULASH: ADMIN TAKLIF HAVOLASI (Jamshid, 16.10)
--
--  Botga hozir oz odam ulangan (14). Ulanishning ikki yo'li bor edi:
--  botga telefon raqamini yuborish (bazadagi raqamga mos kelishi kerak)
--  va saytdagi "Telegramga ulash" tugmasi (sayt logini kerak). Uchinchisi:
--
--  • Admin / qabulxona o'quvchi yoki ota-ona uchun TAKLIF HAVOLASI oladi
--    (t.me/WBAlcBot?start=<token>) va uni WhatsApp/SMS orqali yuboradi.
--    Odam havolani bosib Start bosadi — shu o'quvchiga (o'zi yoki
--    ota-onasi sifatida) ulanadi. Sayt logini ham, raqam mosligi ham
--    shart emas.
--  • Token 7 kun amal qiladi va BIR MARTALIK (havola begona qo'lga
--    o'tsa, faqat bitta chat ulanadi; admin ro'yxatda kim ulanganini
--    ko'radi va kerak bo'lsa yangisini oladi).
--
--  telegram_holati() — admin uchun: har faol o'quvchi botga ulanganmi
--  (o'zi / ota-onasi), telefon raqami bormi.
-- ============================================================

alter table telegram_token alter column profile_id drop not null;
alter table telegram_token add column if not exists student_id text references students (id) on delete cascade;
alter table telegram_token add column if not exists kim text check (kim in ('oquvchi', 'ota_ona'));
alter table telegram_token add column if not exists yaratdi uuid references profiles (id) on delete set null;
alter table telegram_token drop constraint if exists telegram_token_kimga;
alter table telegram_token add constraint telegram_token_kimga
  check (profile_id is not null or (student_id is not null and kim is not null));

comment on column telegram_token.student_id is 'Admin taklif havolasi (0072): shu o''quvchiga ulaydi, kim — o''zi yoki ota-onasi.';

/* Admin / qabulxona: o'quvchi yoki ota-ona uchun 7 kunlik bir martalik havola tokeni */
create or replace function telegram_taklif_ol(p_student text, p_kim text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not app_is_staff() then
    raise exception 'Faqat admin va qabulxona.';
  end if;
  if p_kim not in ('oquvchi', 'ota_ona') then
    raise exception 'Kim: oquvchi yoki ota_ona.';
  end if;
  if not exists (select 1 from students where id = p_student and holat <> 'ketgan') then
    raise exception 'O''quvchi topilmadi.';
  end if;
  delete from telegram_token where amal_qiladi < now() or ishlatildi is not null;
  insert into telegram_token (token, profile_id, student_id, kim, amal_qiladi, yaratdi)
  values (v_token, null, p_student, p_kim, now() + interval '7 days', auth.uid());
  return v_token;
end;
$$;

revoke all on function telegram_taklif_ol(text, text) from public, anon;
grant execute on function telegram_taklif_ol(text, text) to authenticated;

/* Bot: token bilan ulash — profil tokeni (0021/0023) yoki admin taklifi (0072) */
create or replace function telegram_ula_token(p_token text, p_chat bigint, p_tg_ism text)
returns table (kim text, ism text)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_t      telegram_token;
  v_profil uuid;
  v_rol    user_role;
begin
  update telegram_token set ishlatildi = now()
   where token = p_token and ishlatildi is null and amal_qiladi > now()
  returning * into v_t;
  if v_t.token is null then
    return;   -- eskirgan yoki ishlatilgan — bot o'zi tushuntiradi
  end if;

  if v_t.student_id is not null then
    -- Admin taklif havolasi: shu o'quvchiga, o'zi yoki ota-onasi sifatida
    perform telegram_ula_qator(p_chat, v_t.kim, v_t.student_id, null, null, null, p_tg_ism);
  else
    v_profil := v_t.profile_id;
    select rol into v_rol from profiles where id = v_profil;

    if v_rol = 'oquvchi' then
      perform telegram_ula_qator(p_chat, 'oquvchi', s.id, null, null, null, p_tg_ism)
        from students s where s.profile_id = v_profil;
    elsif v_rol = 'ota_ona' then
      perform telegram_ula_qator(p_chat, 'ota_ona', p.oquvchi_id, null, null, null, p_tg_ism)
        from profiles p where p.id = v_profil and p.oquvchi_id is not null;
    end if;

    -- Ustoz yozuvi bo'lsa — ustoz sifatida (xodim ham bo'lishi mumkin)
    perform telegram_ula_qator(p_chat, 'ustoz', null, t.id, null, null, p_tg_ism)
      from teachers t where t.profile_id = v_profil;

    if v_rol in ('admin', 'direktor', 'qabulxona') then
      perform telegram_ula_qator(p_chat, 'xodim', null, null, v_profil, null, p_tg_ism);
    end if;
  end if;

  return query
    select u.kim, coalesce(s.fish, t.ism, p.ism)
    from telegram_ulanish u
    left join students s on s.id = u.student_id
    left join teachers t on t.id = u.teacher_id
    left join profiles p on p.id = u.profile_id
    where u.chat_id = p_chat and u.holat = 'faol';
end;
$$;

revoke execute on function telegram_ula_token(text, bigint, text) from public, anon, authenticated;
grant  execute on function telegram_ula_token(text, bigint, text) to service_role;

/* Admin: faol o'quvchilar botga ulanganmi */
create or replace function telegram_holati()
returns table (
  student_id      text,
  fish            text,
  guruhlar        text,
  guruh_idlar     text[],
  oquvchi_ulangan int,
  ota_ona_ulangan int,
  shaxsiy_tel     boolean,
  ota_ona_tel     boolean,
  login_bor       boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_staff() then
    raise exception 'Faqat admin va qabulxona.';
  end if;
  return query
  select s.id, s.fish,
         (select string_agg(g.nom, ' · ' order by g.nom) from enrollments e join groups g on g.id = e.group_id
           where e.student_id = s.id and e.holat = 'faol'),
         coalesce((select array_agg(e.group_id) from enrollments e where e.student_id = s.id and e.holat = 'faol'), '{}'),
         (select count(*)::int from telegram_ulanish u where u.student_id = s.id and u.kim = 'oquvchi' and u.holat = 'faol'),
         (select count(*)::int from telegram_ulanish u where u.student_id = s.id and u.kim = 'ota_ona' and u.holat = 'faol'),
         tel9(s.shaxsiy_tel) is not null,
         tel9(s.ota_tel) is not null or tel9(s.ona_tel) is not null,
         s.profile_id is not null
  from students s
  where s.holat = 'faol'
  order by s.fish;
end;
$$;

revoke all on function telegram_holati() from public, anon;
grant execute on function telegram_holati() to authenticated;
