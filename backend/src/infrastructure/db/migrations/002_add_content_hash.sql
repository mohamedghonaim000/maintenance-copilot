ALTER TABLE documents ADD COLUMN content_hash TEXT;
CREATE INDEX documents_content_hash_idx ON documents (content_hash);