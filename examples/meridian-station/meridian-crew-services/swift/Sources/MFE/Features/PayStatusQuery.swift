// Seeded once by seans-mfe-tool, then yours.
//
// DEVELOPER-OWNED. The GraphQL document backing the PayStatus capability.
//
// The generator cannot write this: your BFF's schema is composed by GraphQL
// Mesh from the manifest's `data.sources` at build time, so the field names
// come from your OpenAPI specs, not from anything codegen can see. Same split
// as the web lane, where `src/platform/bff/bff.ts` is generated and the query
// itself is written in the feature component.
//
// Run the BFF and open its playground to explore the schema:
//   http://localhost:5005/graphql

import Foundation

public enum PayStatusQuery {
    /// TODO: replace with a real query against your BFF's schema.
    ///
    /// Whatever this selects must decode into `PayStatusOutputs`
    /// (Platform/Types.swift), which is currently empty — add its fields there
    /// as you add them here.
    public static let document = """
        query PayStatus {
            __typename
        }
        """
}
