-- Newsletter fixes:
-- 1. Signup opt-ins were failing: the client inserted with RETURNING, but only admins can SELECT, and there was
--    no UPDATE policy for re-subscribing. Subscribing now goes through newsletter_subscribe() (security definer).
-- 2. Users can see and change their own subscription from their profile.
-- 3. Admin and marketing accounts can view, edit status and export the list (with phone, role, signup date).

create or replace function public.is_newsletter_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles where id = auth.uid() and role in ('admin', 'marketing')
    );
$$;

drop policy if exists newsletter_subscribers_select_admin on public.newsletter_subscribers;
drop policy if exists newsletter_subscribers_select_staff on public.newsletter_subscribers;
create policy newsletter_subscribers_select_staff
    on public.newsletter_subscribers
    for select to authenticated
    using (public.is_newsletter_staff());

drop policy if exists newsletter_subscribers_update_staff on public.newsletter_subscribers;
create policy newsletter_subscribers_update_staff
    on public.newsletter_subscribers
    for update to authenticated
    using (public.is_newsletter_staff())
    with check (public.is_newsletter_staff());

-- Direct inserts are replaced by newsletter_subscribe(), which validates input and handles re-subscribing.
drop policy if exists newsletter_subscribers_insert_public on public.newsletter_subscribers;

create or replace function public.newsletter_subscribe(
    p_email text,
    p_full_name text default null,
    p_user_id uuid default null,
    p_source text default 'signup'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_email text := lower(trim(coalesce(p_email, '')));
    v_user uuid := auth.uid();
begin
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
        raise exception 'Invalid email address' using errcode = '22023';
    end if;

    -- Right after signup there may be no session yet (email confirmation pending). Accept the new account id
    -- only when it really belongs to this email, so nobody can attach another user's id.
    if v_user is null and p_user_id is not null then
        select id into v_user from auth.users where id = p_user_id and lower(email) = v_email;
    end if;

    insert into public.newsletter_subscribers (email, full_name, user_id, source, status, subscribed_at, unsubscribed_at)
    values (
        v_email,
        nullif(left(trim(coalesce(p_full_name, '')), 120), ''),
        v_user,
        coalesce(nullif(left(trim(coalesce(p_source, '')), 40), ''), 'signup'),
        'subscribed',
        now(),
        null
    )
    on conflict (email) do update set
        status = 'subscribed',
        subscribed_at = case when newsletter_subscribers.status = 'unsubscribed' then now() else newsletter_subscribers.subscribed_at end,
        unsubscribed_at = null,
        user_id = coalesce(newsletter_subscribers.user_id, excluded.user_id),
        full_name = coalesce(newsletter_subscribers.full_name, excluded.full_name);
end;
$$;

revoke all on function public.newsletter_subscribe(text, text, uuid, text) from public;
grant execute on function public.newsletter_subscribe(text, text, uuid, text) to anon, authenticated;

-- The signed-in user's own subscription, matched by account or by their account email.
create or replace function public.my_newsletter_subscription()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((
        select n.status
        from public.newsletter_subscribers n
        where n.user_id = auth.uid()
           or n.email = lower((select u.email from auth.users u where u.id = auth.uid()))
        order by (n.user_id = auth.uid()) desc nulls last
        limit 1
    ), 'none');
$$;

create or replace function public.set_my_newsletter_subscription(p_subscribed boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user uuid := auth.uid();
    v_email text;
    v_name text;
begin
    if v_user is null then
        raise exception 'Authentication required' using errcode = '42501';
    end if;

    select lower(email) into v_email from auth.users where id = v_user;
    if v_email is null then
        raise exception 'Your account has no email address' using errcode = '22023';
    end if;

    if p_subscribed then
        select full_name into v_name from public.profiles where id = v_user;
        perform public.newsletter_subscribe(v_email, v_name, v_user, 'profile');
        return 'subscribed';
    end if;

    update public.newsletter_subscribers
    set status = 'unsubscribed', unsubscribed_at = now(), user_id = coalesce(user_id, v_user)
    where (user_id = v_user or email = v_email) and status = 'subscribed';
    return 'unsubscribed';
end;
$$;

revoke all on function public.my_newsletter_subscription() from public, anon;
revoke all on function public.set_my_newsletter_subscription(boolean) from public, anon;
grant execute on function public.my_newsletter_subscription() to authenticated;
grant execute on function public.set_my_newsletter_subscription(boolean) to authenticated;

-- Staff export: subscribers joined with the matching account (by user id, or by email when not linked).
create or replace function public.newsletter_subscribers_export()
returns table (
    id uuid,
    email text,
    full_name text,
    status text,
    source text,
    subscribed_at timestamptz,
    unsubscribed_at timestamptz,
    user_id uuid,
    phone text,
    role text,
    account_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.is_newsletter_staff() then
        raise exception 'Admins and marketing only' using errcode = '42501';
    end if;

    return query
    select
        n.id,
        n.email,
        coalesce(n.full_name, p.full_name) as full_name,
        n.status,
        n.source,
        n.subscribed_at,
        n.unsubscribed_at,
        coalesce(n.user_id, u.id) as user_id,
        p.phone,
        p.role,
        u.created_at as account_created_at
    from public.newsletter_subscribers n
    left join auth.users u on u.id = n.user_id or (n.user_id is null and lower(u.email) = n.email)
    left join public.profiles p on p.id = u.id
    order by n.subscribed_at desc;
end;
$$;

revoke all on function public.newsletter_subscribers_export() from public, anon;
grant execute on function public.newsletter_subscribers_export() to authenticated;
