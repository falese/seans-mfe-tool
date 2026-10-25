/**
 * ShapeProposal Feature Component
 * Merge, split, rename and move — each a named edit, validated before it is applied
 *
 * Nothing here changes the proposal itself: each form sends one named edit
 * (ADR-110 §4) and shows what the CLI answered, a new proposal or the reason it
 * refused (ADR-116 §3).
 */
import React, { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useWorkspace, withWorkspace } from '../workspace/WorkspaceContext';
import type { Edit } from '../workspace/types';

export interface ShapeProposalProps {}

const Section: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <Paper variant="outlined" role="group" aria-label={title} sx={{ p: 2 }}>
    <Typography variant="subtitle1">{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{hint}</Typography>
    <Stack spacing={1.5}>{children}</Stack>
  </Paper>
);

const Choose: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
  <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} SelectProps={{ native: true }} InputLabelProps={{ shrink: true }}>
    <option value="" />
    {options.map((o) => (
      <option key={o} value={o}>{o}</option>
    ))}
  </TextField>
);

const Name: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <TextField size="small" label={label} value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="lower-case-kebab" InputLabelProps={{ shrink: true }} />
);

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

const ShapeProposalView: React.FC<ShapeProposalProps> = () => {
  const { status, error, busy, apply } = useWorkspace();
  const [rename, setRename] = useState({ from: '', to: '' });
  const [merge, setMerge] = useState<{ domains: string[]; into: string }>({ domains: [], into: '' });
  const [split, setSplit] = useState<{ domain: string; files: string[]; into: string }>({ domain: '', files: [], into: '' });
  const [move, setMove] = useState({ file: '', to: '' });
  if (!status) return <LinearProgress aria-label="Loading the proposal" />;

  const domains = status.document.domains;
  const ids = domains.map((d) => d.id);
  const allFiles = [...domains.flatMap((d) => d.files), ...status.document.shared.map((s) => s.file)].sort();
  const splitFrom = domains.find((d) => d.id === split.domain);

  /** Send one edit; clear the form only when it applied. */
  const send = async (edit: Edit, reset: () => void) => {
    if (await apply([edit])) reset();
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" role="alert">{error}</Alert>}

      <Section title="Rename a domain" hint="Its MFE, routes, slots and tests follow the new name.">
        <Choose label="Domain" value={rename.from} options={ids} onChange={(from) => setRename({ ...rename, from })} />
        <Name label="New name" value={rename.to} onChange={(to) => setRename({ ...rename, to })} />
        <Box>
          <Button variant="contained" disabled={busy || !rename.from || !rename.to} onClick={() => void send({ kind: 'rename-domain', from: rename.from, to: rename.to }, () => setRename({ from: '', to: '' }))}>
            Rename
          </Button>
        </Box>
      </Section>

      <Section title="Merge domains" hint="One team will own all of them: files, data and screens move together.">
        <Stack direction="row" flexWrap="wrap" useFlexGap>
          {ids.map((id) => (
            <FormControlLabel key={id} label={id} control={<Checkbox size="small" checked={merge.domains.includes(id)} onChange={() => setMerge({ ...merge, domains: toggle(merge.domains, id) })} />} />
          ))}
        </Stack>
        <Name label="Into" value={merge.into} onChange={(into) => setMerge({ ...merge, into })} />
        <Box>
          <Button variant="contained" disabled={busy || merge.domains.length < 2 || !merge.into} onClick={() => void send({ kind: 'merge-domains', domains: merge.domains, into: merge.into }, () => setMerge({ domains: [], into: '' }))}>
            Merge
          </Button>
        </Box>
      </Section>

      <Section title="Split a domain" hint="The files you tick become a new domain, with the data they call.">
        <Choose label="Domain" value={split.domain} options={ids} onChange={(domain) => setSplit({ domain, files: [], into: split.into })} />
        {splitFrom && (
          <Stack>
            {splitFrom.files.map((f) => (
              <FormControlLabel key={f} label={<Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{f}</Typography>} control={<Checkbox size="small" inputProps={{ 'aria-label': f }} checked={split.files.includes(f)} onChange={() => setSplit({ ...split, files: toggle(split.files, f) })} />} />
            ))}
          </Stack>
        )}
        <Name label="New domain" value={split.into} onChange={(into) => setSplit({ ...split, into })} />
        <Box>
          <Button variant="contained" disabled={busy || !split.domain || split.files.length === 0 || !split.into} onClick={() => void send({ kind: 'split-domain', domain: split.domain, into: split.into, files: split.files }, () => setSplit({ domain: '', files: [], into: '' }))}>
            Split
          </Button>
        </Box>
      </Section>

      <Section title="Move a file" hint="A component's screens and data move with its file. Shared files can be given an owner.">
        <Choose label="File" value={move.file} options={allFiles} onChange={(file) => setMove({ ...move, file })} />
        <Choose label="To" value={move.to} options={[...ids, 'shared']} onChange={(to) => setMove({ ...move, to })} />
        <Box>
          <Button variant="contained" disabled={busy || !move.file || !move.to} onClick={() => void send({ kind: 'move-file', file: move.file, to: move.to }, () => setMove({ file: '', to: '' }))}>
            Move
          </Button>
        </Box>
      </Section>
    </Stack>
  );
};

export const ShapeProposal = withWorkspace(ShapeProposalView);

export default ShapeProposal;
