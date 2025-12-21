
import { testmonorepovalidationMFE } from './mfe';
import { Context } from 'platform-runtime';

describe('testmonorepovalidationMFE', () => {
  let mfe: testmonorepovalidationMFE;
  let manifest: any;
  let context: Context;

  beforeEach(() => {
    manifest = {
  "name": "test-monorepo-validation",
  "version": "1.0.0",
  "type": "remote",
  "language": "typescript",
  "description": "",
  "endpoint": "http://localhost:3001",
  "remoteEntry": "http://localhost:3001/remoteEntry.js",
  "discovery": "http://localhost:3001/.well-known/mfe-manifest.yaml",
  "capabilities": [],
  "dependencies": {
    "runtime": {
      "react": "^18.0.0",
      "react-dom": "^18.0.0"
    },
    "design-system": {
      "@mui/material": "^5.14.0"
    }
  }
};
    mfe = new testmonorepovalidationMFE(manifest);
    context = { timestamp: new Date(), requestId: 'test' };
  });

  it('should instantiate without error', () => {
    expect(mfe).toBeInstanceOf(testmonorepovalidationMFE);
  });

  

  
});
