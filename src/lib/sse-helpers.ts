/**
 * Datastar SSE response helpers.
 * Datastar expects SSE events in a specific format:
 * - `datastar-merge-fragments` for HTML fragment updates
 * - `datastar-merge-signals` for signal/state updates
 */

export function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
}

export function mergeFragments(fragments: string, options?: {
  selector?: string;
  mergeMode?: 'morph' | 'inner' | 'outer' | 'prepend' | 'append' | 'before' | 'after' | 'upsertAttributes';
  settleDuration?: number;
  useViewTransition?: boolean;
}): string {
  const lines: string[] = ['event: datastar-merge-fragments'];
  if (options?.selector) lines.push(`data: selector ${options.selector}`);
  if (options?.mergeMode) lines.push(`data: mergeMode ${options.mergeMode}`);
  if (options?.settleDuration) lines.push(`data: settleDuration ${options.settleDuration}`);
  if (options?.useViewTransition) lines.push(`data: useViewTransition true`);
  for (const line of fragments.split('\n')) {
    lines.push(`data: fragments ${line}`);
  }
  lines.push('', '');
  return lines.join('\n');
}

export function mergeSignals(signals: Record<string, unknown>, onlyIfMissing = false): string {
  const lines: string[] = ['event: datastar-merge-signals'];
  if (onlyIfMissing) lines.push('data: onlyIfMissing true');
  lines.push(`data: signals ${JSON.stringify(signals)}`);
  lines.push('', '');
  return lines.join('\n');
}

export function removeFragments(selector: string): string {
  const lines: string[] = [
    'event: datastar-remove-fragments',
    `data: selector ${selector}`,
    '', '',
  ];
  return lines.join('\n');
}

export function removeSignals(paths: string[]): string {
  const lines: string[] = [
    'event: datastar-remove-signals',
    `data: paths ${paths.join(' ')}`,
    '', '',
  ];
  return lines.join('\n');
}

export function sseResponse(body: string): Response {
  return new Response(body, { headers: sseHeaders() });
}
