import React from 'react';
import { mfe } from '../../platform/base-mfe/bootstrap';
import { DeclaredSlot } from '../../slots';

/**
 * GameMenu — the ABC Kids home (ADR-058). Renders a tile per registered game in
 * its own menu region, and contributes the 'main' and 'info' regions to the
 * host through `DeclaredSlot` — the generated, manifest-typed registration
 * component (ADR-067/ADR-072) — so selected games compose alongside the menu.
 * A tile drives the control plane via the inherited BaseMFE platform capability
 * updateControlPlaneState (ADR-057) — no direct knowledge of any game.
 */
interface Game {
  id: string;
  title: string;
  emoji?: string;
  color?: string;
}

interface GameMenuProps {
  /** Catalog injected by the registry root rule (ADR-058). */
  games?: Game[];
  /** Host callback to contribute or release a slot element (ADR-058). */
  provideSlot?: (slotId: string, element: HTMLElement | null) => void;
}

// Narrow view of the MFE's inherited platform capability — avoids importing the
// full Context type into example feature code.
type ControlPlane = {
  updateControlPlaneState(ctx: {
    requestId: string;
    timestamp: Date;
    inputs: { stateKey: string };
  }): Promise<unknown>;
};

function dispatch(verb: 'play' | 'show', id: string): void {
  const cp = mfe as unknown as ControlPlane;
  void cp.updateControlPlaneState({
    requestId: verb + '-' + id + '-' + Date.now(),
    timestamp: new Date(),
    inputs: { stateKey: 'abc.' + verb + '.' + id },
  });
}

export const GameMenu: React.FC<GameMenuProps> = ({ games = [], provideSlot }) => {
  // The two contributed regions are registered by DeclaredSlot below (ADR-072).
  // Its `id` is typed by the manifest (DeclaredSlotId), so a region id the
  // manifest does not declare fails the build; assertDeclared still runs on
  // every bind as the runtime backstop. `as` keeps the semantic element.
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 280px) 1fr minmax(220px, 300px)',
        gap: 16,
        minHeight: '90vh',
        padding: 16,
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f6f4fb',
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <header>
          <h1 style={{ margin: '4px 0', fontSize: 28 }}>🧸 ABC Kids</h1>
          <p style={{ margin: 0, color: '#666' }}>Pick a game to play</p>
        </header>
        <div style={{ display: 'grid', gap: 10 }} role="list">
          {games.map((g) => (
            <div
              key={g.id}
              role="listitem"
              onClick={() => dispatch('play', g.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                cursor: 'pointer',
                color: '#fff',
                background: g.color || '#5e35b1',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <span style={{ fontSize: 26 }}>{g.emoji || '🎮'}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{g.title}</span>
              <button
                aria-label={'About ' + g.title}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch('show', g.id);
                }}
                style={{
                  border: 'none',
                  borderRadius: '50%',
                  width: 26,
                  height: 26,
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.25)',
                  color: '#fff',
                }}
              >
                {'\u2139'}
              </button>
            </div>
          ))}
          {games.length === 0 && (
            <p style={{ color: '#999' }}>No games registered yet — run ./scripts/register-games.sh</p>
          )}
        </div>
      </nav>

      {/* Contributed to the host as slot 'main' — the selected game mounts here. */}
      <DeclaredSlot
        id="main"
        provideSlot={provideSlot}
        as="section"
        aria-label="game"
        style={{
          borderRadius: 16,
          background: '#fff',
          boxShadow: 'inset 0 0 0 1px #e6e1f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#bbb',
        }}
      >
        Select a game from the menu
      </DeclaredSlot>

      {/* Contributed to the host as slot 'info' — cover / game info mounts here. */}
      <DeclaredSlot
        id="info"
        provideSlot={provideSlot}
        as="aside"
        aria-label="info"
        style={{
          borderRadius: 16,
          background: '#fff',
          boxShadow: 'inset 0 0 0 1px #e6e1f2',
          padding: 12,
          color: '#bbb',
        }}
      >
        Tap the info button on a game for details
      </DeclaredSlot>
    </div>
  );
};

export default GameMenu;
