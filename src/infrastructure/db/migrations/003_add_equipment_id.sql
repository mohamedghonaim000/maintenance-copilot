-- Equipment identification (explicit, extracted at ingestion time)
ALTER TABLE documents ADD COLUMN equipment_id TEXT;
CREATE INDEX documents_equipment_id_idx ON documents (equipment_id);

-- Stored generated column for full-text search (avoids recomputing
-- to_tsvector on every query; replaces the inline computation used
-- in the original chunks_content_fts_idx)
ALTER TABLE chunks ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(content, ''))) STORED;
CREATE INDEX chunks_search_vector_idx ON chunks USING gin (search_vector);

-- Switch vector index from ivfflat to HNSW: better accuracy/speed
-- trade-off for our corpus size, and doesn't require a minimum data
-- volume to avoid the "low recall" warning ivfflat gave on a small table.
DROP INDEX IF EXISTS chunks_embedding_idx;
CREATE INDEX chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);