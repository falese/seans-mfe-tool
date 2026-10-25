import { attributeRequests, distinctiveValues, initiatorFiles, type CdpStackTrace } from '../attribution';
import type { Region } from '../regions';

const region = (id: string, file: string | null, ownText: string): Region => ({
  id,
  component: id.split('#')[1] ?? id,
  file,
  landmark: 'main',
  parent: null,
  rect: { x: 0, y: 0, width: 1, height: 1 },
  ownText,
  data: {},
});

describe('initiatorFiles', () => {
  it('collects app source files across the async stack, outermost last, without duplicates', () => {
    const stack: CdpStackTrace = {
      callFrames: [{ url: 'webpack-internal:///./node_modules/axios/lib/adapters/xhr.js' }],
      parent: {
        callFrames: [{ url: 'webpack-internal:///./src/api/client.ts' }, { url: 'webpack-internal:///./src/api/client.ts' }],
        parent: { callFrames: [{ url: 'webpack-internal:///./src/store/AppContext.tsx' }] },
      },
    };
    expect(initiatorFiles(stack)).toEqual(['src/api/client.ts', 'src/store/AppContext.tsx']);
  });

  it('returns nothing for a request with no script initiator', () => {
    expect(initiatorFiles(undefined)).toEqual([]);
  });
});

describe('distinctiveValues', () => {
  it('collects leaf strings worth matching, skipping short, boolean-ish and timestamp values', () => {
    const body = {
      Data: [
        { VendorName: 'Nebula Noodles', Status: 'OK', CreatedAt: '2026-10-03T15:40:00.000Z', Id: 7 },
        { VendorName: 'Ion Grill', Zone: 'ring-b', Flag: 'true' },
      ],
    };
    expect(distinctiveValues(body).sort()).toEqual(['Ion Grill', 'Nebula Noodles', 'ring-b']);
  });

  it('keeps identifier fields and drops category fields, judged by how many distinct values a field has', () => {
    const body = [
      // The same vessel docks twice: its registry number still identifies it.
      { vessel: 'VR-88213', status: 'DOCKED', berthClass: 'Medium Freight' },
      { vessel: 'VR-88213', status: 'DEPARTED', berthClass: 'Medium Freight' },
      { vessel: 'VR-10442', status: 'DOCKED', berthClass: 'Light Shuttle' },
      { vessel: 'VR-55120', status: 'APPROACH', berthClass: 'Medium Freight' },
    ];
    expect(distinctiveValues(body).sort()).toEqual(['VR-10442', 'VR-55120', 'VR-88213']);
  });
});

describe('attributeRequests', () => {
  const requests = [
    { id: 'r1', initiator: ['src/api/client.ts', 'src/store/AppContext.tsx'], values: ['VR-88213', 'Kestrel'] },
    { id: 'r2', initiator: ['src/api/client.ts', 'src/pages/ConcoursePage.tsx'], values: ['Nebula Noodles'] },
  ];

  it('attributes a request to the region whose component initiated it', () => {
    const regions = [region('src/pages/ConcoursePage.tsx#ConcoursePage', 'src/pages/ConcoursePage.tsx', 'Concourse')];
    expect(attributeRequests(requests, regions)).toEqual([
      { request: 'r2', region: 'src/pages/ConcoursePage.tsx#ConcoursePage', via: 'initiator' },
    ]);
  });

  it('attributes a request to every region that displays its data, case-insensitively', () => {
    const regions = [
      region('src/components/DockingBoard.tsx#DockingBoard', 'src/components/DockingBoard.tsx', 'b1 vr-88213 docked'),
      region('src/pages/ConcoursePage.tsx#ConcoursePage', 'src/pages/ConcoursePage.tsx', 'Nebula Noodles · ring-b'),
    ];
    expect(attributeRequests(requests, regions)).toEqual([
      { request: 'r1', region: 'src/components/DockingBoard.tsx#DockingBoard', via: 'data' },
      { request: 'r2', region: 'src/pages/ConcoursePage.tsx#ConcoursePage', via: 'data' },
      { request: 'r2', region: 'src/pages/ConcoursePage.tsx#ConcoursePage', via: 'initiator' },
    ]);
  });

  it('does not match a value inside a longer word', () => {
    const regions = [region('src/X.tsx#X', 'src/X.tsx', 'Kestrels flew by')];
    expect(attributeRequests(requests, regions)).toEqual([]);
  });
});
