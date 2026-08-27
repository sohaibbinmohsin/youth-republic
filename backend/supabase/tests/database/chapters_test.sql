begin;
set constraints all deferred;
select plan(3);

select has_table('public', 'chapters', 'chapters exists');
select has_table('public', 'volunteer_chapter_link', 'volunteer_chapter_link exists');

insert into chapters (organization_id, name, institution, city, province)
values ('11111111-1111-1111-1111-111111111111', 'LUMS Chapter', 'LUMS', 'Lahore', 'Punjab')
returning id as chapter_id \gset

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Chapter Test', 'chapter-test@example.com', '0300-5555555', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'LUMS', 'BSCS')
returning id as vol_id \gset

insert into volunteer_chapter_link (volunteer_id, chapter_id, organization_id)
values (:'vol_id', :'chapter_id', '11111111-1111-1111-1111-111111111111');

select is((select count(*) from volunteer_chapter_link where volunteer_id = :'vol_id'), 1::bigint, 'link created');

select * from finish();
rollback;
