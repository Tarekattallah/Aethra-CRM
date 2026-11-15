import { RequestHandler } from 'express';

// The current SSE deployment is a single Node process. Serialize lead mutations
// so deduplication and capacity checks remain valid until the write completes.
let tail: Promise<void> = Promise.resolve();
let pending = 0;
export async function acquireLeadMutation(): Promise<() => void> {
  if (pending >= 100) throw Object.assign(new Error('Lead queue full'), { status: 503 });
  pending++;
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  let released = false;
  return () => { if (!released) { released = true; pending--; release(); } };
}

export function serializeLeadMutation(handler: RequestHandler): RequestHandler {
  return async (req, res, next): Promise<void> => {
    try {
      const release = await acquireLeadMutation();
      try { if (!res.destroyed) await handler(req, res, next); }
      finally { release(); }
    } catch (error) { next(error); }
  };
}
