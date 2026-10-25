/**
 * ProposalMap Feature Component
 * The captured screens with each proposed domain outlined, and the evidence behind the selected domain
 *
 * The same overlay `decompose:present` draws (ADR-110 §3), live: boxes are
 * positioned as percentages of the captured viewport, so the screenshot scales
 * and the boxes stay on what they outline.
 */
import React, { useState } from 'react';
import { Alert, Box, Chip, LinearProgress, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useWorkspace, withWorkspace } from '../workspace/WorkspaceContext';
import type { Domain, ProposalStatus, Rect } from '../workspace/types';

export interface ProposalMapProps {
  /** Start on this screen path instead of the first captured one. */
  initialPath?: string;
}

const pct = (n: number, of: number) => `${(100 * n) / of}%`;
const place = (r: Rect, w: number, h: number) => ({ left: pct(r.x, w), top: pct(r.y, h), width: pct(r.width, w), height: pct(r.height, h) });

const SIGNALS = ['route', 'data', 'imports', 'runtime', 'cochange', 'ownership'];

function DomainPanel({ domain, status, color }: { domain: Domain; status: ProposalStatus; color: string }) {
  const reads = status.document.couplings.filter((c) => c.domain === domain.id);
  const readBy = status.document.couplings.filter((c) => c.owner === domain.id);
  const name = (f: string) => f.split('/').pop();
  return (
    <Paper component="section" aria-label={`Domain ${domain.id}`} variant="outlined" sx={{ p: 2, borderLeft: `4px solid ${color}` }}>
      <Typography variant="h6">{domain.id}</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {domain.mfe}
        {domain.shell ? ' · the shell every domain composes into' : ''}
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 1 }}>Data</Typography>
      <Typography variant="body2">{domain.backends.length > 0 ? domain.backends.join(', ') : 'no backend of its own'}</Typography>
      {domain.endpoints.map((e) => (
        <Typography key={e} variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>{e}</Typography>
      ))}
      <Typography variant="subtitle2" sx={{ mt: 1 }}>Evidence</Typography>
      {SIGNALS.map((s) => {
        const v = domain.evidence[s];
        return (
          <Stack key={s} direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ width: 140 }}>{`${s} ${v === null || v === undefined ? '–' : v.toFixed(2)}`}</Typography>
            <LinearProgress variant="determinate" value={(v ?? 0) * 100} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
          </Stack>
        );
      })}
      {domain.reasons.map((r) => (
        <Typography key={r} variant="body2" sx={{ mt: 0.5 }}>• {r}</Typography>
      ))}
      {(reads.length > 0 || readBy.length > 0) && <Typography variant="subtitle2" sx={{ mt: 1 }}>Couplings</Typography>}
      {reads.map((c) => (
        <Alert key={`${c.file}-${c.field}`} severity="warning" sx={{ mt: 0.5, py: 0 }}>{`${name(c.file)} reads ${c.owner}’s ${c.field}`}</Alert>
      ))}
      {readBy.map((c) => (
        <Alert key={`by-${c.file}-${c.field}`} severity="info" sx={{ mt: 0.5, py: 0 }}>{`${c.domain} reads this domain’s ${c.field} (${name(c.file)})`}</Alert>
      ))}
      <Typography variant="subtitle2" sx={{ mt: 1 }}>Files</Typography>
      {domain.files.map((f) => (
        <Typography key={f} variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>{f}</Typography>
      ))}
    </Paper>
  );
}

const ProposalMapView: React.FC<ProposalMapProps> = ({ initialPath }) => {
  const { status, client } = useWorkspace();
  const [path, setPath] = useState<string | undefined>(initialPath);
  const [selected, setSelected] = useState<string | null>(null);
  if (!status) return <LinearProgress aria-label="Loading the proposal" />;

  const screens = status.screens?.screens ?? [];
  const colors = new Map((status.screens?.legend ?? []).map((l) => [l.domain, l.color]));
  const current = screens.find((s) => s.path === path) ?? screens[0];
  const domain = status.document.domains.find((d) => d.id === selected);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {status.document.domains.map((d) => (
          <Chip
            key={d.id}
            label={d.id}
            onClick={() => setSelected(d.id)}
            variant={selected === d.id ? 'filled' : 'outlined'}
            sx={{ borderColor: colors.get(d.id), ...(selected === d.id ? { bgcolor: colors.get(d.id), color: '#fff' } : {}) }}
          />
        ))}
      </Stack>

      {screens.length === 0 ? (
        <Alert severity="info">No captured screens: run decompose:capture, then open the workspace on that bundle's proposal.</Alert>
      ) : (
        <>
          <Tabs value={current.path} onChange={(_e, v: string) => setPath(v)} variant="scrollable" aria-label="Captured screens">
            {screens.map((s) => (
              <Tab key={s.path} value={s.path} label={s.path} />
            ))}
          </Tabs>
          <Box sx={{ position: 'relative', width: '100%', lineHeight: 0, border: 1, borderColor: 'divider' }}>
            <img src={client.screenshotUrl(current.screenshot)} alt={`Screen ${current.path}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
            {current.boxes.map((b, i) => (
              <Box
                key={`${b.domain}-${i}`}
                component="button"
                type="button"
                aria-label={b.label}
                title={b.label}
                onClick={() => setSelected(b.domain)}
                sx={{
                  position: 'absolute',
                  ...place(b.rect, current.width, current.height),
                  border: `2px solid ${b.color}`,
                  outline: selected === b.domain ? `3px solid ${b.color}` : 'none',
                  background: selected === b.domain ? `${b.color}33` : 'transparent',
                  cursor: 'pointer',
                  p: 0,
                }}
              >
                <Box component="span" sx={{ position: 'absolute', top: 0, left: 0, bgcolor: b.color, color: '#fff', fontSize: 11, lineHeight: 1.4, px: 0.5, maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {b.label}
                </Box>
              </Box>
            ))}
            {current.couplings.map((c) => (
              <Box key={c.file} sx={{ position: 'absolute', ...place(c.rect, current.width, current.height), border: '2px dashed #e11d48', pointerEvents: 'none' }}>
                <Box component="span" sx={{ position: 'absolute', bottom: 0, left: 0, bgcolor: '#e11d48', color: '#fff', fontSize: 11, lineHeight: 1.4, px: 0.5, whiteSpace: 'nowrap' }}>
                  {c.label}
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}

      {domain ? (
        <DomainPanel domain={domain} status={status} color={colors.get(domain.id) ?? '#888'} />
      ) : (
        <Typography variant="body2" color="text.secondary">Pick a box or a domain to see why its boundary is where it is.</Typography>
      )}
    </Stack>
  );
};

export const ProposalMap = withWorkspace(ProposalMapView);

export default ProposalMap;
