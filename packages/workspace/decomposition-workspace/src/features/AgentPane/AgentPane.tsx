/**
 * AgentPane Feature Component
 * Ask the agent in plain language; its suggested edits wait here to be accepted or rejected
 *
 * The agent has no private path into the proposal (ADR-116 §4): it suggests
 * named edits, each checked by applying it alone (ADR-117 §4), and nothing
 * changes until a person accepts one here.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { useWorkspace, withWorkspace } from '../workspace/WorkspaceContext';
import { describeEdit } from '../workspace/describe';
import type { AgentInfo, AskResult } from '../workspace/types';

/** Takes no props: everything comes from the proposal (ADR-116 §3). */
export type AgentPaneProps = Record<string, never>;

const AgentPaneView: React.FC<AgentPaneProps> = () => {
  const { status, error, busy, apply, client, refresh } = useWorkspace();
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [reply, setReply] = useState<AskResult | null>(null);

  useEffect(() => {
    let live = true;
    client
      .agent()
      .then((a) => live && setAgent(a))
      .catch((err: unknown) => live && setAgent({ connected: false, reason: err instanceof Error ? err.message : String(err) }));
    return () => {
      live = false;
    };
  }, [client]);

  if (!status) return <LinearProgress aria-label="Loading the proposal" />;

  const connected = agent?.connected === true;
  const send = async () => {
    if (!connected || !question.trim()) return;
    setAsking(true);
    setAskError(null);
    try {
      setReply(await client.ask(question.trim()));
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
          disabled={!connected || asking}
        />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Button variant="contained" disabled={!connected || asking || !question.trim()} onClick={() => void send()}>
            Ask
          </Button>
          {asking && <Typography variant="body2" color="text.secondary">The agent is thinking — this can take a minute…</Typography>}
          {connected && !asking && (
            <Typography variant="caption" color="text.secondary">{agent?.model ? `Connected · ${agent.model}` : 'Connected'}</Typography>
          )}
        </Stack>
        {agent && !connected && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {agent.reason ?? 'No agent is connected.'} Suggestions an agent makes from the command line still appear below.
          </Typography>
        )}
        {askError && <Alert severity="error" sx={{ mt: 1 }}>{askError}</Alert>}
      </Paper>

      {reply && (
        <Paper component="section" aria-label="The agent’s answer" variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2">{reply.answer}</Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            {reply.suggested.length === 1 ? '1 suggestion added below' : `${reply.suggested.length} suggestions added below`}
          </Typography>
          {reply.dropped.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Checked and dropped — these would not apply:</Typography>
              {reply.dropped.map((d) => (
                <Alert key={`${describeEdit(d.edit)}:${d.reason ?? ''}`} severity="warning" sx={{ mt: 0.5, py: 0 }}>
                  {`${describeEdit(d.edit)} — ${d.reason ?? 'did not validate'}`}
                </Alert>
              ))}
            </Box>
          )}
        </Paper>
      )}

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
