use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use anyhow::Result;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, Mutex};
use tracing::{error, info, warn};
use warp::Filter;

// ========================
// MFE TYPES
// ========================

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MFEType {
    Remote,
    Bff,
    Tool,
    Agent,
    Feature,
    Service,
    Shell,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MFEStatus {
    Healthy,
    Unhealthy,
    Unknown,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MFEMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(rename = "type")]
    pub mfe_type: MFEType,
    pub manifest_url: String,
    pub remote_entry_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health_url: Option<String>,
    pub capabilities: Vec<String>,
    pub status: MFEStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_health_check: Option<DateTime<Utc>>,
    pub registered_at: DateTime<Utc>,
}

// ========================
// DAEMON MESSAGE PROTOCOL
// ========================

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DaemonMessageType {
    // MFE Lifecycle
    MfeRegistered,
    MfeUnregistered,
    MfeHealthUpdated,

    // Client Requests
    RegistryQuery,
    RegistryResponse,

    // Health Monitoring
    Ping,
    Pong,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DaemonMessage {
    #[serde(rename = "type")]
    pub message_type: DaemonMessageType,
    pub payload: serde_json::Value,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

// ========================
// HTTP API TYPES
// ========================

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MFERegistryResponse {
    pub mfes: Vec<MFEMetadata>,
    pub total: usize,
    pub timestamp: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SuccessResponse {
    pub success: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub healthy: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

// ========================
// DAEMON CONFIGURATION
// ========================

#[derive(Clone, Debug)]
pub struct DaemonConfig {
    pub health_check_interval: Duration,
    pub http_port: u16,
    pub ws_port: u16,
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            health_check_interval: Duration::from_secs(30),
            http_port: 4000,
            ws_port: 4001,
        }
    }
}

// ========================
// HEALTH CHECKER
// ========================

pub struct HealthChecker {
    check_interval: Duration,
    registry: Arc<DashMap<String, MFEMetadata>>,
    http_client: reqwest::Client,
    broadcast_tx: broadcast::Sender<DaemonMessage>,
}

impl HealthChecker {
    pub fn new(
        check_interval: Duration,
        registry: Arc<DashMap<String, MFEMetadata>>,
        broadcast_tx: broadcast::Sender<DaemonMessage>,
    ) -> Self {
        Self {
            check_interval,
            registry,
            http_client: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .unwrap(),
            broadcast_tx,
        }
    }

    pub async fn check_mfe_health(&self, mfe: &MFEMetadata) -> MFEStatus {
        if let Some(health_url) = &mfe.health_url {
            match self.http_client.get(health_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    info!("✅ Health check passed for MFE: {}", mfe.id);
                    MFEStatus::Healthy
                }
                Ok(resp) => {
                    warn!("⚠️ Health check failed for MFE: {} (status: {})", mfe.id, resp.status());
                    MFEStatus::Unhealthy
                }
                Err(e) => {
                    error!("❌ Health check error for MFE: {} (error: {})", mfe.id, e);
                    MFEStatus::Unhealthy
                }
            }
        } else {
            MFEStatus::Unknown
        }
    }

    pub async fn run_scheduler(self: Arc<Self>) {
        info!("🩺 Health check scheduler started (interval: {:?})", self.check_interval);
        let mut interval = tokio::time::interval(self.check_interval);
        loop {
            interval.tick().await;

            let mfes: Vec<MFEMetadata> = self.registry.iter()
                .map(|entry| entry.value().clone())
                .collect();

            for mfe in mfes {
                let status = self.check_mfe_health(&mfe).await;

                if status != mfe.status {
                    info!("🔄 MFE status changed: {} ({:?} -> {:?})", mfe.id, mfe.status, status);

                    // Update status in registry
                    if let Some(mut entry) = self.registry.get_mut(&mfe.id) {
                        entry.status = status.clone();
                        entry.last_health_check = Some(Utc::now());

                        // Broadcast health update
                        let _ = self.broadcast_tx.send(DaemonMessage {
                            message_type: DaemonMessageType::MfeHealthUpdated,
                            payload: serde_json::to_value(&*entry).unwrap_or_default(),
                            timestamp: Utc::now().to_rfc3339(),
                            request_id: None,
                        });
                    }
                }
            }
        }
    }
}

// ========================
// MFE REGISTRY DAEMON
// ========================

#[derive(Clone)]
pub struct MFERegistryDaemon {
    registry: Arc<DashMap<String, MFEMetadata>>,
    broadcast_tx: broadcast::Sender<DaemonMessage>,
    health_checker: Arc<Mutex<Option<Arc<HealthChecker>>>>,
    config: DaemonConfig,
}

impl MFERegistryDaemon {
    pub fn new(config: DaemonConfig) -> Self {
        let (broadcast_tx, _) = broadcast::channel(100);
        Self {
            registry: Arc::new(DashMap::new()),
            broadcast_tx,
            health_checker: Arc::new(Mutex::new(None)),
            config,
        }
    }

    pub async fn register_mfe(&self, mut mfe: MFEMetadata) -> Result<MFEMetadata> {
        // Set registration timestamp
        mfe.registered_at = Utc::now();
        mfe.status = MFEStatus::Unknown;

        info!("📝 Registering MFE: {} (name: {}, type: {:?})", mfe.id, mfe.name, mfe.mfe_type);

        self.registry.insert(mfe.id.clone(), mfe.clone());

        // Broadcast registration
        let _ = self.broadcast_tx.send(DaemonMessage {
            message_type: DaemonMessageType::MfeRegistered,
            payload: serde_json::to_value(&mfe)?,
            timestamp: Utc::now().to_rfc3339(),
            request_id: None,
        });

        Ok(mfe)
    }

    pub async fn unregister_mfe(&self, id: &str) -> Result<bool> {
        if let Some((_, mfe)) = self.registry.remove(id) {
            info!("🗑️ Unregistered MFE: {}", id);

            let _ = self.broadcast_tx.send(DaemonMessage {
                message_type: DaemonMessageType::MfeUnregistered,
                payload: serde_json::to_value(&mfe)?,
                timestamp: Utc::now().to_rfc3339(),
                request_id: None,
            });
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn get_all_mfes(&self) -> Vec<MFEMetadata> {
        self.registry.iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    pub fn get_mfe(&self, id: &str) -> Option<MFEMetadata> {
        self.registry.get(id).map(|entry| entry.value().clone())
    }

    pub async fn check_health(&self, id: &str) -> Result<MFEStatus> {
        let mfe = self.get_mfe(id)
            .ok_or_else(|| anyhow::anyhow!("MFE not found: {}", id))?;

        let health_checker_guard = self.health_checker.lock().await;
        if let Some(ref checker) = *health_checker_guard {
            Ok(checker.check_mfe_health(&mfe).await)
        } else {
            Ok(MFEStatus::Unknown)
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<DaemonMessage> {
        self.broadcast_tx.subscribe()
    }

    pub async fn start_health_checker(&self) {
        let checker = Arc::new(HealthChecker::new(
            self.config.health_check_interval,
            self.registry.clone(),
            self.broadcast_tx.clone(),
        ));

        *self.health_checker.lock().await = Some(checker.clone());

        tokio::spawn(async move {
            checker.run_scheduler().await;
        });
    }
}

// ========================
// HTTP REST API HANDLERS
// ========================

async fn register_mfe_handler(
    body: MFEMetadata,
    daemon: Arc<MFERegistryDaemon>,
) -> Result<impl warp::Reply, warp::Rejection> {
    match daemon.register_mfe(body).await {
        Ok(mfe) => Ok(warp::reply::json(&mfe)),
        Err(e) => {
            error!("Failed to register MFE: {}", e);
            Err(warp::reject::reject())
        }
    }
}

async fn get_mfes_handler(
    daemon: Arc<MFERegistryDaemon>,
) -> Result<impl warp::Reply, warp::Rejection> {
    let mfes = daemon.get_all_mfes();
    let response = MFERegistryResponse {
        total: mfes.len(),
        timestamp: Utc::now().to_rfc3339(),
        mfes,
    };
    Ok(warp::reply::json(&response))
}

async fn get_mfe_handler(
    id: String,
    daemon: Arc<MFERegistryDaemon>,
) -> Result<impl warp::Reply, warp::Rejection> {
    match daemon.get_mfe(&id) {
        Some(mfe) => Ok(warp::reply::json(&mfe)),
        None => Err(warp::reject::not_found()),
    }
}

async fn unregister_mfe_handler(
    id: String,
    daemon: Arc<MFERegistryDaemon>,
) -> Result<impl warp::Reply, warp::Rejection> {
    match daemon.unregister_mfe(&id).await {
        Ok(_) => Ok(warp::reply::json(&SuccessResponse { success: true })),
        Err(e) => {
            error!("Failed to unregister MFE: {}", e);
            Err(warp::reject::reject())
        }
    }
}

async fn health_check_handler(
    id: String,
    daemon: Arc<MFERegistryDaemon>,
) -> Result<impl warp::Reply, warp::Rejection> {
    match daemon.check_health(&id).await {
        Ok(status) => {
            let response = HealthCheckResponse {
                healthy: status == MFEStatus::Healthy,
                details: None,
            };
            Ok(warp::reply::json(&response))
        }
        Err(e) => {
            error!("Health check failed: {}", e);
            Err(warp::reject::reject())
        }
    }
}

fn with_daemon(
    daemon: Arc<MFERegistryDaemon>,
) -> impl Filter<Extract = (Arc<MFERegistryDaemon>,), Error = Infallible> + Clone {
    warp::any().map(move || daemon.clone())
}

fn routes(
    daemon: Arc<MFERegistryDaemon>,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    let register = warp::post()
        .and(warp::path!("api" / "mfes"))
        .and(warp::body::json())
        .and(with_daemon(daemon.clone()))
        .and_then(register_mfe_handler);

    let get_all = warp::get()
        .and(warp::path!("api" / "mfes"))
        .and(with_daemon(daemon.clone()))
        .and_then(get_mfes_handler);

    let get_one = warp::get()
        .and(warp::path!("api" / "mfes" / String))
        .and(with_daemon(daemon.clone()))
        .and_then(get_mfe_handler);

    let delete_one = warp::delete()
        .and(warp::path!("api" / "mfes" / String))
        .and(with_daemon(daemon.clone()))
        .and_then(unregister_mfe_handler);

    let health = warp::post()
        .and(warp::path!("api" / "mfes" / String / "health"))
        .and(with_daemon(daemon.clone()))
        .and_then(health_check_handler);

    register
        .or(get_all)
        .or(get_one)
        .or(delete_one)
        .or(health)
}

// ========================
// WEBSOCKET PROTOCOL
// ========================

async fn handle_websocket(
    ws: warp::ws::WebSocket,
    daemon: Arc<MFERegistryDaemon>,
) {
    let (mut ws_tx, mut ws_rx) = ws.split();
    let mut daemon_rx = daemon.subscribe();

    // Forward daemon broadcasts to client
    tokio::spawn(async move {
        while let Ok(msg) = daemon_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if let Err(e) = ws_tx.send(warp::ws::Message::text(json)).await {
                    error!("WebSocket send error: {}", e);
                    break;
                }
            }
        }
    });

    // Handle incoming client messages
    while let Some(result) = ws_rx.next().await {
        match result {
            Ok(msg) => {
                if let Ok(text) = msg.to_str() {
                    if let Ok(daemon_msg) = serde_json::from_str::<DaemonMessage>(text) {
                        handle_client_message(daemon_msg, &daemon).await;
                    }
                }
            }
            Err(_) => break,
        }
    }
}

async fn handle_client_message(msg: DaemonMessage, daemon: &Arc<MFERegistryDaemon>) {
    match msg.message_type {
        DaemonMessageType::RegistryQuery => {
            let mfes = daemon.get_all_mfes();
            let response = DaemonMessage {
                message_type: DaemonMessageType::RegistryResponse,
                payload: serde_json::to_value(&mfes).unwrap_or_default(),
                timestamp: Utc::now().to_rfc3339(),
                request_id: msg.request_id,
            };
            // Note: In a full implementation, we'd need to send this back to the specific client
            // For now, we broadcast it (clients can filter by request_id)
            let _ = daemon.broadcast_tx.send(response);
        }
        DaemonMessageType::Ping => {
            let pong = DaemonMessage {
                message_type: DaemonMessageType::Pong,
                payload: serde_json::Value::Null,
                timestamp: Utc::now().to_rfc3339(),
                request_id: msg.request_id,
            };
            let _ = daemon.broadcast_tx.send(pong);
        }
        _ => {
            warn!("Unexpected message type from client: {:?}", msg.message_type);
        }
    }
}

fn ws_route(
    daemon: Arc<MFERegistryDaemon>,
) -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    warp::path("ws")
        .and(warp::ws())
        .and(with_daemon(daemon))
        .map(|ws: warp::ws::Ws, daemon| {
            ws.on_upgrade(move |socket| handle_websocket(socket, daemon))
        })
}

// ========================
// MAIN
// ========================

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"))
        )
        .init();

    info!("🚀 Starting MFE Registry Daemon");

    // Create daemon
    let config = DaemonConfig::default();
    let daemon = Arc::new(MFERegistryDaemon::new(config.clone()));

    // Start health checker
    daemon.start_health_checker().await;

    // Build routes
    let api_routes = routes(daemon.clone());
    let ws_routes = ws_route(daemon.clone());
    let all_routes = api_routes.or(ws_routes);

    // Start HTTP server
    let http_port = config.http_port;
    info!("🌐 HTTP API listening on http://0.0.0.0:{}", http_port);
    info!("🔌 WebSocket listening on ws://0.0.0.0:{}/ws", http_port);

    warp::serve(all_routes)
        .run(([0, 0, 0, 0], http_port))
        .await;

    Ok(())
}
