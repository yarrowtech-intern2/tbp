-- CRM: make "converted" an automatic, computed lead status instead of a manual one.
--
-- A lead is a contact_submissions row with no account link — the only signal we
-- have to detect that a lead became a paying customer is matching its email
-- against public.profiles, then checking for a paid booking. This function
-- computes that live on every read (no trigger, no stored "converted" flag to
-- keep in sync), following the same admin/marketing-gated security definer
-- pattern as public.get_crm_travelers() (see 202608190002 for why an RPC
-- instead of a broader RLS policy).

create or replace function public.get_crm_leads()
returns table (
    id uuid,
    name text,
    email text,
    phone text,
    location text,
    message text,
    source_page text,
    created_at timestamptz,
    status text,
    status_updated_at timestamptz,
    is_converted boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        cs.id,
        cs.name,
        cs.email,
        cs.phone,
        cs.location,
        cs.message,
        cs.source_page,
        cs.created_at,
        coalesce(cls.status, 'new') as status,
        cls.updated_at as status_updated_at,
        exists (
            select 1
            from public.profiles p
            join public.bookings b on b.user_id = p.id
            where lower(btrim(p.email)) = lower(btrim(cs.email))
              and cs.email <> ''
              and b.payment_status = 'paid'
        ) as is_converted
    from public.contact_submissions cs
    left join public.crm_lead_status cls on cls.contact_submission_id = cs.id
    where public.is_admin_user() or public.is_marketing_user()
    order by cs.created_at desc;
$$;

grant execute on function public.get_crm_leads() to authenticated;
