export function streamAsk({ question, sessionId, token }, handlers) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const controller = new AbortController();

  fetch(`${baseUrl}/ask/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, sessionId }),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to start the chat request.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processEvents = () => {
      const events = buffer.replace(/\r\n/g, '\n').split('\n\n');
      buffer = events.pop() || '';
      events.forEach((rawEvent) => {
        const lines = rawEvent.split('\n');
        const eventName = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
        const dataLines = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());
        if (dataLines.length === 0) return;

        const data = JSON.parse(dataLines.join('\n'));
        if (eventName === 'status') handlers.onStatus?.(data.message);
        if (eventName === 'answer_chunk') handlers.onChunk?.(data.text);
        if (eventName === 'done') {
          handlers.onCitations?.(data.citations || []);
          handlers.onDone?.();
        }
        if (eventName === 'error') handlers.onError?.(data.message);
      });
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      processEvents();
      if (done) break;
    }

    // Process an event whose final separator arrived with the stream close.
    if (buffer.trim()) {
      buffer += '\n\n';
      processEvents();
    }
  }).catch((error) => {
    if (error.name !== 'AbortError') handlers.onError?.(error.message);
  });

  return () => controller.abort();
}
