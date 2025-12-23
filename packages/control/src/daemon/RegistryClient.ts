import { logger } from '@seans-mfe-tool/logger';
import type { MFEMetadata } from './types';

export interface MFERegistryResponse {
  mfes: MFEMetadata[];
  total: number;
  timestamp: string;
}

/**
 * HTTP client for daemon registry API
 *
 * Provides RESTful API access to:
 * - Query MFE registry
 * - Get MFE manifests
 * - Trigger health checks
 */
export class RegistryClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get all registered MFEs
   */
  async getAllMFEs(): Promise<MFERegistryResponse> {
    const response = await fetch(`${this.baseUrl}/api/mfes`);

    if (!response.ok) {
      throw new Error(`Registry API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get specific MFE metadata
   */
  async getMFE(mfeId: string): Promise<MFEMetadata> {
    const response = await fetch(`${this.baseUrl}/api/mfes/${mfeId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`MFE not found: ${mfeId}`);
      }
      throw new Error(`Registry API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get MFE manifest
   */
  async getManifest(mfeId: string): Promise<unknown> {
    const mfe = await this.getMFE(mfeId);
    const response = await fetch(mfe.manifestUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Trigger health check for MFE
   */
  async checkHealth(mfeId: string): Promise<{ healthy: boolean; details?: unknown }> {
    const response = await fetch(`${this.baseUrl}/api/mfes/${mfeId}/health`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }
}
