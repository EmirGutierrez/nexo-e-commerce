\getenv exporter_password POSTGRES_EXPORTER_PASSWORD

SELECT format('CREATE ROLE nexo_exporter LOGIN PASSWORD %L', :'exporter_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexo_exporter')
\gexec

SELECT format('ALTER ROLE nexo_exporter WITH LOGIN PASSWORD %L', :'exporter_password')
\gexec

GRANT pg_monitor TO nexo_exporter;
