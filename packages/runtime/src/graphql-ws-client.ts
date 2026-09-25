/**
 * The daemon WebSocket client contract.
 *
 * `DaemonWebSocketClient` is what `RemoteMFE.doUpdateControlPlaneState()` sends
 * mutations through, received via `BaseMFEDependencies.wsClient`. The host owns
 * the one physical socket and injects a per-slot `DaemonChannel` that
 * implements this interface (ADR-057); there is no per-MFE socket client.
 */

/**
 * Platform-facing interface used in BaseMFEDependencies.
 * Keeps the abstract base class decoupled from the concrete implementation.
 */
export interface DaemonWebSocketClient {
  /** True when the underlying socket is open and ready to send frames. */
  readonly connected: boolean;

  /**
   * Execute a GraphQL mutation over the existing WS connection using the
   * graphql-transport-ws subscribe/next/complete protocol.
   *
   * @param query      Full GraphQL mutation string
   * @param variables  Variables map
   * @param timeoutMs  Abort after this many ms (default 4 000, matches DaemonService.forwardTimeoutMs)
   * @returns Resolves with the Boolean result of the mutation
   * @throws Error on timeout or GraphQL-level errors
   */
  mutation(
    query: string,
    variables: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<boolean>;
}
