-- PhD Kickoff Meeting Scheduler
-- Run this once in Supabase > SQL Editor.

create table if not exists public.meeting_availability (
  poll_id text not null,
  participant text not null,
  slots jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint meeting_availability_pk primary key (poll_id, participant),
  constraint participant_allowed check (participant in ('Yassine', 'Barbara', 'Amir', 'Sadok')),
  constraint slots_must_be_array check (jsonb_typeof(slots) = 'array')
);

alter table public.meeting_availability enable row level security;

-- Public browser access is intentionally limited to this one poll and four participant names.
grant usage on schema public to anon;
grant select, insert, update on table public.meeting_availability to anon;
revoke delete on table public.meeting_availability from anon;

-- Re-create policies safely if the script is run again.
drop policy if exists meeting_poll_read on public.meeting_availability;
drop policy if exists meeting_poll_insert on public.meeting_availability;
drop policy if exists meeting_poll_update on public.meeting_availability;

create policy meeting_poll_read
on public.meeting_availability
for select
to anon
using (
  poll_id = 'upec-phd-kickoff-2026-10-19-22'
  and participant in ('Yassine', 'Barbara', 'Amir', 'Sadok')
);

create policy meeting_poll_insert
on public.meeting_availability
for insert
to anon
with check (
  poll_id = 'upec-phd-kickoff-2026-10-19-22'
  and participant in ('Yassine', 'Barbara', 'Amir', 'Sadok')
);

create policy meeting_poll_update
on public.meeting_availability
for update
to anon
using (
  poll_id = 'upec-phd-kickoff-2026-10-19-22'
  and participant in ('Yassine', 'Barbara', 'Amir', 'Sadok')
)
with check (
  poll_id = 'upec-phd-kickoff-2026-10-19-22'
  and participant in ('Yassine', 'Barbara', 'Amir', 'Sadok')
);
