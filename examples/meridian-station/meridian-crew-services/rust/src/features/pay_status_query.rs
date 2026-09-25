//! The GraphQL document backing the `PayStatus` capability.
//!
//! Seeded once by seans-mfe-tool, then yours. The generated
//! `platform::bff_data_provider` sends `DOCUMENT` to this MFE's BFF and
//! decodes the `data` object into `PayStatusOutputs`; the browser build's
//! renderer sends the same document through the `query` capability.
//!
//! `payroll` is StellarLedger's `listPayroll.result`, hoisted at the graph
//! (see `data.sources` in the manifest) — the query `PayStatus.tsx` sends.

pub const DOCUMENT: &str = "query PayStatus { payroll { payrollId crewRef grossCents status } }";
