-- Migrasi v2 (Agrade): menambah rata-rata nilai per ujian pada admin_assessments().
-- Jalankan sekali di Supabase SQL Editor bila schema.sql versi pertama sudah pernah dijalankan. Aman diulang.

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

revoke execute on function public.admin_assessments() from public, anon;
grant execute on function public.admin_assessments() to authenticated;
