const http = require('http');
const jwt = require('jsonwebtoken');
const createServer = require('./server');

function createMockDeps() {
  return {
    ingestDocument: {
      run: jest.fn(async (filePath, source) => [{ documentId: 1, filePath, source }]),
    },
    askQuestion: {
      run: jest.fn(async (question) => ({ answer: `answer:${question}`, citations: [] })),
    },
    orchestrator: {
      runWorkflow: jest.fn(async ({ symptomDescription, sessionId }) => ({
        status: 'awaiting_approval',
        symptomDescription,
        sessionId,
      })),
    },
    decideApproval: {
      run: jest.fn(async ({ approvalId, decision }) => ({ approvalId, status: decision })),
    },
    userRepository: {
      findByEmail: jest.fn(async () => null),
      createUser: jest.fn(async ({ email, passwordHash, role }) => ({
        id: 'user-1',
        email,
        passwordHash,
        role,
      })),
    },
    authenticateUser: {
      login: jest.fn(async ({ email }) => ({ token: `token:${email}` })),
    },
    sessionRepository: {
      createSession: jest.fn(async ({ userId, title }) => ({ id: 'session-1', userId, title })),
      getSessionsByUser: jest.fn(async (userId) => [{ id: 'session-1', userId, title: 'Pump 4' }]),
      getRunsBySession: jest.fn(async (sessionId) => [{ id: 'run-1', sessionId }]),
    },
    vectorSearchRepository: {},
    llmProvider: {},
    runRepository: {},
  };
}

function request(app, { method = 'GET', path, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const payload = body === undefined ? null : JSON.stringify(body);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                ...headers,
              }
            : headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            server.close(() => {
              resolve({
                statusCode: res.statusCode,
                body: data ? JSON.parse(data) : null,
              });
            });
          });
        }
      );

      req.on('error', (err) => {
        server.close(() => reject(err));
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

function authHeaders({ userId = 'user-1', role = 'technician' } = {}) {
  return {
    Authorization: `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET)}`,
  };
}

describe('web server endpoints', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  test('health and readiness endpoints respond', async () => {
    const app = createServer(createMockDeps());

    await expect(request(app, { path: '/health' })).resolves.toEqual({
      statusCode: 200,
      body: { status: 'ok' },
    });
    await expect(request(app, { path: '/ready' })).resolves.toEqual({
      statusCode: 200,
      body: { status: 'ready' },
    });
  });

  test('POST /ingest validates input and runs ingestion', async () => {
    const deps = createMockDeps();
    const app = createServer(deps);

    await expect(request(app, { method: 'POST', path: '/ingest' })).resolves.toEqual({
      statusCode: 400,
      body: { error: 'filePath is required' },
    });

    await expect(
      request(app, {
        method: 'POST',
        path: '/ingest',
        body: { filePath: 'manual.txt', source: 'test' },
      })
    ).resolves.toEqual({
      statusCode: 200,
      body: { results: [{ documentId: 1, filePath: 'manual.txt', source: 'test' }] },
    });
    expect(deps.ingestDocument.run).toHaveBeenCalledWith('manual.txt', 'test');
  });

  test('POST /ask validates input and runs question answering', async () => {
    const deps = createMockDeps();
    const app = createServer(deps);

    await expect(request(app, { method: 'POST', path: '/ask' })).resolves.toEqual({
      statusCode: 400,
      body: { error: 'question (string) is required' },
    });

    await expect(
      request(app, { method: 'POST', path: '/ask', body: { question: 'What failed?' } })
    ).resolves.toEqual({
      statusCode: 200,
      body: { answer: 'answer:What failed?', citations: [] },
    });
    expect(deps.askQuestion.run).toHaveBeenCalledWith('What failed?');
  });

  test('POST /workflow/run requires authentication', async () => {
    const app = createServer(createMockDeps());

    await expect(request(app, { method: 'POST', path: '/workflow/run' })).resolves.toEqual({
      statusCode: 401,
      body: { error: 'Missing or invalid Authorization header' },
    });
  });

  test('POST /workflow/run validates input and starts workflow', async () => {
    const deps = createMockDeps();
    const app = createServer(deps);
    const headers = authHeaders();

    await expect(request(app, { method: 'POST', path: '/workflow/run', headers })).resolves.toEqual({
      statusCode: 400,
      body: { error: 'symptomDescription is required' },
    });

    await expect(
      request(app, {
        method: 'POST',
        path: '/workflow/run',
        body: { symptomDescription: 'Pump vibration', sessionId: 's1' },
        headers,
      })
    ).resolves.toEqual({
      statusCode: 200,
      body: {
        status: 'awaiting_approval',
        symptomDescription: 'Pump vibration',
        sessionId: 's1',
      },
    });
    expect(deps.orchestrator.runWorkflow).toHaveBeenCalledWith({
      symptomDescription: 'Pump vibration',
      sessionId: 's1',
      initiatedBy: 'user-1',
    });
  });

  test('POST /approvals/:approvalId/decide only permits supervisors', async () => {
    const deps = createMockDeps();
    const app = createServer(deps);

    await expect(
      request(app, {
        method: 'POST',
        path: '/approvals/ap-1/decide',
        body: { decision: 'approved' },
        headers: authHeaders(),
      })
    ).resolves.toEqual({
      statusCode: 403,
      body: { error: 'Insufficient permissions for this action' },
    });

    await expect(
      request(app, {
        method: 'POST',
        path: '/approvals/ap-1/decide',
        body: { decision: 'approved', approvedBy: 'operator' },
        headers: authHeaders({ userId: 'supervisor-1', role: 'supervisor' }),
      })
    ).resolves.toEqual({
      statusCode: 200,
      body: { approvalId: 'ap-1', status: 'approved' },
    });
    expect(deps.decideApproval.run).toHaveBeenCalledWith({
      approvalId: 'ap-1',
      decision: 'approved',
      approvedBy: 'supervisor-1',
      comment: undefined,
      editedAction: undefined,
    });
  });

  test('auth routes validate registration and delegate login', async () => {
    const deps = createMockDeps();
    const app = createServer(deps);

    await expect(
      request(app, { method: 'POST', path: '/auth/register', body: { email: 'tech@example.com' } })
    ).resolves.toEqual({
      statusCode: 400,
      body: { error: 'email, password, and a valid role are required' },
    });

    await expect(
      request(app, {
        method: 'POST',
        path: '/auth/login',
        body: { email: 'tech@example.com', password: 'secret' },
      })
    ).resolves.toEqual({ statusCode: 200, body: { token: 'token:tech@example.com' } });
    expect(deps.authenticateUser.login).toHaveBeenCalledWith({
      email: 'tech@example.com',
      password: 'secret',
    });
  });

  test('session routes use the authenticated user', async () => {
    const deps = createMockDeps();
    const app = createServer(deps);
    const headers = authHeaders({ userId: 'tech-1' });

    await expect(
      request(app, { method: 'POST', path: '/sessions', body: { title: 'Pump 4' }, headers })
    ).resolves.toEqual({
      statusCode: 201,
      body: { id: 'session-1', userId: 'tech-1', title: 'Pump 4' },
    });
    await expect(request(app, { path: '/sessions', headers })).resolves.toEqual({
      statusCode: 200,
      body: [{ id: 'session-1', userId: 'tech-1', title: 'Pump 4' }],
    });
    await expect(request(app, { path: '/sessions/session-1/runs', headers })).resolves.toEqual({
      statusCode: 200,
      body: [{ id: 'run-1', sessionId: 'session-1' }],
    });
  });
});
