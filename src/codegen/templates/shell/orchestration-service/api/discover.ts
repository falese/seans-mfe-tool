/**
 * GET /api/discover
 *
 * Shell runtime polls this endpoint for the current MFE registry snapshot.
 * The shell also subscribes via WebSocket for push-based updates (ADR-011).
 */
import type { Request, Response } from 'express';
import type { RegistryStorage } from '../registry/storage';

export function discoverHandler(storage: RegistryStorage) {
  return (_req: Request, res: Response) => {
    const entries = storage.getAll();
    return res.json({
      entries,
      count: entries.length,
      timestamp: new Date().toISOString(),
    });
  };
}
