begin;
select plan(4);

select has_table('public', 'organizations', 'organizations exists');

insert into organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Rizq', 'rizq');

select is((select name from organizations where id = '11111111-1111-1111-1111-111111111111'), 'Rizq', 'row stores the mirrored name');

insert into organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Rizq Renamed', 'rizq')
on conflict (id) do update set name = excluded.name, synced_at = now();

select is((select name from organizations where id = '11111111-1111-1111-1111-111111111111'), 'Rizq Renamed', 'upsert updates name on re-sync, not a duplicate row');
select is((select count(*) from organizations), 1::bigint, 're-sync does not create a second row');

select * from finish();
rollback;
