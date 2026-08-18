-- Add Local Guide as a provider subtype for live 360 virtual tours.

do $$
declare
    constraint_name text;
begin
    for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'profiles'
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%role%'
    loop
        execute format('alter table public.profiles drop constraint if exists %I', constraint_name);
    end loop;
end $$;

alter table public.profiles
    add constraint profiles_role_check
    check (role in ('tourist', 'tour_company', 'tour_instructor', 'tour_guide', 'local_guide', 'admin', 'provider', 'vendor', 'marketing')) not valid;

do $$
declare
    constraint_name text;
begin
    for constraint_name in
        select c.conname
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'verification'
          and c.contype = 'c'
          and pg_get_constraintdef(c.oid) ilike '%role%'
    loop
        execute format('alter table public.verification drop constraint if exists %I', constraint_name);
    end loop;
end $$;

alter table public.verification
    add constraint verification_role_check
    check (role in ('tour_company', 'tour_instructor', 'tour_guide', 'local_guide')) not valid;

create or replace function public.handle_new_auth_user_provider_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    signup_role text := lower(replace(replace(coalesce(new.raw_user_meta_data->>'role', 'tourist'), '-', '_'), ' ', '_'));
    signup_languages text[];
    signup_years_experience integer;
begin
    if signup_role not in ('tourist', 'tour_company', 'tour_instructor', 'tour_guide', 'local_guide') then
        signup_role := 'tourist';
    end if;

    select array_remove(array_agg(nullif(trim(language_item), '')), null)
    into signup_languages
    from unnest(string_to_array(coalesce(new.raw_user_meta_data->>'languages', ''), ',')) as language_item;

    if nullif(new.raw_user_meta_data->>'years_experience', '') ~ '^[0-9]+$' then
        signup_years_experience := (new.raw_user_meta_data->>'years_experience')::integer;
    end if;

    insert into public.profiles (
        id,
        email,
        full_name,
        phone,
        country,
        city,
        bio,
        role,
        is_verified,
        verification_status,
        company_name,
        works_under_company,
        website,
        provider_specialties,
        guide_license_number,
        certificate_id,
        government_id_ref,
        years_experience,
        languages
    )
    values (
        new.id,
        new.email,
        coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'Member'),
        nullif(new.raw_user_meta_data->>'phone', ''),
        nullif(new.raw_user_meta_data->>'country', ''),
        nullif(new.raw_user_meta_data->>'city', ''),
        nullif(new.raw_user_meta_data->>'bio', ''),
        signup_role,
        signup_role = 'tourist',
        case when signup_role = 'tourist' then 'not_required' else 'pending' end,
        nullif(new.raw_user_meta_data->>'company_name', ''),
        coalesce(nullif(new.raw_user_meta_data->>'works_under_company', '')::boolean, false),
        nullif(new.raw_user_meta_data->>'website', ''),
        nullif(new.raw_user_meta_data->>'specialties', ''),
        nullif(new.raw_user_meta_data->>'license_number', ''),
        nullif(new.raw_user_meta_data->>'certificate_id', ''),
        nullif(new.raw_user_meta_data->>'government_id_ref', ''),
        signup_years_experience,
        signup_languages
    )
    on conflict (id) do update
    set
        email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone,
        country = excluded.country,
        city = excluded.city,
        bio = excluded.bio,
        role = excluded.role,
        is_verified = excluded.is_verified,
        verification_status = excluded.verification_status,
        company_name = excluded.company_name,
        works_under_company = excluded.works_under_company,
        website = excluded.website,
        provider_specialties = excluded.provider_specialties,
        guide_license_number = excluded.guide_license_number,
        certificate_id = excluded.certificate_id,
        government_id_ref = excluded.government_id_ref,
        years_experience = excluded.years_experience,
        languages = excluded.languages;

    if signup_role in ('tour_company', 'tour_instructor', 'tour_guide', 'local_guide') then
        insert into public.verification (
            user_id,
            role,
            verification_type,
            owner_name,
            owner_id_card_url,
            status,
            company_name,
            website,
            registration_number,
            works_under_company,
            specialties,
            license_number,
            languages,
            years_experience,
            certificate_id,
            government_id_ref,
            bio
        )
        select
            new.id,
            signup_role,
            'account',
            coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'Provider'),
            coalesce(nullif(new.raw_user_meta_data->>'owner_id_card_url', ''), ''),
            'pending',
            nullif(new.raw_user_meta_data->>'company_name', ''),
            nullif(new.raw_user_meta_data->>'website', ''),
            nullif(new.raw_user_meta_data->>'registration_number', ''),
            coalesce(nullif(new.raw_user_meta_data->>'works_under_company', '')::boolean, false),
            nullif(new.raw_user_meta_data->>'specialties', ''),
            nullif(new.raw_user_meta_data->>'license_number', ''),
            signup_languages,
            signup_years_experience,
            nullif(new.raw_user_meta_data->>'certificate_id', ''),
            nullif(new.raw_user_meta_data->>'government_id_ref', ''),
            nullif(new.raw_user_meta_data->>'bio', '')
        where not exists (
            select 1
            from public.verification existing
            where existing.user_id = new.id
        );
    end if;

    return new;
exception
    when others then
        raise warning 'Provider signup bootstrap failed for auth user %: %', new.id, sqlerrm;
        return new;
end;
$$;

drop trigger if exists on_auth_user_provider_signup on auth.users;
create trigger on_auth_user_provider_signup
after insert on auth.users
for each row execute function public.handle_new_auth_user_provider_signup();

create or replace function public.is_verified_provider(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = check_user_id
          and role in ('tour_company', 'tour_instructor', 'tour_guide', 'local_guide')
          and (
              coalesce(is_verified, false) = true
              or coalesce(verification_status, 'pending') in ('approved', 'not_required')
          )
    );
$$;

create or replace function public.can_view_profile(target_user_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        target_user_id = check_user_id
        or public.is_admin_user(check_user_id)
        or exists (
            select 1
            from public.profiles target
            where target.id = target_user_id
              and target.role in ('tour_company', 'tour_instructor', 'tour_guide', 'local_guide')
              and coalesce(target.verification_status, 'not_required') in ('not_required', 'approved')
        )
        or exists (
            select 1
            from public.bookings b
            where (
                b.user_id = check_user_id
                and b.provider_user_id = target_user_id
            ) or (
                b.provider_user_id = check_user_id
                and b.user_id = target_user_id
            )
        )
        or exists (
            select 1
            from public.conversations c
            where (
                c.traveler_id = check_user_id
                and c.provider_id = target_user_id
            ) or (
                c.provider_id = check_user_id
                and c.traveler_id = target_user_id
            )
        );
$$;

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (
    id = auth.uid()
    and role in ('tourist', 'tour_company', 'tour_instructor', 'tour_guide', 'local_guide', 'provider')
);

drop policy if exists "verification_insert_provider_self" on public.verification;
create policy "verification_insert_provider_self"
on public.verification
for insert
to authenticated
with check (
    user_id = auth.uid()
    and role in ('tour_company', 'tour_instructor', 'tour_guide', 'local_guide')
    and status = 'pending'
);

drop policy if exists "verification_update_provider_resubmit_or_admin" on public.verification;
create policy "verification_update_provider_resubmit_or_admin"
on public.verification
for update
to authenticated
using (
    user_id = auth.uid()
    or public.is_admin_user()
)
with check (
    public.is_admin_user()
    or (
        user_id = auth.uid()
        and role in ('tour_company', 'tour_instructor', 'tour_guide', 'local_guide')
        and status = 'resubmitted'
    )
);

do $$
begin
    if to_regclass('public.profile_follows') is not null then
        drop policy if exists "profile_follows_insert_tourist_to_provider" on public.profile_follows;
        create policy "profile_follows_insert_tourist_to_provider"
        on public.profile_follows
        for insert
        to authenticated
        with check (
            follower_user_id = auth.uid()
            and follower_user_id <> followed_user_id
            and exists (
                select 1
                from public.profiles follower
                where follower.id = auth.uid()
                  and follower.role = 'tourist'
            )
            and exists (
                select 1
                from public.profiles provider
                where provider.id = followed_user_id
                  and provider.role in ('tour_company', 'tour_instructor', 'tour_guide', 'local_guide')
            )
        );
    end if;
end $$;

update public.profiles profiles
set
    role = 'local_guide',
    is_verified = true,
    verification_status = 'not_required',
    provider_specialties = coalesce(
        nullif(profiles.provider_specialties, ''),
        nullif(auth_users.raw_user_meta_data->>'specialties', '')
    ),
    government_id_ref = coalesce(
        nullif(profiles.government_id_ref, ''),
        nullif(auth_users.raw_user_meta_data->>'government_id_ref', '')
    ),
    updated_at = now()
from auth.users auth_users
where auth_users.id = profiles.id
  and lower(replace(replace(coalesce(auth_users.raw_user_meta_data->>'role', ''), '-', '_'), ' ', '_')) = 'local_guide'
  and coalesce(profiles.role, 'tourist') = 'tourist';

insert into public.verification (
    user_id,
    role,
    verification_type,
    owner_name,
    owner_id_card_url,
    status,
    company_name,
    website,
    works_under_company,
    specialties,
    license_number,
    languages,
    years_experience,
    certificate_id,
    government_id_ref,
    bio
)
select
    profiles.id,
    profiles.role,
    'account',
    coalesce(nullif(profiles.full_name, ''), split_part(profiles.email, '@', 1), 'Provider'),
    coalesce(nullif(profiles.government_id_ref, ''), ''),
    coalesce(nullif(profiles.verification_status, 'not_required'), 'pending'),
    profiles.company_name,
    profiles.website,
    coalesce(profiles.works_under_company, false),
    profiles.provider_specialties,
    profiles.guide_license_number,
    profiles.languages,
    profiles.years_experience,
    profiles.certificate_id,
    profiles.government_id_ref,
    profiles.bio
from public.profiles
where profiles.role = 'local_guide'
  and not exists (
      select 1
      from public.verification existing
      where existing.user_id = profiles.id
  );
