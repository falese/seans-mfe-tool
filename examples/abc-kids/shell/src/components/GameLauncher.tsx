import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton, CircularProgress, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PetsIcon from '@mui/icons-material/Pets';
import { GameMeta } from '../App';

// Minimal type for a pet returned by the PetStore BFF
interface Pet { id: string; name: string; status?: string; }

interface GameLauncherProps {
  game: GameMeta;
  onClose: () => void;
}

const GameLauncher: React.FC<GameLauncherProps> = ({ game, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [bffMode, setBffMode] = useState<'live' | 'mock'>('live');
  const mfeRef = useRef<any>(null);
  const containerId = `mfe-game-${game.id}`;

  // Escape key handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Re-usable pet fetch — passes x-bff-mode header so the BFF mock switch (ADR-052)
  // can return live upstream data or deterministic fixtures from mocks.json.
  const fetchPets = useCallback(async (mode: 'live' | 'mock') => {
    const mfe = mfeRef.current;
    if (!mfe || game.id !== 'flappy') return;
    try {
      const queryResult = await mfe.query({
        requestId: `query-pets-${Date.now()}`,
        timestamp: new Date(),
        headers: { 'x-bff-mode': mode },
        inputs: {
          document: `query ListPets { listPets { id name status } }`,
          bffUrl: 'http://localhost:3001/graphql',
        },
      });
      const fetched = (queryResult.data as { listPets?: Pet[] })?.listPets ?? [];
      setPets(fetched);
    } catch {
      // BFF not running in dev — pet panel stays empty, game still works
    }
  }, [game.id]);

  // MFE render lifecycle
  useEffect(() => {
    let cancelled = false;
    let mfeInstance: { unmount?: (id: string) => void } | null = null;

    (async () => {
      try {
        setIsLoading(true);
        setRenderError(null);

        let remote: { mfe: any; mfeReady: Promise<void> };
        if (game.id === 'flappy') {
          remote = await import('abcKidsFlappy/App');
        } else if (game.id === 'hockey') {
          remote = await import('abcKidsHockey/App');
        } else if (game.id === 'multiplication-quiz') {
          remote = await import('abcKidsMultiplicationQuiz/Component');
        } else {
          throw new Error(`Unknown game: ${game.id}`);
        }

        const { mfe, mfeReady } = remote;
        mfeInstance = mfe;
        mfeRef.current = mfe;

        // Wait for mfe.load() (started in bootstrap) to complete
        await mfeReady;

        if (cancelled) return;

        // Re-entry guard: if load failed or another render is in progress, bail
        if (mfe.getState() !== 'ready') {
          throw new Error(`MFE not ready — state: ${mfe.getState()}`);
        }

        await mfe.render({
          requestId: `render-${game.id}-${Date.now()}`,
          timestamp: new Date(),
          inputs: {
            component: 'PlayGame',
            containerId,
          },
        });

        if (!cancelled) {
          setIsLoading(false);
          // Initial pet fetch uses the current mode (live by default)
          await fetchPets('live');
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`[GameLauncher] Failed to render ${game.id}:`, err);
          setRenderError((err as Error).message);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      mfeRef.current = null;
      mfeInstance?.unmount?.(containerId);
    };
  }, [game.id, containerId, fetchPets]);

  // Re-fetch pets whenever the Live/Mock toggle changes (only if MFE is ready)
  useEffect(() => {
    if (mfeRef.current) {
      void fetchPets(bffMode);
    }
  }, [bffMode, fetchPets]);

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: 500,
        bgcolor: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          bgcolor: '#1a0050',
          borderRadius: 4,
          width: '95vw', maxWidth: 720,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 0 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2.5, py: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" sx={{ color: '#FFD700' }}>
              {game.emoji}&nbsp;&nbsp;{game.title}
            </Typography>
            {/* Pet count badge — populated by mfe.query() via PetStore BFF */}
            {pets.length > 0 && (
              <Chip
                icon={<PetsIcon sx={{ fontSize: 14 }} />}
                label={`${pets.length} pet${pets.length !== 1 ? 's' : ''}`}
                size="small"
                title={pets.map(p => p.name).join(', ')}
                sx={{
                  bgcolor: 'rgba(255, 215, 0, 0.15)',
                  color: '#FFD700',
                  border: '1px solid rgba(255, 215, 0, 0.4)',
                  fontSize: 11,
                  cursor: 'default',
                }}
              />
            )}
            {/* Live/Mock toggle — only for games with a PetStore BFF (ADR-052) */}
            {game.id === 'flappy' && (
              <ToggleButtonGroup
                value={bffMode}
                exclusive
                onChange={(_e, val: 'live' | 'mock' | null) => { if (val) setBffMode(val); }}
                size="small"
                sx={{ height: 24 }}
              >
                <ToggleButton
                  value="live"
                  sx={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 10, px: 1, py: 0,
                    border: '1px solid rgba(255,255,255,0.2)',
                    '&.Mui-selected': { color: '#4caf50', borderColor: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                  }}
                >
                  Live
                </ToggleButton>
                <ToggleButton
                  value="mock"
                  sx={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 10, px: 1, py: 0,
                    border: '1px solid rgba(255,255,255,0.2)',
                    '&.Mui-selected': { color: '#ff9800', borderColor: '#ff9800', bgcolor: 'rgba(255,152,0,0.1)' },
                  }}
                >
                  Mock
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: '#fff',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '50%',
              '&:hover': { borderColor: '#FF6B6B', color: '#FF6B6B' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Game body */}
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, position: 'relative' }}>
          {isLoading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8 }}>
              <CircularProgress sx={{ color: '#FFD700' }} size={56} />
              <Typography sx={{ color: '#aaa' }}>Loading {game.title}…</Typography>
            </Box>
          )}
          {renderError && !isLoading && (
            <Box sx={{ p: 3 }}>
              <Typography sx={{ color: '#FF6B6B' }}>Failed to load {game.title}</Typography>
              <Typography sx={{ color: '#aaa', fontSize: 12, mt: 1 }}>{renderError}</Typography>
            </Box>
          )}
          {/* MFE mounts React/Angular into this div via mfe.render() */}
          <div
            id={containerId}
            ref={containerRef}
            style={{ width: '100%', height: '100%', display: isLoading || renderError ? 'none' : 'block' }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default GameLauncher;
