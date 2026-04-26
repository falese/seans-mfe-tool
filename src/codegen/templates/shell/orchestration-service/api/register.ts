/**
 * POST /api/register
 *
 * Remote MFEs call this endpoint on startup to announce themselves.
 * Pattern from falese/daemon: push-based, fire-and-forget from the remote's side.
 */
import type { Request, Response } from 'express';
import type { RegistryStorage } from '../registry/storage';

export function registerHandler(storage: RegistryStorage, broadcast: (msg: unknown) => void) {
  return (req: Request, res: Response) => {
    const { name, endpoint, remoteEntry, dslEndpoint, healthCheck, metadata } = req.body ?? {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({ error: 'endpoint is required' });
    }
    if (!remoteEntry || typeof remoteEntry !== 'string') {
      return res.status(400).json({ error: 'remoteEntry is required' });
    }

    const record = storage.register({ name, endpoint, remoteEntry, dslEndpoint, healthCheck, metadata });
    return res.status(200).json({ success: true, entry: record });
  };
}
