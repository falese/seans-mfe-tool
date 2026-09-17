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

// `PreviewProvider` rather than `#Preview`: the macro needs Xcode's
// PreviewsMacros plugin, so a `#Preview` block fails `swift build` on the
// command line. This form renders in the Xcode canvas and compiles anywhere
// SwiftUI does.
struct PayStatusView_Previews: PreviewProvider {
    static var previews: some View {
        PayStatusView()
    }
}

#endif
