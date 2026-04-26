/**
 * Registry Storage
 *
 * In-memory MFE registry with EventEmitter-based change notifications.
 * Redis storage can be layered on top by setting REGISTRY_STORAGE=redis.
 *
 * Pattern from falese/daemon (ComponentRegistry):
 *   - Map-based storage keyed by MFE name
 *   - EventEmitter for publish/subscribe (registry → WS broadcaster)
 *   - TTL-based eviction optional via REGISTRY_TTL_MS
 */
import { EventEmitter } from 'events';

export interface MFERegistration {
  name: string;
  endpoint: string;
  remoteEntry: string;
  dslEndpoint?: string;
  healthCheck?: string;
  metadata?: Record<string, unknown>;
  registeredAt: string;
  lastSeen: string;
}

export class RegistryStorage extends EventEmitter {
  private entries = new Map<string, MFERegistration>();
  private ttlMs: number;

  constructor() {
    super();
    this.ttlMs = parseInt(process.env.REGISTRY_TTL_MS || '0', 10);
  }

  register(entry: Omit<MFERegistration, 'registeredAt' | 'lastSeen'>): MFERegistration {
    const now = new Date().toISOString();
    const existing = this.entries.get(entry.name);
    const record: MFERegistration = {
      ...entry,
      registeredAt: existing?.registeredAt ?? now,
      lastSeen: now,
    };
    this.entries.set(entry.name, record);

    if (this.ttlMs > 0) {
      setTimeout(() => {
        if (this.entries.get(entry.name)?.lastSeen === record.lastSeen) {
          this.entries.delete(entry.name);
          this.emit('change', { type: 'DEREGISTERED', entry: { name: entry.name } });
        }
      }, this.ttlMs);
    }

    const type = existing ? 'UPDATED' : 'REGISTERED';
    this.emit('change', { type, entry: record });
    console.log(`[registry] ${type} ${entry.name} @ ${entry.endpoint}`);
    return record;
  }

  getAll(): MFERegistration[] {
    return Array.from(this.entries.values());
  }

  get(name: string): MFERegistration | undefined {
    return this.entries.get(name);
  }

  size(): number {
    return this.entries.size;
  }

  delete(name: string): boolean {
    const existed = this.entries.has(name);
    if (existed) {
      const entry = this.entries.get(name);
      this.entries.delete(name);
      this.emit('change', { type: 'DEREGISTERED', entry });
    }
    return existed;
  }
}
