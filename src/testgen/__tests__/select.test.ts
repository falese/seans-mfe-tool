import type { Region } from '../../decompose/regions';
import { capabilityView, rectIn } from '../select';

const r = (id: string, component: string, parent: string | null, ownText = '', rect = { x: 0, y: 0, width: 10, height: 10 }, data: Record<string, string> = {}): Region => ({
  id,
  component,
  file: `src/${component}.tsx`,
  landmark: null,
  parent,
  rect,
  ownText,
  data,
});

describe('capabilityView', () => {
  const regions = [
    r('App', 'App', null, 'Meridian', { x: 0, y: 0, width: 1000, height: 800 }),
    r('Sidebar', 'Sidebar', 'App', 'Docking Cargo'),
    r('BerthStrip', 'BerthStrip', 'App'),
    r('BerthTile@0', 'BerthTile', 'BerthStrip', 'B-1 FREE'),
    r('DockingBoard', 'DockingBoard', 'App', 'Docking board', { x: 200, y: 100, width: 600, height: 400 }),
    r('Row@0', 'DockingRow', 'DockingBoard', 'MV Vega'),
  ];

  it('takes a capability’s root and everything it draws, stopping at another placed capability', () => {
    const v = capabilityView(regions, { name: 'App', component: 'App' }, new Set(['App', 'DockingBoard']));
    expect(v.regions.map((x) => x.id)).toEqual(['App', 'Sidebar', 'BerthStrip', 'BerthTile@0']);
    expect(v.exclude).toEqual([{ x: 200, y: 100, width: 600, height: 400 }]);
    expect(v.rect).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });

  it('finds a placed capability nested in the shell’s tree', () => {
    const v = capabilityView(regions, { name: 'DockingBoard', component: 'DockingBoard' }, new Set(['App', 'DockingBoard']));
    expect(v.regions.map((x) => x.id)).toEqual(['DockingBoard', 'Row@0']);
    expect(v.exclude).toEqual([]);
  });

  it('finds a capability by its boundary stamp when no component matches (#408)', () => {
    const stamped = [r('Slot', 'DeclaredSlot', null, '', undefined, { 'data-smt-capability': 'Board' }), r('Inner', 'Inner', 'Slot', 'hello')];
    const v = capabilityView(stamped, { name: 'Board', component: 'Nope' }, new Set());
    expect(v.regions.map((x) => x.id)).toEqual(['Slot', 'Inner']);
  });

  it('is empty when the capability is not on screen', () => {
    expect(capabilityView(regions, { name: 'Crew', component: 'CrewRoster' }, new Set()).regions).toEqual([]);
  });
});

describe('rectIn', () => {
  it('rounds outwards to whole pixels and clips to the viewport', () => {
    expect(rectIn({ x: 10.4, y: 20.6, width: 100.2, height: 50 }, { width: 100, height: 60 })).toEqual({ x: 10, y: 20, width: 90, height: 40 });
  });
  it('is null when nothing is left on screen', () => {
    expect(rectIn({ x: 0, y: 900, width: 100, height: 50 }, { width: 100, height: 800 })).toBeNull();
    expect(rectIn({ x: 0, y: 0, width: 0, height: 50 }, { width: 100, height: 800 })).toBeNull();
  });
});
