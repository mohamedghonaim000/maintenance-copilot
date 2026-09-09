-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('technician', 'supervisor')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    file_type TEXT NOT NULL,
    manual_version TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Chunks (RAG core)
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    section TEXT,
    page_number INT,
    embedding VECTOR(768),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for vector similarity search
CREATE INDEX chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Index for keyword search (hybrid retrieval)
CREATE INDEX chunks_content_fts_idx ON chunks USING gin (to_tsvector('english', content));

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Runs (observability core)
CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id),
    correlation_id UUID NOT NULL,
    workflow_type TEXT NOT NULL CHECK (workflow_type IN ('qa', 'maintenance_workflow')),
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','awaiting_approval','completed','failed')),
    initiated_by UUID REFERENCES users(id),
    total_cost NUMERIC(10,4) DEFAULT 0,
    total_tokens INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Agent steps (per-agent trace)
CREATE TABLE agent_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    step_order INT NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    tools_called JSONB,
    chunks_used JSONB,
    tokens_used INT,
    cost NUMERIC(10,4),
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Approvals (human-in-the-loop gate)
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','edited_and_approved')),
    proposed_action JSONB NOT NULL,
    final_action JSONB,
    approved_by UUID REFERENCES users(id),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    decided_at TIMESTAMPTZ
);

-- Work orders (D5 workflow output)
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    approval_id UUID REFERENCES approvals(id),
    equipment_id TEXT NOT NULL,
    manual_version TEXT NOT NULL,
    diagnostic_steps JSONB NOT NULL,
    safety_prerequisites JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','dispatched','cancelled')),
    dispatched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);