-- CRM Phase 2: traveler (and later provider) account notes, plus a narrow RPC for
-- browsing traveler profiles from the CRM.
--
-- Why an RPC instead of a broader public.profiles SELECT policy:
-- docs/cross-user-boundary-audit.md deliberately narrowed public.profiles reads to
-- public.can_view_profile() (self, admin, verified providers, or a booking
-- relationship) and removed a prior broad "marketing can read all profiles" policy.
-- Re-widening that policy would undo that hardening for every profile read in the
-- app. Instead, this ships a purpose-built, permission-checked function — the same
-- pattern already used by public.get_admin_account_locations() and
-- public.get_admin_revenue() — so CRM traveler browsing does not touch the general
-- profiles RLS policy at all.

create table if not exists public.crm_account_notes (
    id uuid primary key default gen_random_uuid(),
    subject_type text not null check (subject_type in ('traveler', 'provider')),
    subject_id uuid not null references public.profiles(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    body text not null check (char_length(btrim(body)) between 1 and 4000),
    created_at timestamptz not null default now()
);

create index if not exists crm_account_notes_subject_idx
    on public.crm_account_notes(subject_type, subject_id, created_at desc);

alter table public.crm_account_notes enable row level security;

drop policy if exists "crm_account_notes_select_admin_or_marketing" on public.crm_account_notes;
create policy "crm_account_notes_select_admin_or_marketing"
on public.crm_account_notes
for select
to authenticated
using (public.is_admin_user() or public.is_marketing_user());

drop policy if exists "crm_account_notes_insert_admin_or_marketing" on public.crm_account_notes;
create policy "crm_account_notes_insert_admin_or_marketing"
on public.crm_account_notes
for insert
to authenticated
with check (
    (public.is_admin_user() or public.is_marketing_user())
    and author_id = auth.uid()
);

grant select, insert on public.crm_account_notes to authenticated;

create or replace function public.get_crm_travelers(search_term text default null)
returns table (
    id uuid,
    full_name text,
    email text,
    phone text,
    city text,
    country text,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select p.id, p.full_name, p.email, p.phone, p.city, p.country, p.created_at
    from public.profiles p
    where p.role = 'tourist'
      and (public.is_admin_user() or public.is_marketing_user())
      and (
        search_term is null
        or btrim(search_term) = ''
        or p.full_name ilike '%' || search_term || '%'
        or p.email ilike '%' || search_term || '%'
        or p.phone ilike '%' || search_term || '%'
      )
    order by p.created_at desc nulls last
    limit 50;
$$;

grant execute on function public.get_crm_travelers(text) to authenticated;
