//! The GraphQL document backing the `CrewRoster` capability.
//!
//! Seeded once by seans-mfe-tool, then yours. The generated
//! `platform::bff_data_provider` sends `DOCUMENT` to this MFE's BFF and
//! decodes the `data` object into `CrewRosterOutputs`; the browser build's
//! renderer sends the same document through the `query` capability.
//!
//! Three lists from two sources, each envelope hoisted at the graph (see
//! `data.sources` in the manifest) — the query `CrewRoster.tsx` sends.

pub const DOCUMENT: &str = "query CrewRoster { \
crew { crewId crewMemberName section dutyStatus } \
certifications { crewId certificationCode status } \
payroll { crewRef grossCents status } }";
