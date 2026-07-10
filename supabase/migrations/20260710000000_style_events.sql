create table if not exists public.style_events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'style_view',
    'style_start',
    'style_skip',
    'style_complete',
    'style_share',
    'style_share_open',
    'style_compare_start',
    'style_compare_complete',
    'style_continue_tree'
  )),
  surface text not null check (surface in ('web', 'app')),
  source text not null check (source in ('direct', 'shared', 'compare')),
  test_version smallint not null check (test_version = 2),
  created_at timestamptz not null default now()
);

alter table public.style_events enable row level security;
revoke all on table public.style_events from anon, authenticated, public;
grant insert on table public.style_events to service_role;

do $$
declare
  ignored_job_id bigint;
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute 'select cron.unschedule(''style-events-retention'')' into ignored_job_id;
    execute $schedule$
      select cron.schedule(
        'style-events-retention',
        '15 3 * * *',
        $cron$delete from public.style_events where created_at < now() - interval '30 days'$cron$
      )
    $schedule$;
  end if;
end
$$;
