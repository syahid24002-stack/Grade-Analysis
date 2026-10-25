-- Agrade: skema Supabase.
-- Jalankan seluruh berkas ini di Supabase: SQL Editor > New query > Run. Aman diulang.

create extension if not exists pgcrypto;

-- =====================================================================
-- TABEL
-- =====================================================================

-- Profil pengguna (satu baris per akun di auth.users).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  branch text not null default '',
  role text not null default 'USER' check (role in ('ADMIN', 'USER')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create unique index if not exists profiles_email_key on public.profiles (lower(email));

-- Ujian. materi = [{ "nama": "Aljabar", "soal": [1,2,3,4,18] }, ...]
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  total_questions int not null default 0,
  lemah_pct numeric not null default 50,
  kuat_pct numeric not null default 75,
  published boolean not null default false,
  materi jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint assessments_batas_valid check (lemah_pct >= 0 and kuat_pct <= 100 and lemah_pct < kuat_pct)
);
create unique index if not exists assessments_name_key on public.assessments (name_key);

-- Nilai per peserta. answers: satu huruf per soal (B = benar, S = salah, K = kosong, - = tidak diketahui).
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  email text not null,
  name text not null default '',
  branch text not null default '',
  score numeric not null,
  correct int not null default 0,
  wrong int not null default 0,
  unanswered int not null default 0,
  answers text not null default '',
  submit_time timestamptz,
  unique (assessment_id, email)
);
create index if not exists scores_assessment_idx on public.scores (assessment_id);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values ('allow_self_registration', 'true'::jsonb)
on conflict (key) do nothing;

-- =====================================================================
-- FUNGSI BANTU
-- =====================================================================

-- True bila pemanggil adalah ADMIN yang aktif.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'ADMIN' and status = 'ACTIVE'
  );
$$;

-- Membuat profil otomatis setiap ada akun baru.
-- Nama dan cabang dari user_metadata; role HANYA dari app_metadata (tidak bisa diisi dari browser).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, branch, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'branch', ''),
    case when new.raw_app_meta_data ->> 'role' = 'ADMIN' then 'ADMIN' else 'USER' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mencatat waktu login terakhir milik sendiri.
create or replace function public.touch_login()
returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_login = now() where id = (select auth.uid());
$$;

-- Mencatat aktivitas admin.
create or replace function public.log_activity(p_action text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return; end if;
  insert into public.activity_log (user_id, action, details) values ((select auth.uid()), p_action, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Daftar ujian + jumlah peserta + rata-rata nilai (admin).
drop function if exists public.admin_assessments();
create function public.admin_assessments()
returns table (id uuid, name text, total_questions int, published boolean, participants bigint, avg_score numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Anda tidak memiliki akses admin untuk aksi ini.';
  end if;
  return query
    select a.id, a.name, a.total_questions, a.published,
           (select count(*) from public.scores s where s.assessment_id = a.id),
           (select avg(s.score) from public.scores s where s.assessment_id = a.id),
           a.created_at
    from public.assessments a
    order by a.created_at desc;
end;
$$;

-- Impor nilai dalam satu transaksi (semua berhasil atau tidak sama sekali).
-- p_rows: [{email,name,branch,score,correct,wrong,unanswered,answers,submit_time}, ...]
create or replace function public.import_scores(p_name text, p_total int, p_rows jsonb, p_replace boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_existing boolean := false;
  v_key text;
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'Anda tidak memiliki akses admin untuk aksi ini.';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then raise exception 'Nama ujian tidak boleh kosong.'; end if;
  if length(p_name) > 60 then raise exception 'Nama ujian terlalu panjang (maks 60 karakter).'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Tidak ada baris nilai yang valid.';
  end if;

  v_key := lower(regexp_replace(p_name, '\s+', ' ', 'g'));
  select a.id into v_id from public.assessments a where a.name_key = v_key;

  if v_id is not null then
    if not coalesce(p_replace, false) then
      raise exception 'Ujian "%" sudah ada. Centang "Timpa data lama" untuk menggantinya.', p_name;
    end if;
    v_existing := true;
    update public.assessments set total_questions = p_total where id = v_id;
    delete from public.scores where assessment_id = v_id;
  else
    insert into public.assessments (name, total_questions) values (p_name, p_total) returning id into v_id;
  end if;

  insert into public.scores (assessment_id, email, name, branch, score, correct, wrong, unanswered, answers, submit_time)
  select v_id, lower(btrim(r.email)), coalesce(r.name, ''), coalesce(r.branch, ''), r.score,
         coalesce(r.correct, 0), coalesce(r.wrong, 0), coalesce(r.unanswered, 0), coalesce(r.answers, ''), r.submit_time
  from jsonb_to_recordset(p_rows) as r(
    email text, name text, branch text, score numeric, correct int, wrong int, unanswered int, answers text, submit_time timestamptz
  );
  get diagnostics v_n = row_count;

  insert into public.activity_log (user_id, action, details)
  values ((select auth.uid()), 'ADMIN_IMPORT_SCORES', jsonb_build_object('assessment', p_name, 'rows', v_n));

  return jsonb_build_object('assessment_id', v_id, 'participants', v_n, 'total_questions', p_total, 'replaced', v_existing);
end;
$$;

-- Hanya pengguna yang sudah login yang boleh memanggil fungsi di atas.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.touch_login() from public, anon;
revoke execute on function public.log_activity(text, jsonb) from public, anon;
revoke execute on function public.admin_assessments() from public, anon;
revoke execute on function public.import_scores(text, int, jsonb, boolean) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.touch_login() to authenticated;
grant execute on function public.log_activity(text, jsonb) to authenticated;
grant execute on function public.admin_assessments() to authenticated;
grant execute on function public.import_scores(text, int, jsonb, boolean) to authenticated;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Siswa TIDAK punya akses langsung ke assessments dan scores. Hasil siswa dihitung di server (/api)
-- sehingga hanya data miliknya yang keluar, dan nama peserta lain disamarkan.
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.scores enable row level security;
alter table public.activity_log enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists profiles_baca on public.profiles;
create policy profiles_baca on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists assessments_admin on public.assessments;
create policy assessments_admin on public.assessments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists scores_admin on public.scores;
create policy scores_admin on public.scores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists log_admin_baca on public.activity_log;
create policy log_admin_baca on public.activity_log for select to authenticated
  using (public.is_admin());

drop policy if exists settings_baca on public.app_settings;
create policy settings_baca on public.app_settings for select to anon, authenticated using (true);

drop policy if exists settings_admin_tulis on public.app_settings;
create policy settings_admin_tulis on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- ADMIN PERTAMA
-- Cara 1 (disarankan): isi ADMIN_EMAILS di Vercel, lalu daftar dengan email itu di aplikasi.
-- Cara 2: setelah akun terdaftar, jalankan baris di bawah (ganti emailnya):
--   update public.profiles set role = 'ADMIN' where email = 'syahidfatlan@gmail.com';
-- =====================================================================
