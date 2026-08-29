// Intent→manifest training-corpus generator.
//
// The 21 committed mfe-manifest.yaml files are gold *completions*; this script
// authors the *intents* (prompts) and emits {prompt, completion} JSONL for the
// coder `intent-manifest` adaptor. Two lanes:
//   1. Seed  — real manifests × hand-authored intents (seed-intents.json). High realism.
//   2. Synth — real skeletons "reskinned" onto a domain bank, framework/language/type
//              varied, EVERY candidate gated by @seans-mfe/dsl validateFull. Templated
//              intents (lower realism than the seed — the known soft spot).
//
// Deterministic (seeded RNG) so regeneration is byte-stable. Run:
//   node docs/corpus/intent-manifest/generate.mjs
// Requires the workspace build (npm run build:packages) so @seans-mfe/dsl resolves.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const { validateFull } = require("@seans-mfe/dsl");

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const OUT = HERE;

// ── Targets (coder `data stats` bar) ────────────────────────────────────────
const TARGET_TOTAL = 500;
const MAX_PROMPT_TOK = 200; // mean target
const MAX_COMPLETION_TOK = 400; // mean target
const HARD_TOK_CAP = 2048; // coder data validate hard cap
const DIVERSITY_CAP = 1; // one pair per structural diversity key — forces domain/framework spread
const TRAIN_RATIO = 0.9;
const SEED = 42;

const tok = (s) => Math.ceil(s.length / 4);

// ── Seeded RNG (mulberry32) ─────────────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ── Seed manifests ──────────────────────────────────────────────────────────
const SEED_PATHS = [
  "abc-kids/animal-sounds", "abc-kids/color-mixer", "abc-kids/counting-stars",
  "abc-kids/flappy", "abc-kids/hockey", "abc-kids/home", "abc-kids/letter-pop",
  "abc-kids/maze-runner", "abc-kids/memory-match", "abc-kids/multiplication-quiz",
  "abc-kids/rhythm-tap", "abc-kids/rocket-math", "abc-kids/shape-sorter",
  "abc-kids/word-builder", "meridian-station/meridian-cargo-ops",
  "meridian-station/meridian-concourse", "meridian-station/meridian-console",
  "meridian-station/meridian-crew-services", "meridian-station/meridian-docking-control",
  "meridian-station/meridian-docking-simulation", "meridian-station/meridian-life-support",
].map((p) => `examples/${p}/mfe-manifest.yaml`);

const seedIntents = JSON.parse(readFileSync(join(HERE, "seed-intents.json"), "utf8"));

// ── Domain bank (verticals beyond kids/space, for generalization) ────────────
// caps: n=CapabilityName, d=manifest description, v=intent verb phrase.
const DOMAINS = [
  { k: "orders-dashboard", h: "Orders Dashboard", cat: "commerce", tags: ["commerce", "orders"], owner: "storefront-team", desc: "Order tracking dashboard — open orders, fulfilment status, returns", caps: [{ n: "OrderList", d: "List open and recent orders with status", v: "see open orders and their fulfilment status" }, { n: "ReturnsPanel", d: "Show returns and refunds in flight", v: "track returns and refunds" }] },
  { k: "checkout-cart", h: "Checkout Cart", cat: "commerce", tags: ["commerce", "checkout"], owner: "storefront-team", desc: "Cart and checkout summary with promotions", caps: [{ n: "CartSummary", d: "Show cart contents and totals", v: "review their cart and totals" }, { n: "ApplyPromo", d: "Apply a promotion code to the cart", v: "apply a promo code" }] },
  { k: "product-catalog", h: "Product Catalog", cat: "commerce", tags: ["commerce", "catalog"], owner: "merch-team", desc: "Browsable product catalog with filters", caps: [{ n: "CatalogGrid", d: "Browse products in a filterable grid", v: "browse products and filter them" }] },
  { k: "invoice-review", h: "Invoice Review", cat: "finance", tags: ["finance", "invoices"], owner: "finance-team", desc: "Invoice review queue with approvals", caps: [{ n: "InvoiceQueue", d: "Review invoices awaiting approval", v: "review invoices waiting for approval" }, { n: "ApproveInvoice", d: "Approve or reject an invoice", v: "approve or reject an invoice" }] },
  { k: "expense-report", h: "Expense Report", cat: "finance", tags: ["finance", "expenses"], owner: "finance-team", desc: "Employee expense submission and status", caps: [{ n: "ExpenseForm", d: "Submit an expense with receipts", v: "submit an expense with receipts" }, { n: "ExpenseStatus", d: "Track submitted expense approvals", v: "see where their expenses stand" }] },
  { k: "budget-tracker", h: "Budget Tracker", cat: "finance", tags: ["finance", "budget"], owner: "fp-a-team", desc: "Departmental budget vs actuals", caps: [{ n: "BudgetOverview", d: "Compare budget against actual spend", v: "compare budget against actual spend" }] },
  { k: "patient-intake", h: "Patient Intake", cat: "health", tags: ["health", "intake"], owner: "clinical-team", desc: "Patient intake form and triage", caps: [{ n: "IntakeForm", d: "Capture patient intake details", v: "fill in patient intake details" }, { n: "TriageSummary", d: "Show triage priority for a patient", v: "see a patient's triage priority" }] },
  { k: "appointment-scheduler", h: "Appointment Scheduler", cat: "health", tags: ["health", "scheduling"], owner: "clinical-team", desc: "Book and manage appointments", caps: [{ n: "SlotPicker", d: "Pick an available appointment slot", v: "pick an open appointment time" }, { n: "AppointmentList", d: "List a patient's appointments", v: "review their appointments" }] },
  { k: "shipment-tracker", h: "Shipment Tracker", cat: "logistics", tags: ["logistics", "shipping"], owner: "ops-team", desc: "Live shipment tracking and ETAs", caps: [{ n: "TrackingMap", d: "Show shipments on a live map", v: "watch shipments move with live ETAs" }, { n: "ExceptionsList", d: "Flag delayed or exception shipments", v: "spot delayed shipments" }] },
  { k: "warehouse-inventory", h: "Warehouse Inventory", cat: "logistics", tags: ["logistics", "inventory"], owner: "ops-team", desc: "Warehouse stock levels and reorders", caps: [{ n: "StockLevels", d: "Show stock on hand by SKU", v: "check stock on hand by SKU" }, { n: "ReorderPanel", d: "Trigger reorders below threshold", v: "reorder items that run low" }] },
  { k: "route-planner", h: "Route Planner", cat: "logistics", tags: ["logistics", "routing"], owner: "ops-team", desc: "Delivery route planning board", caps: [{ n: "RouteBoard", d: "Plan and sequence delivery routes", v: "plan and sequence delivery routes" }] },
  { k: "flight-status", h: "Flight Status", cat: "travel", tags: ["travel", "flights"], owner: "travel-team", desc: "Flight status board with gates and delays", caps: [{ n: "StatusBoard", d: "Show flights with gates and delays", v: "check flight gates and delays" }] },
  { k: "hotel-booking", h: "Hotel Booking", cat: "travel", tags: ["travel", "hotels"], owner: "travel-team", desc: "Hotel search and booking summary", caps: [{ n: "HotelSearch", d: "Search hotels by date and city", v: "search hotels by date and city" }, { n: "BookingSummary", d: "Review a hotel booking", v: "review a booking before paying" }] },
  { k: "media-library", h: "Media Library", cat: "media", tags: ["media", "library"], owner: "content-team", desc: "Media asset library with previews", caps: [{ n: "AssetGrid", d: "Browse media assets with previews", v: "browse media assets with previews" }] },
  { k: "video-player", h: "Video Player", cat: "media", tags: ["media", "video"], owner: "content-team", desc: "Video playback with chapters", caps: [{ n: "PlayerSurface", d: "Play a video with chapter markers", v: "play a video with chapters" }, { n: "PlaylistPanel", d: "Show the up-next playlist", v: "see what plays next" }] },
  { k: "employee-directory", h: "Employee Directory", cat: "hr", tags: ["hr", "directory"], owner: "people-team", desc: "Searchable employee directory", caps: [{ n: "DirectorySearch", d: "Search colleagues and view profiles", v: "look up colleagues and view profiles" }] },
  { k: "timeoff-requests", h: "Time-Off Requests", cat: "hr", tags: ["hr", "timeoff"], owner: "people-team", desc: "Request and approve time off", caps: [{ n: "RequestForm", d: "Request time off with dates", v: "request time off" }, { n: "ApprovalQueue", d: "Approve pending time-off requests", v: "approve pending requests" }] },
  { k: "sensor-telemetry", h: "Sensor Telemetry", cat: "iot", tags: ["iot", "telemetry"], owner: "platform-team", desc: "IoT sensor telemetry with alerts", caps: [{ n: "TelemetryChart", d: "Chart live sensor readings", v: "watch live sensor readings" }, { n: "AlertList", d: "List triggered sensor alerts", v: "see which sensors are alarming" }] },
  { k: "device-fleet", h: "Device Fleet", cat: "iot", tags: ["iot", "devices"], owner: "platform-team", desc: "Connected device fleet health", caps: [{ n: "FleetGrid", d: "Show device health across the fleet", v: "check device health across the fleet" }] },
  { k: "course-catalog", h: "Course Catalog", cat: "education", tags: ["education", "courses"], owner: "learning-team", desc: "Course catalog and enrolment", caps: [{ n: "CourseGrid", d: "Browse and enrol in courses", v: "browse and enrol in courses" }] },
  { k: "quiz-runner", h: "Quiz Runner", cat: "education", tags: ["education", "quiz"], owner: "learning-team", desc: "Interactive quiz with scoring", caps: [{ n: "QuizSurface", d: "Answer quiz questions and get scored", v: "answer questions and get a score" }, { n: "ResultsPanel", d: "Show quiz results and review", v: "review their results" }] },
  { k: "property-listings", h: "Property Listings", cat: "realestate", tags: ["realestate", "listings"], owner: "listings-team", desc: "Property listings with map and filters", caps: [{ n: "ListingsMap", d: "Browse listings on a map", v: "browse listings on a map" }, { n: "FilterPanel", d: "Filter listings by criteria", v: "filter by price, beds and area" }] },
  { k: "menu-ordering", h: "Menu Ordering", cat: "food", tags: ["food", "ordering"], owner: "dining-team", desc: "Restaurant menu and order builder", caps: [{ n: "MenuBoard", d: "Browse the menu and add items", v: "browse the menu and build an order" }] },
  { k: "kitchen-display", h: "Kitchen Display", cat: "food", tags: ["food", "kitchen"], owner: "dining-team", desc: "Kitchen order queue display", caps: [{ n: "TicketQueue", d: "Show incoming kitchen tickets", v: "see incoming tickets in the kitchen" }] },
  { k: "workout-tracker", h: "Workout Tracker", cat: "fitness", tags: ["fitness", "workouts"], owner: "wellness-team", desc: "Workout logging and progress", caps: [{ n: "WorkoutLog", d: "Log workouts and sets", v: "log workouts and sets" }, { n: "ProgressChart", d: "Chart training progress", v: "see their progress over time" }] },
  { k: "energy-usage", h: "Energy Usage", cat: "energy", tags: ["energy", "usage"], owner: "grid-team", desc: "Household energy usage dashboard", caps: [{ n: "UsageDashboard", d: "Show energy usage and cost", v: "see energy usage and cost" }] },
  { k: "grid-alerts", h: "Grid Alerts", cat: "energy", tags: ["energy", "alerts"], owner: "grid-team", desc: "Power grid alert monitor", caps: [{ n: "AlertMonitor", d: "Monitor grid alerts by region", v: "monitor grid alerts by region" }] },
  { k: "support-inbox", h: "Support Inbox", cat: "support", tags: ["support", "tickets"], owner: "support-team", desc: "Support ticket inbox and triage", caps: [{ n: "TicketInbox", d: "Triage incoming support tickets", v: "triage incoming tickets" }, { n: "ReplyPanel", d: "Reply to a support ticket", v: "reply to a customer" }] },
  { k: "chat-widget", h: "Chat Widget", cat: "comms", tags: ["comms", "chat"], owner: "comms-team", desc: "Embeddable chat conversation widget", caps: [{ n: "ChatThread", d: "Show a chat conversation thread", v: "hold a chat conversation" }] },
  { k: "notification-center", h: "Notification Center", cat: "comms", tags: ["comms", "notifications"], owner: "comms-team", desc: "Unified notification center", caps: [{ n: "NotificationFeed", d: "Show a feed of notifications", v: "see all their notifications in one feed" }] },
  { k: "analytics-overview", h: "Analytics Overview", cat: "analytics", tags: ["analytics", "dashboard"], owner: "data-team", desc: "Product analytics overview with KPIs", caps: [{ n: "KpiTiles", d: "Show headline KPI tiles", v: "see headline KPIs at a glance" }, { n: "TrendChart", d: "Chart a metric trend over time", v: "chart a metric over time" }] },
  { k: "funnel-explorer", h: "Funnel Explorer", cat: "analytics", tags: ["analytics", "funnels"], owner: "data-team", desc: "Conversion funnel explorer", caps: [{ n: "FunnelView", d: "Explore a conversion funnel", v: "explore where users drop off" }] },
  { k: "map-tracker", h: "Map Tracker", cat: "geo", tags: ["geo", "map"], owner: "geo-team", desc: "Live asset positions on a map", caps: [{ n: "LiveMap", d: "Show live asset positions", v: "watch assets move on a map" }] },
  { k: "poll-widget", h: "Poll Widget", cat: "engagement", tags: ["engagement", "poll"], owner: "growth-team", desc: "Live poll and results widget", caps: [{ n: "PollSurface", d: "Cast a vote in a live poll", v: "vote in a live poll" }, { n: "ResultsBar", d: "Show live poll results", v: "watch results update live" }] },
  { k: "onboarding-wizard", h: "Onboarding Wizard", cat: "growth", tags: ["growth", "onboarding"], owner: "growth-team", desc: "Multi-step onboarding wizard", caps: [{ n: "WizardFlow", d: "Guide a user through onboarding steps", v: "walk through onboarding steps" }] },
  { k: "settings-panel", h: "Settings Panel", cat: "platform", tags: ["platform", "settings"], owner: "platform-team", desc: "User settings and preferences", caps: [{ n: "SettingsForm", d: "Edit user settings and preferences", v: "edit their settings and preferences" }] },
  { k: "billing-portal", h: "Billing Portal", cat: "finance", tags: ["finance", "billing"], owner: "billing-team", desc: "Subscription billing and invoices", caps: [{ n: "PlanPanel", d: "Show the current plan and usage", v: "see their plan and usage" }, { n: "InvoiceHistory", d: "List past invoices", v: "download past invoices" }] },
  { k: "job-board", h: "Job Board", cat: "hr", tags: ["hr", "jobs"], owner: "talent-team", desc: "Open roles job board", caps: [{ n: "RoleGrid", d: "Browse open roles", v: "browse open roles" }, { n: "ApplyForm", d: "Apply to a role", v: "apply to a role" }] },
  { k: "incident-board", h: "Incident Board", cat: "ops", tags: ["ops", "incidents"], owner: "sre-team", desc: "Live incident status board", caps: [{ n: "IncidentList", d: "Show active incidents and severity", v: "see active incidents and severity" }, { n: "PostmortemLink", d: "Link to incident postmortems", v: "reach the postmortems" }] },
  { k: "deploy-status", h: "Deploy Status", cat: "ops", tags: ["ops", "deploys"], owner: "sre-team", desc: "Deployment pipeline status", caps: [{ n: "PipelineView", d: "Show deploy pipeline stages", v: "watch a deploy move through its stages" }] },
  { k: "feature-flags", h: "Feature Flags", cat: "platform", tags: ["platform", "flags"], owner: "platform-team", desc: "Feature flag management panel", caps: [{ n: "FlagList", d: "Toggle and target feature flags", v: "toggle and target feature flags" }] },
  { k: "survey-builder", h: "Survey Builder", cat: "growth", tags: ["growth", "survey"], owner: "research-team", desc: "Survey builder and preview", caps: [{ n: "BuilderCanvas", d: "Compose survey questions", v: "compose survey questions" }, { n: "PreviewPane", d: "Preview the survey", v: "preview the survey before sending" }] },
  { k: "wallet-overview", h: "Wallet Overview", cat: "fintech", tags: ["fintech", "wallet"], owner: "wallet-team", desc: "Crypto/cash wallet overview", caps: [{ n: "BalancePanel", d: "Show balances across accounts", v: "see balances across accounts" }, { n: "ActivityFeed", d: "Show recent transactions", v: "review recent transactions" }] },
  { k: "loan-application", h: "Loan Application", cat: "fintech", tags: ["fintech", "lending"], owner: "lending-team", desc: "Loan application and status", caps: [{ n: "ApplicationForm", d: "Submit a loan application", v: "apply for a loan" }, { n: "DecisionStatus", d: "Show the application decision", v: "see the lending decision" }] },
  { k: "asset-inspector", h: "Asset Inspector", cat: "ops", tags: ["ops", "assets"], owner: "facilities-team", desc: "Facility asset inspection log", caps: [{ n: "InspectionLog", d: "Log asset inspections", v: "log asset inspections" }] },
  { k: "reservation-desk", h: "Reservation Desk", cat: "hospitality", tags: ["hospitality", "reservations"], owner: "front-desk-team", desc: "Table/room reservation desk", caps: [{ n: "ReservationBoard", d: "Manage reservations by time", v: "manage reservations across the day" }] },
  { k: "loyalty-rewards", h: "Loyalty Rewards", cat: "commerce", tags: ["commerce", "loyalty"], owner: "growth-team", desc: "Loyalty points and rewards", caps: [{ n: "PointsPanel", d: "Show points and tier", v: "see their points and tier" }, { n: "RewardsGrid", d: "Redeem available rewards", v: "redeem rewards" }] },
  { k: "content-scheduler", h: "Content Scheduler", cat: "media", tags: ["media", "scheduling"], owner: "content-team", desc: "Editorial content calendar", caps: [{ n: "CalendarBoard", d: "Schedule content on a calendar", v: "schedule content on a calendar" }] },
  { k: "claims-desk", h: "Claims Desk", cat: "insurance", tags: ["insurance", "claims"], owner: "claims-team", desc: "Insurance claims processing desk", caps: [{ n: "ClaimQueue", d: "Work the claims queue", v: "work through the claims queue" }, { n: "ClaimDetail", d: "Review a claim's detail", v: "review a claim in detail" }] },
  { k: "policy-manager", h: "Policy Manager", cat: "insurance", tags: ["insurance", "policies"], owner: "policy-team", desc: "Policy management and renewals", caps: [{ n: "PolicyList", d: "Manage policies and renewals", v: "manage policies and renewals" }] },
  { k: "donor-portal", h: "Donor Portal", cat: "nonprofit", tags: ["nonprofit", "donations"], owner: "development-team", desc: "Donor giving history and campaigns", caps: [{ n: "GivingHistory", d: "Show a donor's giving history", v: "see their giving history" }, { n: "CampaignGrid", d: "Browse active campaigns", v: "browse active campaigns" }] },
  { k: "grant-tracker", h: "Grant Tracker", cat: "nonprofit", tags: ["nonprofit", "grants"], owner: "programs-team", desc: "Grant application pipeline", caps: [{ n: "GrantPipeline", d: "Track grants through the pipeline", v: "track grants through the pipeline" }] },
  { k: "lab-results", h: "Lab Results", cat: "health", tags: ["health", "labs"], owner: "clinical-team", desc: "Patient lab results viewer", caps: [{ n: "ResultsTable", d: "Review lab results with ranges", v: "review lab results against normal ranges" }] },
  { k: "prescription-refills", h: "Prescription Refills", cat: "health", tags: ["health", "pharmacy"], owner: "pharmacy-team", desc: "Prescription refill requests", caps: [{ n: "RefillRequest", d: "Request a prescription refill", v: "request a refill" }, { n: "RefillStatus", d: "Track refill status", v: "track a refill's status" }] },
  { k: "fleet-maintenance", h: "Fleet Maintenance", cat: "logistics", tags: ["logistics", "maintenance"], owner: "fleet-team", desc: "Vehicle maintenance scheduling", caps: [{ n: "MaintenanceBoard", d: "Schedule vehicle maintenance", v: "schedule vehicle maintenance" }] },
  { k: "gate-boarding", h: "Gate Boarding", cat: "travel", tags: ["travel", "boarding"], owner: "gate-team", desc: "Gate boarding and standby list", caps: [{ n: "BoardingList", d: "Manage boarding and standby", v: "manage boarding and the standby list" }] },
  { k: "classroom-roster", h: "Classroom Roster", cat: "education", tags: ["education", "roster"], owner: "teaching-team", desc: "Class roster and attendance", caps: [{ n: "AttendanceGrid", d: "Take attendance for a class", v: "take attendance" }] },
  { k: "moderation-queue", h: "Moderation Queue", cat: "trust", tags: ["trust", "moderation"], owner: "trust-team", desc: "Content moderation review queue", caps: [{ n: "ReviewQueue", d: "Review flagged content", v: "review flagged content" }, { n: "ActionBar", d: "Take a moderation action", v: "act on a flagged item" }] },
];

// ── Skeleton (structural template) from a real, data-free manifest ──────────
const skeletonText = readFileSync(join(ROOT, "examples/abc-kids/color-mixer/mfe-manifest.yaml"), "utf8");
const skeleton = yaml.load(skeletonText);
// Synthetic manifests use lean platform caps (lifecycle is optional) — keeps completions
// compact and distinct from the verbose real seeds, which keep their full lifecycle blocks.
const synthPlatformCaps = [{ Load: { type: "platform" } }, { Render: { type: "platform" } }];

const FRAMEWORKS = [
  { framework: "react", bundler: "rspack", langs: ["typescript", "javascript"] },
  { framework: "angular", bundler: "webpack", langs: ["typescript"] },
];
const TYPES = ["remote", "feature", "service"];

let port = 7000;
function buildManifest(dom, fw, lang, type, variantIx) {
  const suffix = variantIx === 0 ? "" : `-${variantIx + 1}`;
  const domainCaps = dom.caps.map((c) => ({ [c.n]: { type: "domain", description: c.d } }));
  const m = {
    name: `${dom.k}${suffix}`,
    version: `1.${variantIx}.0`,
    type,
    language: lang,
    framework: fw.framework,
    bundler: fw.bundler,
    description: dom.desc,
    owner: dom.owner,
    tags: dom.tags,
    category: dom.cat,
    endpoint: `http://localhost:${port}`,
    remoteEntry: `http://localhost:${port}/remoteEntry.js`,
    discovery: `http://localhost:${port}/.well-known/mfe-manifest.yaml`,
    capabilities: [...domainCaps, ...synthPlatformCaps],
  };
  port += 1;
  return m;
}

// ── Intent authoring (templated; realism guardrail: describe the domain, not fields) ──
// Framework hints avoid asserting the MFE `type` (which varies) — they signal framework only,
// so the model can learn to condition on framework when present and default otherwise.
const FW_HINTS = { react: [" Build it in React.", " We're a React shop.", "", ""], angular: [" The Angular team owns this.", " Build it on Angular.", " It's for the Angular stack."] };
function authorIntent(dom, fw) {
  const verbs = dom.caps.map((c) => c.v);
  const capList = verbs.length === 1 ? verbs[0] : `${verbs.slice(0, -1).join(", ")} and ${verbs[verbs.length - 1]}`;
  const article = /^[aeiou]/i.test(dom.h) ? "an" : "a";
  const hint = fw.framework === "angular" ? pick(FW_HINTS.angular) : pick(FW_HINTS.react);
  const templates = [
    `We need ${article} ${dom.h.toLowerCase()} where users can ${capList}.${hint}`,
    `Product wants ${article} ${dom.h.toLowerCase()} — somewhere people ${capList}. Ship it as an independently deployable piece.${hint}`,
    `Build ${article} ${dom.h.toLowerCase()} for the platform: users should be able to ${capList}.${hint}`,
    `Give me ${article} ${dom.h.toLowerCase()} so the team can ${capList}.${hint}`,
    `We're adding ${article} ${dom.h.toLowerCase()} — the goal is to let people ${capList}.${hint}`,
  ];
  return pick(templates).trim();
}

// ── Collect pairs ───────────────────────────────────────────────────────────
const pairs = [];
const seenExact = new Set();
const diversityCount = new Map();
let dropInvalid = 0;
let dropDup = 0;
let dropCap = 0;
let dropTok = 0;

function completionOf(obj) {
  return yaml.dump(obj, { lineWidth: 100, noRefs: true }).trimEnd();
}
function tryAdd(prompt, completion, source) {
  if (tok(prompt) > HARD_TOK_CAP || tok(completion) > HARD_TOK_CAP) { dropTok++; return false; }
  const exact = `${prompt} ${completion}`;
  if (seenExact.has(exact)) { dropDup++; return false; }
  seenExact.add(exact);
  pairs.push({ prompt, completion, _source: source });
  return true;
}

// 1) Seed pairs — real manifests × hand intents.
for (const relPath of SEED_PATHS) {
  const text = readFileSync(join(ROOT, relPath), "utf8").trimEnd();
  const parsed = yaml.load(text);
  const r = validateFull(parsed);
  if (!r.valid) { console.error(`SEED INVALID: ${relPath} ->`, r.errors); process.exit(1); }
  const intents = seedIntents[relPath];
  if (!Array.isArray(intents)) { console.error(`no seed intents for ${relPath}`); process.exit(1); }
  for (const intent of intents) tryAdd(intent, text, "seed");
}
const seedCount = pairs.length;

// 2) Synthetic pairs — reskins, validator-gated, diversity-capped.
outer: for (let variantIx = 0; variantIx < 8; variantIx++) {
  for (const dom of DOMAINS) {
    for (const fw of FRAMEWORKS) {
      for (const lang of fw.langs) {
        for (const type of TYPES) {
          if (pairs.length >= TARGET_TOTAL) break outer;
          const divKey = `${dom.caps.map((c) => c.n).join(",")}|${fw.framework}|${lang}|${type}`;
          const seen = diversityCount.get(divKey) ?? 0;
          if (seen >= DIVERSITY_CAP) { dropCap++; continue; }
          const m = buildManifest(dom, fw, lang, type, variantIx);
          const r = validateFull(m);
          if (!r.valid) { dropInvalid++; continue; }
          const completion = completionOf(m);
          const prompt = authorIntent(dom, fw);
          if (tryAdd(prompt, completion, "synth")) diversityCount.set(divKey, seen + 1);
        }
      }
    }
  }
}

// ── Stats ───────────────────────────────────────────────────────────────────
const promptToks = pairs.map((p) => tok(p.prompt));
const compToks = pairs.map((p) => tok(p.completion));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
// Near-dup rate: fraction of completions sharing a normalized structural signature (name/version/desc/ports stripped).
// Near-dup signature: strip only the always-varying scaffolding (name, version, ports).
// Keep description/tags/capabilities — the content that makes two manifests genuinely distinct.
const sig = (c) => c.replace(/^name:.*$/m, "").replace(/^version:.*$/m, "").replace(/localhost:\d+/g, "localhost");
// Redundancy is measured at the RECORD level (prompt + normalized completion): the same
// manifest paired with different intents is intentional phrase-robustness augmentation, not a
// duplicate. Two records are near-dup only when both the intent and the structural completion match.
const recCounts = new Map();
for (const p of pairs) { const s = `${p.prompt} ${sig(p.completion)}`; recCounts.set(s, (recCounts.get(s) ?? 0) + 1); }
let nearDup = 0;
for (const c of recCounts.values()) if (c > 1) nearDup += c - 1;
const dupRate = nearDup / pairs.length;
const distinctCompletions = new Set(pairs.map((p) => sig(p.completion))).size;

const stats = {
  seed: SEED, pairs: pairs.length, seed_pairs: seedCount, synth_pairs: pairs.length - seedCount,
  distinct_completions: distinctCompletions, distinct_domains: DOMAINS.length,
  prompt_tok: { mean: +mean(promptToks).toFixed(1), p50: pct(promptToks, 0.5), p95: pct(promptToks, 0.95) },
  completion_tok: { mean: +mean(compToks).toFixed(1), p50: pct(compToks, 0.5), p95: pct(compToks, 0.95) },
  near_dup_rate: +dupRate.toFixed(4),
  dropped: { invalid: dropInvalid, exact_dup: dropDup, diversity_capped: dropCap, over_tok: dropTok },
  targets: { total: TARGET_TOTAL, prompt_mean_lt: MAX_PROMPT_TOK, completion_mean_lt: MAX_COMPLETION_TOK, dup_rate_lt: 0.05 },
};

// ── Write outputs ────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const jsonl = (rows) => rows.map((p) => JSON.stringify({ prompt: p.prompt, completion: p.completion })).join("\n") + "\n";
// Deterministic shuffle for split (seeded Fisher-Yates), keep a held-out eval slice from synth+seed mix.
const shuffled = [...pairs];
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
const evalN = Math.min(40, Math.floor(shuffled.length * 0.05));
const evalRows = shuffled.slice(0, evalN);
const rest = shuffled.slice(evalN);
const trainN = Math.floor(rest.length * TRAIN_RATIO);
const trainRows = rest.slice(0, trainN);
const validRows = rest.slice(trainN);

writeFileSync(join(OUT, "pairs.jsonl"), jsonl(pairs));
writeFileSync(join(OUT, "train.jsonl"), jsonl(trainRows));
writeFileSync(join(OUT, "valid.jsonl"), jsonl(validRows));
writeFileSync(join(OUT, "eval.jsonl"), jsonl(evalRows));
writeFileSync(join(OUT, "stats.json"), JSON.stringify(stats, null, 2) + "\n");

// ── Report + gate ─────────────────────────────────────────────────────────────
console.log(JSON.stringify(stats, null, 2));
const fail = [];
if (pairs.length < TARGET_TOTAL) fail.push(`only ${pairs.length} pairs (< ${TARGET_TOTAL})`);
if (stats.prompt_tok.mean >= MAX_PROMPT_TOK) fail.push(`prompt mean ${stats.prompt_tok.mean} >= ${MAX_PROMPT_TOK}`);
if (stats.completion_tok.mean >= MAX_COMPLETION_TOK) fail.push(`completion mean ${stats.completion_tok.mean} >= ${MAX_COMPLETION_TOK}`);
if (dupRate >= 0.05) fail.push(`near-dup rate ${(dupRate * 100).toFixed(1)}% >= 5%`);
if (fail.length) { console.error("\nCORPUS GATE FAILED:\n - " + fail.join("\n - ")); process.exit(1); }
console.log(`\nOK: ${pairs.length} pairs (${seedCount} seed + ${pairs.length - seedCount} synth), all schema-valid.`);
