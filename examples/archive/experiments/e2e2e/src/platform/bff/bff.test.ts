
import { startBFFServer } from './bff';

describe('BFF Layer', () => {
  it('should start BFF server without error', async () => {
    await expect(startBFFServer(4000)).resolves.not.toThrow();
  });
});
