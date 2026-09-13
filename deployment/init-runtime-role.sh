#!/bin/sh
set -eu
# Runs once during initialization of an empty PostgreSQL data directory.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=runtime_password="$RUNTIME_DB_PASSWORD" --set=migrator="$POSTGRES_USER" <<'SQL'
CREATE ROLE sailsight_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'runtime_password';
GRANT USAGE ON SCHEMA public TO sailsight_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sailsight_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sailsight_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
