begin;
select plan(6);

select has_table('public', 'opportunities', 'opportunities exists');
select has_column('public', 'opportunities', 'organization_id', 'org-scoped');

insert into opportunities (organization_id, name, type, application_open_at, activity_start_at, activity_end_at)
values ('11111111-1111-1111-1111-111111111111', 'Beach Cleanup', 'event', now() - interval '1 day', now() + interval '5 days', now() + interval '6 days')
returning id as opp_id \gset

select is((select opportunity_status(o) from opportunities o where id = :'opp_id'), 'open', 'open before activity start');

update opportunities set activity_start_at = now() - interval '1 hour' where id = :'opp_id';
select is((select opportunity_status(o) from opportunities o where id = :'opp_id'), 'in_progress', 'in_progress during activity window');

update opportunities set activity_end_at = now() - interval '1 hour' where id = :'opp_id';
select is((select opportunity_status(o) from opportunities o where id = :'opp_id'), 'completed', 'completed after activity end');

update opportunities set status_override = 'closed' where id = :'opp_id';
select is((select opportunity_status(o) from opportunities o where id = :'opp_id'), 'closed', 'manual override wins');

select * from finish();
rollback;
