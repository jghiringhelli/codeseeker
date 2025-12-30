# PostgreSQL with pgvector extension for semantic search
FROM pgvector/pgvector:pg15

# Copy initialization scripts
COPY ./src/database/schema.postgres.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY ./docker/scripts/vector-init.sql /docker-entrypoint-initdb.d/02-vector-init.sql

# Set proper permissions
RUN chmod 644 /docker-entrypoint-initdb.d/*.sql