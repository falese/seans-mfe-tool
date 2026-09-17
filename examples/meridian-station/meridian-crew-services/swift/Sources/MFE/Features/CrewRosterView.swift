// Seeded once by seans-mfe-tool, then yours.
//
// DEVELOPER-OWNED: `remote:generate` will never rewrite this file, the same way
// it never rewrites `src/features/**` in the web lane. Edit freely.
//
// One file per capability, mirroring the web lane's
// `src/features/<Cap>/<Cap>.tsx`. Adding a capability to mfe-manifest.yaml
// creates its own file here — it does not exist yet, so regeneration writes it
// — and the package keeps compiling.

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

// `PreviewProvider` rather than `#Preview`: the macro needs Xcode's
// PreviewsMacros plugin, so a `#Preview` block fails `swift build` on the
// command line. This form renders in the Xcode canvas and compiles anywhere
// SwiftUI does.
struct CrewRosterView_Previews: PreviewProvider {
    static var previews: some View {
        CrewRosterView()
    }
}

#endif
