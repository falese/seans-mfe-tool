import { uuidv4 } from '../util/uuid';

// RFC4122 v4: 8-4-4-4-12 hex, with the 13th nibble forced to '4' and the
// 17th nibble forced to one of {8,9,a,b}.
const V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv4', () => {
  let originalCrypto: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  });

  afterEach(() => {
    if (originalCrypto) {
      Object.defineProperty(globalThis, 'crypto', originalCrypto);
    } else {
      // Restoring an unset descriptor is best-effort.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).crypto;
    }
  });

  it('delegates to globalThis.crypto.randomUUID when available', () => {
    const fake = jest.fn().mockReturnValue('11111111-2222-4333-8444-555555555555');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: fake },
    });

    const id = uuidv4();

    expect(fake).toHaveBeenCalledTimes(1);
    expect(id).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('falls back to a Math.random RFC4122 v4 when crypto.randomUUID is unavailable', () => {
    // Remove the global crypto.randomUUID so the fallback branch executes.
    // Defining as an empty object covers the `g.crypto?.randomUUID` branch
    // where crypto exists but randomUUID does not.
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });

    const id = uuidv4();

    expect(id).toMatch(V4_REGEX);
  });

  it('falls back when globalThis.crypto itself is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).crypto;

    const id = uuidv4();

    expect(id).toMatch(V4_REGEX);
  });

  it('produces distinct IDs across calls (sanity check on Math.random branch)', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });

    const ids = new Set<string>();
    for (let i = 0; i < 16; i++) {
      ids.add(uuidv4());
    }
    expect(ids.size).toBe(16);
  });
});
