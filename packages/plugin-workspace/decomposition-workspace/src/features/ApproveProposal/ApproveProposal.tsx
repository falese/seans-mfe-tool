/**
 * ApproveProposal Feature Component
 * The summary a product owner approves — domains, data, couplings, comments — and the approval itself
 *
 * Approval records who, when, and a hash of what the proposal decides
 * (ADR-116 §5); a later change to the domains makes it stale, a comment does not.
 */
import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useWorkspace, withWorkspace } from '../workspace/WorkspaceContext';

export interface ApproveProposalProps {}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const when = (at?: string) => (at ? new Date(at).toLocaleString() : '');

const ApproveProposalView: React.FC<ApproveProposalProps> = () => {
  const { status, error, busy, apply } = useWorkspace();
  const [comment, setComment] = useState('');
  if (!status) return <LinearProgress aria-label="Loading the proposal" />;

  const { document: doc, approval, validation } = status;
  const problems = [
    ...Object.entries(validation.manifests).flatMap(([mfe, errs]) => errs.map((e) => `${mfe}: ${e}`)),
    ...validation.composition.map((c) => `composition: ${c.message}`),
  ];
  const comments = doc.comments ?? [];

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" role="alert">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2 }}>
        {approval.status === 'current' && <Alert severity="success">{`Approved by ${approval.by}, ${when(approval.at)}. This is the version that will be built.`}</Alert>}
        {approval.status === 'stale' && <Alert severity="warning">{`The proposal changed after ${approval.by} approved it. Review it and approve again.`}</Alert>}
        {approval.status === 'none' && <Typography variant="body2" color="text.secondary">Not approved yet. Nothing is built before it is.</Typography>}
        <Box sx={{ mt: 1.5 }}>
          <Button variant="contained" color="success" disabled={busy || !status.valid} onClick={() => void apply([{ kind: 'approve' }])}>
            Approve this proposal
          </Button>
        </Box>
      </Paper>

      <Stack spacing={0.5}>
        {status.valid ? (
          <Alert severity="success" sx={{ py: 0 }}>Every derived manifest and the composition validate</Alert>
        ) : (
          problems.map((p) => <Alert key={p} severity="error" sx={{ py: 0 }}>{p}</Alert>)
        )}
        {doc.couplings.length > 0 && <Alert severity="warning" sx={{ py: 0 }}>{plural(doc.couplings.length, 'coupling to resolve', 'couplings to resolve')}</Alert>}
        {doc.shared.length > 0 && <Alert severity="info" sx={{ py: 0 }}>{plural(doc.shared.length, 'shared file to place', 'shared files to place')}</Alert>}
        {status.suggestions.length > 0 && <Alert severity="info" sx={{ py: 0 }}>{plural(status.suggestions.length, 'agent suggestion waiting', 'agent suggestions waiting')}</Alert>}
      </Stack>

      <Table size="small" aria-label="Proposed domains">
        <TableHead>
          <TableRow>
            <TableCell>Domain</TableCell>
            <TableCell>MFE</TableCell>
            <TableCell>Screens</TableCell>
            <TableCell>Data</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {doc.domains.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{d.shell ? `${d.id} (shell)` : d.id}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{d.mfe}</TableCell>
              <TableCell>{d.capabilities.map((c) => c.name).join(', ')}</TableCell>
              <TableCell>{d.backends.join(', ') || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>Conversation</Typography>
        {comments.length === 0 && <Typography variant="body2" color="text.secondary">No comments yet.</Typography>}
        {comments.map((c) => (
          <Box key={c.id} sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">{`${c.by} · ${when(c.at)}${c.about ? ` · on ${c.about}` : ''}`}</Typography>
            <Typography variant="body2">{c.text}</Typography>
          </Box>
        ))}
        <TextField fullWidth size="small" multiline label="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} sx={{ mt: 1 }} />
        <Box sx={{ mt: 1 }}>
          <Button disabled={busy || !comment.trim()} onClick={() => void apply([{ kind: 'comment', text: comment.trim() }]).then((ok) => ok && setComment(''))}>
            Comment
          </Button>
        </Box>
      </Paper>
    </Stack>
  );
};

export const ApproveProposal = withWorkspace(ApproveProposalView);

export default ApproveProposal;
