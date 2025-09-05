-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create database if it doesn't exist (this is handled by POSTGRES_DB env var)
-- The database 'smartwait' will be created automatically by the postgres container