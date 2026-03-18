import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/env';
import { sseResponse, mergeSignals, mergeFragments } from '../lib/sse-helpers';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Tool selection SSE endpoint
app.get('/sse/tool/:tool', (c) => {
  const tool = c.req.param('tool');
  return sseResponse(
    mergeSignals({ activeTool: tool })
  );
});

// Property update SSE endpoint
app.post('/sse/property', async (c) => {
  const body = await c.req.json();
  const { property, value } = body;
  return sseResponse(
    mergeSignals({ [property]: value })
  );
});

// Zoom SSE endpoint
app.get('/sse/zoom/:level', (c) => {
  const level = parseInt(c.req.param('level'));
  return sseResponse(
    mergeSignals({ zoom: level })
  );
});

// Selection update SSE endpoint
app.post('/sse/selection', async (c) => {
  const body = await c.req.json();
  return sseResponse(
    mergeSignals({
      selectedCount: body.count,
      strokeColor: body.strokeColor,
      backgroundColor: body.backgroundColor,
      fillStyle: body.fillStyle,
      strokeWidth: body.strokeWidth,
      strokeStyle: body.strokeStyle,
      roughness: body.roughness,
      opacity: body.opacity,
    })
  );
});

export default app;
