-- Enable pgvector extension (run once per Supabase project)
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks table for RAG retrieval
CREATE TABLE IF NOT EXISTS document_chunks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID        NOT NULL,
    document_type   TEXT        NOT NULL CHECK (document_type IN ('protocol', 'patient')),
    site_id         UUID        NOT NULL,
    chunk_index     INTEGER     NOT NULL,
    content         TEXT        NOT NULL,
    embedding       vector(1536),           -- text-embedding-3-small output dimension
    metadata        JSONB       DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for fast approximate nearest-neighbour search
-- (Run AFTER inserting enough rows — at least a few hundred for good results)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for fast filtering by site + type
CREATE INDEX IF NOT EXISTS document_chunks_site_type_idx
    ON document_chunks (site_id, document_type);
