-- Optional least-privilege LOGIN for DATABASE_URL. Run as the migration/admin
-- login AFTER prisma migrate deploy. Set its password with psql's interactive
-- \password fin9_app rather than committing a password to this file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fin9_app') THEN
    CREATE ROLE fin9_app LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'fin9_app'
      AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)
  ) THEN
    RAISE EXCEPTION 'fin9_app must be an unprivileged NOBYPASSRLS login';
  END IF;
END
$$;

GRANT fin9_runtime TO fin9_app;
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO fin9_app', current_database());
END
$$;
