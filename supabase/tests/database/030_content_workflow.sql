begin;
select plan(19);

select tests.create_user('editor@example.test', '{editor}') as editor \gset
select tests.create_user('publisher@example.test', '{content_admin}') as publisher \gset

insert into public.content_sources (name, license_type, permission_status)
values ('Test source', 'original', 'pending') returning id as source \gset
insert into public.content_sources (name, license_type, permission_status)
values ('Verified source', 'original', 'verified') returning id as verified \gset
insert into public.prayer_categories (slug, name_en, name_ta) values ('daily', 'Daily', 'அன்றாடம்') returning id as category \gset

-- Editor -------------------------------------------------------------------
select tests.authenticate_as(:'editor');

select lives_ok(
  format($$insert into public.prayers (id, category_id, slug, title_en, body_en, source_id)
           values ('00000000-0000-0000-0000-000000000001', %L, 'test-prayer', 'Title', 'Body', %L)$$, :'category', :'source'),
  'an editor can create a draft'
);
select throws_ok(
  format($$insert into public.prayers (category_id, slug, title_en, body_en, source_id, status)
           values (%L, 'sneaky', 'T', 'B', %L, 'published')$$, :'category', :'verified'),
  '42501', null,
  'an editor cannot create published content'
);
select throws_ok(
  format($$update public.prayers set status = 'published', source_id = %L where slug = 'test-prayer'$$, :'verified'),
  '42501', null,
  'an editor cannot publish'
);
select lives_ok(
  $$update public.prayers set status = 'in_review' where slug = 'test-prayer'$$,
  'an editor can submit for review'
);
select is((select count(*)::int from public.content_audit_log), 0, 'an editor cannot read the audit log');
select throws_ok(
  $$insert into public.prayer_categories (slug, name_en, name_ta) values ('x', 'x', 'x')$$,
  '42501', null,
  'an editor cannot change reference data'
);

-- Anonymous: drafts are invisible --------------------------------------------
select tests.authenticate_anon();
select is((select count(*)::int from public.prayers), 0, 'drafts are not public');
select is((select count(*)::int from public.content_sources), 0, 'anonymous visitors cannot read content sources');

-- Publisher ------------------------------------------------------------------
select tests.authenticate_as(:'publisher');
select throws_ok(
  $$update public.prayers set status = 'published' where slug = 'test-prayer'$$,
  '23514', null,
  'publishing is blocked while the source is unverified'
);
select lives_ok(
  format($$update public.content_sources set permission_status = 'verified' where id = %L$$, :'source'),
  'a publisher can verify a source'
);
select lives_ok(
  $$update public.prayers set status = 'published' where slug = 'test-prayer'$$,
  'a publisher can publish content from a verified source'
);
select isnt((select published_at from public.prayers where slug = 'test-prayer'), null, 'published_at is set on publish');

-- Editors cannot touch published content -------------------------------------
select tests.authenticate_as(:'editor');
select is_empty(
  $$update public.prayers set title_en = 'Changed' where slug = 'test-prayer' returning id$$,
  'an editor cannot edit published content'
);
select is_empty($$delete from public.prayers where slug = 'test-prayer' returning id$$, 'an editor cannot delete content');

-- Public sees published content and credits ----------------------------------
select tests.authenticate_anon();
select is((select count(*)::int from public.prayers), 1, 'published content from a verified source is public');
select is((select count(*)::int from public.credits), 2, 'verified sources appear in credits');

-- Revoking the source hides content again ------------------------------------
reset role;
update public.content_sources set permission_status = 'restricted' where id = :'source';
select tests.authenticate_anon();
select is((select count(*)::int from public.prayers), 0, 'content disappears when its source is restricted');

-- Audit trail ----------------------------------------------------------------
select tests.authenticate_as(:'publisher');
select ok(
  (select count(*) from public.content_audit_log
   where entity_type = 'prayers' and entity_id = '00000000-0000-0000-0000-000000000001') >= 3,
  'every change to the prayer is in the audit log'
);
select throws_ok($$delete from public.content_audit_log$$, '42501', null, 'audit history cannot be deleted');

select * from finish();
rollback;
