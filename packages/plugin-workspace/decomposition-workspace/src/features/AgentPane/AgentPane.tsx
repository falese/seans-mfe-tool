/**
 * AgentPane Feature Component
 * Ask the agent in plain language; its suggested edits wait here to be accepted or rejected
 *
 * The agent has no private path into the proposal (ADR-116 §4): it suggests
 * named edits, each checked by applying it alone (ADR-117 §4), and nothing
 * changes until a person accepts one here.
 */
import React, { useState } from 'react';
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useWorkspace, withWorkspace } from '../workspace/WorkspaceContext';
import { describeEdit } from '../workspace/describe';

export interface AgentPaneProps {}

const AgentPaneView: React.FC<AgentPaneProps> = () => {
  const { status, error, busy, apply, client, refresh } = useWorkspace();
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  if (!status) return <LinearProgress aria-label="Loading the proposal" />;

  const ask = client.ask;
  const send = async () => {
    if (!ask || !question.trim()) return;
    setAsking(true);
    setAskError(null);
    try {
      await ask(question.trim());
      setQuestion('');
      await refresh();
    } catch (err) {
      setAskError(err instanceof Error ? err.message : String(err));
    } finally {
      setAsking(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Ask the agent"
          placeholder="e.g. Split hazards out of cargo — they're a separate team"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!ask || asking}
        />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Button variant="contained" disabled={!ask || asking || !question.trim()} onClick={() => void send()}>
            Ask
          </Button>
          {asking && <Typography variant="body2" color="text.secondary">The agent is thinking…</Typography>}
        </Stack>
        {!ask && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No agent is connected. Suggestions an agent makes from the command line still appear below.
          </Typography>
        )}
        {askError && <Alert severity="error" sx={{ mt: 1 }}>{askError}</Alert>}
      </Paper>

      <Typography variant="subtitle1">Suggestions</Typography>
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      {status.suggestions.length === 0 && (
        <Typography variant="body2" color="text.secondary">No suggestions waiting.</Typography>
      )}
      {status.suggestions.map((s) => (
        <Paper key={s.id} component="article" aria-label={`Suggestion ${s.id}`} variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2">{describeEdit(s.edit)}</Typography>
            <Chip size="small" color={s.check.ok ? 'success' : 'error'} label={s.check.ok ? 'Checks out' : 'Would not apply'} />
          </Stack>
          {s.request && (
            <Typography variant="caption" color="text.secondary" component="div">Asked: “{s.request}”</Typography>
          )}
          <Typography variant="body2" sx={{ mt: 0.5 }}>{s.explanation}</Typography>
          {s.check.ok ? (
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>Afterwards: {s.check.domains.join(', ')}</Typography>
          ) : (
            s.check.errors.map((e) => <Alert key={e} severity="warning" sx={{ mt: 1, py: 0 }}>{e}</Alert>)
          )}
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
            <Button size="small" variant="contained" disabled={busy || !s.check.ok} onClick={() => void apply([{ kind: 'accept-suggestion', id: s.id }])}>
              Accept
            </Button>
            <Button size="small" disabled={busy} onClick={() => void apply([{ kind: 'reject-suggestion', id: s.id }])}>
              Reject
            </Button>
          </Box>
        </Paper>
      ))}
    </Stack>
  );
};

export const AgentPane = withWorkspace(AgentPaneView);

export default AgentPane;
