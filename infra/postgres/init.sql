-- Runs once when the Postgres volume is first created.
-- pgvector is pre-installed in the pgvector/pgvector image; this enables it for the database.
CREATE EXTENSION IF NOT EXISTS vector;
