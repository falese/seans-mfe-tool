// Seeded once by seans-mfe-tool, then yours.
//
// This file is DEVELOPER-OWNED: `remote:generate` will never rewrite it, the
// same way it never rewrites `src/features/**` in the web lane. Edit freely.
//
// `Platform/CapabilityViewRegistry.swift` beside it IS regenerated. If you add
// a capability to mfe-manifest.yaml, the registry gains an entry and this file
// will not compile until you add the matching view below — that build failure
// is the migration notice.

import Foundation
#if canImport(SwiftUI)
import SwiftUI

/// Crew roster with certifications from StationOS joined with payroll standing from StellarLedger
public struct CrewRosterView: View {
    public init() {}

    public var body: some View {
        // TODO: implement the CrewRoster capability.
        VStack(alignment: .leading, spacing: 8) {
            Text("CrewRoster")
                .font(.headline)
            Text("Crew roster with certifications from StationOS joined with payroll standing from StellarLedger")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

/// Compact pay-status card for the console status rail — held and scheduled payroll at a glance
public struct PayStatusView: View {
    public init() {}

    public var body: some View {
        // TODO: implement the PayStatus capability.
        VStack(alignment: .leading, spacing: 8) {
            Text("PayStatus")
                .font(.headline)
            Text("Compact pay-status card for the console status rail — held and scheduled payroll at a glance")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

#endif
