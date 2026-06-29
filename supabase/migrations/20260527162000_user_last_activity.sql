-- Track user activity beyond auth last_sign_in_at.
-- We store last activity timestamp in public.users.metadata->last_activity_at

create or replace function public.touch_user_activity(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  update public.users
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{last_activity_at}',
    to_jsonb(now()),
    true
  )
  where id = p_user_id;
end;
$$;

-- Allow calls from authenticated contexts if needed (triggers run as table owner anyway).
grant execute on function public.touch_user_activity(uuid) to authenticated;

-- Touch activity on product insert/update (uses auth.uid()).
create or replace function public.trg_touch_activity_products()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is not null then
    perform public.touch_user_activity(v_uid);
  end if;
  return new;
end;
$$;

drop trigger if exists touch_activity_products on public.products;
create trigger touch_activity_products
after insert or update on public.products
for each row execute function public.trg_touch_activity_products();

-- Touch activity on sales insert: prefer created_by when provided.
create or replace function public.trg_touch_activity_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  begin
    v_uid := nullif(new.created_by::text, '')::uuid;
  exception when others then
    v_uid := null;
  end;

  if v_uid is null then
    v_uid := auth.uid();
  end if;

  if v_uid is not null then
    perform public.touch_user_activity(v_uid);
  end if;

  return new;
end;
$$;

drop trigger if exists touch_activity_sales on public.sales;
create trigger touch_activity_sales
after insert on public.sales
for each row execute function public.trg_touch_activity_sales();

