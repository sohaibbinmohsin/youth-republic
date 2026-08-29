-- checkRateLimit() previously did a separate SELECT count then INSERT from
-- application code -- two concurrent requests for the same key could both
-- read a count under the limit before either had inserted its own row,
-- letting a burst through past the intended limit. Moves the whole
-- check-and-record into a single Postgres function, serialized per-key with
-- pg_advisory_xact_lock so concurrent calls for the same key queue up
-- instead of racing; the lock releases automatically when this function's
-- single implicit transaction (one RPC call) commits.
create or replace function check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));

  select count(*) into v_count
  from rate_limit_hits
  where rate_key = p_key
    and created_at >= now() - (p_window_seconds || ' seconds')::interval;

  if v_count >= p_limit then
    return false;
  end if;

  insert into rate_limit_hits (rate_key) values (p_key);
  return true;
end;
$$ language plpgsql;
