import { logger } from '@seans-mfe-tool/logger';
import type { DaemonMessage, DaemonMessageType } from './types';

export interface DaemonConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export type DaemonStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export type MessageHandler = (message: DaemonMessage) => void;

/**
 * WebSocket client for Rust daemon integration
 *
 * Provides real-time communication with the daemon for:
 * - Registry updates (MFE registration/unregistration)
 * - Health status updates
 * - MFE lifecycle events
 */
export class DaemonClient {
  private ws: WebSocket | null = null;
  private config: Required<DaemonConfig>;
  private status: DaemonStatus = 'disconnected';
  private reconnectAttempts = 0;
  private messageHandlers: Map<DaemonMessageType, Set<MessageHandler>> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }> = new Map();

  constructor(config: DaemonConfig) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
    };
  }

  /**
   * Connect to daemon WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.warn('DaemonClient already connected');
      return;
    }

    this.status = 'connecting';
    logger.info('Connecting to daemon', { url: this.config.url });

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.status = 'connected';
        this.reconnectAttempts = 0;
        logger.info('Connected to daemon');
        resolve();
      };

      this.ws.onerror = (error) => {
        logger.error('WebSocket error', { error });
        this.status = 'error';
        reject(error);
      };

      this.ws.onclose = () => {
        this.status = 'disconnected';
        logger.warn('Disconnected from daemon');
        this.attemptReconnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  /**
   * Disconnect from daemon
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.status = 'disconnected';
      logger.info('Disconnected from daemon');
    }
  }

  /**
   * Send message to daemon
   */
  async send<T = unknown>(type: DaemonMessageType, payload: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to daemon');
    }

    const requestId = crypto.randomUUID();
    const message: DaemonMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      requestId,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this.ws!.send(JSON.stringify(message));

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Subscribe to message type
   */
  on(type: DaemonMessageType, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): DaemonStatus {
    return this.status;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: DaemonMessage = JSON.parse(data);

      // Handle response to pending request
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const { resolve } = this.pendingRequests.get(message.requestId)!;
        this.pendingRequests.delete(message.requestId);
        resolve(message.payload);
        return;
      }

      // Emit to registered handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }
    } catch (error) {
      logger.error('Failed to parse daemon message', { error, data });
    }
  }

  /**
   * Attempt reconnection
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    logger.info('Reconnecting to daemon', {
      attempt: this.reconnectAttempts,
      max: this.config.maxReconnectAttempts,
    });

    setTimeout(() => {
      this.connect().catch(error => {
        logger.error('Reconnect failed', { error });
      });
    }, this.config.reconnectInterval);
  }
}
