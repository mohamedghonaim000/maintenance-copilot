/**
 * Zod schemas for all HTTP request bodies and params.
 *
 * One schema per endpoint (or per logical group where the shape is identical).
 * These schemas live in infrastructure/web — they validate transport-layer
 * inputs only and do NOT replace the domain/agent-level Zod schemas in
 * src/application/contracts/agentSchemas.js.
 *
 * OWASP Web Top 10 — A03 Injection / A04 Insecure Design:
 * Tool arguments and all user inputs are schema-validated before execution.
 */

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** UUID v4 string — used for all :id / :sessionId / :runId / :approvalId params */
const uuidSchema = z.string().uuid('Must be a valid UUID');

// ---------------------------------------------------------------------------
// Auth routes  (/auth/register, /auth/login)
// ---------------------------------------------------------------------------

const RegisterBodySchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['technician', 'supervisor'], {
    error: 'role must be "technician" or "supervisor"',
  }),
});

const LoginBodySchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ---------------------------------------------------------------------------
// Ingest routes  (/ingest, /ingest/upload)
// ---------------------------------------------------------------------------

const IngestBodySchema = z.object({
  filePath: z.string().min(1, 'filePath is required'),
  source: z.string().optional(),
});

const IngestUploadBodySchema = z.object({
  source: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Ask routes  (/ask, /ask/stream)
// ---------------------------------------------------------------------------

const AskBodySchema = z.object({
  question: z.string().min(1, 'question is required').max(4000, 'question too long'),
});

const AskStreamBodySchema = z.object({
  question: z.string().min(1, 'question is required').max(4000, 'question too long'),
  sessionId: uuidSchema,
});

// ---------------------------------------------------------------------------
// Workflow routes  (/workflow/run, /approvals/:approvalId/decide)
// ---------------------------------------------------------------------------

const WorkflowRunBodySchema = z.object({
  symptomDescription: z
    .string()
    .min(10, 'symptomDescription must be at least 10 characters')
    .max(2000, 'symptomDescription too long'),
  sessionId: uuidSchema.optional(),
});

const ApprovalDecideBodySchema = z.object({
  decision: z.enum(['approved', 'rejected', 'edited_and_approved'], {
    error: 'decision must be "approved", "rejected", or "edited_and_approved"',
  }),
  comment: z.string().max(2000).optional(),
  editedAction: z.record(z.unknown()).optional(),
});

const ApprovalIdParamsSchema = z.object({
  approvalId: uuidSchema,
});

const RunIdParamsSchema = z.object({
  runId: uuidSchema,
});

// ---------------------------------------------------------------------------
// Sessions routes
// ---------------------------------------------------------------------------

const CreateSessionBodySchema = z.object({
  title: z.string().max(255).optional(),
});

const SessionIdParamsSchema = z.object({
  sessionId: uuidSchema,
});

const AddMessageBodySchema = z.object({
  runId: uuidSchema.optional(),
  role: z.enum(['user', 'assistant'], {
    error: 'role must be "user" or "assistant"',
  }),
  content: z.string().min(1, 'content is required').max(32000, 'content too long'),
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Auth
  RegisterBodySchema,
  LoginBodySchema,
  // Ingest
  IngestBodySchema,
  IngestUploadBodySchema,
  // Ask
  AskBodySchema,
  AskStreamBodySchema,
  // Workflow
  WorkflowRunBodySchema,
  ApprovalDecideBodySchema,
  ApprovalIdParamsSchema,
  RunIdParamsSchema,
  // Sessions
  CreateSessionBodySchema,
  SessionIdParamsSchema,
  AddMessageBodySchema,
};
