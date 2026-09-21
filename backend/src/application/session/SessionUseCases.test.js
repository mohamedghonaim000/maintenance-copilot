const SessionUseCases = require('./SessionUseCases');

describe('SessionUseCases', () => {
  test('adds a message using the authenticated user context', async () => {
    const repository = {
      addMessage: jest.fn().mockResolvedValue({ id: 'message-1' }),
    };
    const useCases = new SessionUseCases(repository);

    await expect(useCases.addMessage({
      sessionId: 'session-1',
      userId: 'user-1',
      role: 'user',
      content: 'What is the pressure limit?',
    })).resolves.toEqual({ id: 'message-1' });

    expect(repository.addMessage).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
      runId: null,
      role: 'user',
      content: 'What is the pressure limit?',
    });
  });

  test('rejects invalid message roles', async () => {
    const repository = { addMessage: jest.fn() };
    const useCases = new SessionUseCases(repository);

    await expect(useCases.addMessage({
      sessionId: 'session-1',
      userId: 'user-1',
      role: 'admin',
      content: 'unexpected',
    })).rejects.toThrow('role must be user, assistant, system, or tool');
    expect(repository.addMessage).not.toHaveBeenCalled();
  });

  test('deletes only through the authenticated user context', async () => {
    const repository = {
      deleteSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    };
    const useCases = new SessionUseCases(repository);

    await expect(useCases.deleteSession({
      sessionId: 'session-1',
      userId: 'user-1',
    })).resolves.toEqual({ id: 'session-1' });

    expect(repository.deleteSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'user-1',
    });
  });
});