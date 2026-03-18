import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/env';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Get all elements for a room
app.get('/api/rooms/:roomId/elements', async (c) => {
  const roomId = c.req.param('roomId');
  const id = c.env.DRAWING_ROOM.idFromName(roomId);
  const stub = c.env.DRAWING_ROOM.get(id);

  const res = await stub.fetch(new Request('https://do/elements'));
  const elements = await res.json();
  return c.json(elements);
});

// Update elements for a room
app.put('/api/rooms/:roomId/elements', async (c) => {
  const roomId = c.req.param('roomId');
  const id = c.env.DRAWING_ROOM.idFromName(roomId);
  const stub = c.env.DRAWING_ROOM.get(id);

  const body = await c.req.json();
  const res = await stub.fetch(new Request('https://do/elements', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  const result = await res.json();
  return c.json(result);
});

// Export room as JSON
app.get('/api/rooms/:roomId/export', async (c) => {
  const roomId = c.req.param('roomId');
  const id = c.env.DRAWING_ROOM.idFromName(roomId);
  const stub = c.env.DRAWING_ROOM.get(id);

  const res = await stub.fetch(new Request('https://do/elements'));
  const elements = await res.json();

  return c.json({
    type: 'excalidraw',
    version: 2,
    elements,
    appState: { viewBackgroundColor: '#ffffff' },
  });
});

export default app;
