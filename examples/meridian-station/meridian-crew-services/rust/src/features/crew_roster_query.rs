//! The GraphQL document backing the `CrewRoster` capability.
//!
//! Seeded once by seans-mfe-tool, then yours. The generated
//! `platform::bff_data_provider` sends `DOCUMENT` to this MFE's BFF and
//! decodes the `data` object into `CrewRosterOutputs`.
//!
//! The field names come from the BFF's schema, which GraphQL Mesh composes
//! from `data.sources` at build time — so codegen cannot know them. Open the
//! playground at `http://localhost:5005/graphql`, write the query, and paste it here.

/// TODO: replace `__typename` with the fields `CrewRoster` needs.
pub const DOCUMENT: &str = "query CrewRoster { __typename }";
