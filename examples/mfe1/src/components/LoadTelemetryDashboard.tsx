/**
 * Load Telemetry Dashboard
 * Visual UI component showing ADR-060 Load Capability telemetry
 * Only rendered in development mode
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Chip,
  Stack
} from '@mui/material';

// Import types from runtime package
interface LoadResult {
  status: 'loaded' | 'error';
  container?: unknown;
  manifest?: unknown;
  availableComponents?: string[];
  capabilities?: CapabilityMetadata[];
  timestamp: Date;
  duration: number;
  telemetry?: {
    entry: PhaseTelemetry;
    mount: PhaseTelemetry;
    enableRender: PhaseTelemetry;
  };
  error?: PhaseError;
}

interface CapabilityMetadata {
  name: string;
  type: 'platform' | 'domain';
  available: boolean;
  requiresAuth?: boolean;
  description?: string;
}

interface PhaseTelemetry {
  start: Date;
  duration: number;
}

interface PhaseError {
  message: string;
  phase: string;
  retryCount: number;
  retryable: boolean;
  cause?: Error;
}

interface PerformanceMetrics {
  totalDuration: number;
  entryDuration: number;
  mountDuration: number;
  enableRenderDuration: number;
  breakdown: {
    entry: number;
    mount: number;
    enableRender: number;
  };
}

interface LoadTelemetryDashboardProps {
  loadResult?: LoadResult;
}

/**
 * Load Telemetry Dashboard Component
 * Shows comprehensive load metrics with visual indicators
 */
export const LoadTelemetryDashboard: React.FC<LoadTelemetryDashboardProps> = ({
  loadResult
}) => {
  if (!loadResult) {
    return (
      <Card elevation={3} sx={{ mt: 2, backgroundColor: '#FFF9C4' }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            No load telemetry data available yet.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const metrics = getPerformanceMetrics(loadResult);
  const validation = validateLoadResult(loadResult);

  return (
    <Card elevation={3} sx={{ mt: 2, mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span>📊</span>
          Load Capability Telemetry
          <Chip label="ADR-060" size="small" variant="outlined" sx={{ ml: 1 }} />
        </Typography>

        {/* Status Indicator */}
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={loadResult.status.toUpperCase()}
            color={loadResult.status === 'loaded' ? 'success' : 'error'}
            size="small"
          />
          {loadResult.error && (
            <>
              <Chip
                label={`Failed at: ${loadResult.error.phase}`}
                color="error"
                size="small"
              />
              {loadResult.error.retryCount > 0 && (
                <Chip
                  label={`Retries: ${loadResult.error.retryCount}`}
                  color="warning"
                  size="small"
                />
              )}
              <Chip
                label={loadResult.error.retryable ? 'Retryable' : 'Non-retryable'}
                color={loadResult.error.retryable ? 'warning' : 'error'}
                size="small"
                variant="outlined"
              />
            </>
          )}
        </Stack>

        {/* Performance Metrics */}
        {metrics && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
              Total Duration: {metrics.totalDuration}ms
            </Typography>

            <Box sx={{ mt: 2 }}>
              <PhaseProgress
                label="Entry Phase"
                duration={metrics.entryDuration}
                percentage={metrics.breakdown.entry}
                color="#2196F3"
                description="Fetch remoteEntry.js"
              />
              <PhaseProgress
                label="Mount Phase"
                duration={metrics.mountDuration}
                percentage={metrics.breakdown.mount}
                color="#9C27B0"
                description="Initialize container"
              />
              <PhaseProgress
                label="Enable-Render Phase"
                duration={metrics.enableRenderDuration}
                percentage={metrics.breakdown.enableRender}
                color="#FF5722"
                description="Parse manifest"
              />
            </Box>
          </>
        )}

        {/* Error Details */}
        {loadResult.error && (
          <Box sx={{ mt: 2, p: 1.5, backgroundColor: '#FFEBEE', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="error" gutterBottom>
              Error Details:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {loadResult.error.message}
            </Typography>
          </Box>
        )}

        {/* Validation Status */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {validation.valid ? '✓' : '✗'} Validation: {validation.valid ? 'Valid' : 'Invalid'}
          </Typography>
          {validation.warnings.length > 0 && (
            <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
              ⚠ {validation.warnings.join(', ')}
            </Typography>
          )}
          {validation.errors.length > 0 && (
            <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
              ✗ {validation.errors.join(', ')}
            </Typography>
          )}
        </Box>

        {/* Capabilities */}
        {loadResult.capabilities && loadResult.capabilities.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Available Capabilities: {loadResult.capabilities.filter(c => c.available).length}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              {loadResult.capabilities.map(cap => (
                <Chip
                  key={cap.name}
                  label={cap.name}
                  size="small"
                  variant={cap.available ? 'filled' : 'outlined'}
                  color={cap.type === 'platform' ? 'primary' : 'secondary'}
                  title={cap.description}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Available Components */}
        {loadResult.availableComponents && loadResult.availableComponents.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Available Components: {loadResult.availableComponents.length}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
              {loadResult.availableComponents.map(component => (
                <Chip
                  key={component}
                  label={component}
                  size="small"
                  variant="outlined"
                  color="default"
                />
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Phase Progress Component
 * Shows individual phase performance with color-coded progress bar
 */
interface PhaseProgressProps {
  label: string;
  duration: number;
  percentage: number;
  color: string;
  description?: string;
}

const PhaseProgress: React.FC<PhaseProgressProps> = ({
  label,
  duration,
  percentage,
  color,
  description
}) => (
  <Box sx={{ mb: 2 }}>
    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 500 }}>
        {label}
        {description && (
          <span style={{ color: '#757575', fontWeight: 400, marginLeft: 4 }}>
            - {description}
          </span>
        )}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 500 }}>
        {duration}ms ({percentage.toFixed(1)}%)
      </Typography>
    </Stack>
    <LinearProgress
      variant="determinate"
      value={percentage}
      sx={{
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e0e0e0',
        '& .MuiLinearProgress-bar': {
          backgroundColor: color,
          borderRadius: 4
        }
      }}
    />
  </Box>
);

/**
 * Simple LoadResult validator (inline version)
 */
function validateLoadResult(result: LoadResult): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result.status) {
    errors.push('Missing status');
  }
  if (!result.timestamp) {
    errors.push('Missing timestamp');
  }
  if (result.duration === undefined) {
    errors.push('Missing duration');
  }

  if (result.status === 'loaded') {
    if (!result.container) warnings.push('No container');
    if (!result.manifest) warnings.push('No manifest');
    if (!result.telemetry) warnings.push('No telemetry');
  }

  if (result.status === 'error' && !result.error) {
    errors.push('Error status but no error object');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Extract performance metrics from LoadResult
 */
function getPerformanceMetrics(result: LoadResult): PerformanceMetrics | null {
  if (!result.telemetry || !result.duration) {
    return null;
  }

  const { entry, mount, enableRender } = result.telemetry;
  const totalDuration = result.duration;

  // Calculate percentages
  const entryPct = (entry.duration / totalDuration) * 100;
  const mountPct = (mount.duration / totalDuration) * 100;
  const enableRenderPct = (enableRender.duration / totalDuration) * 100;

  return {
    totalDuration,
    entryDuration: entry.duration,
    mountDuration: mount.duration,
    enableRenderDuration: enableRender.duration,
    breakdown: {
      entry: Math.round(entryPct * 100) / 100,
      mount: Math.round(mountPct * 100) / 100,
      enableRender: Math.round(enableRenderPct * 100) / 100
    }
  };
}
