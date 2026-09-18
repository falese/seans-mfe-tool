// Seeded once by seans-mfe-tool, then yours.
//
// DEVELOPER-OWNED: `remote:generate` will never rewrite this file, the same way
// it never rewrites `src/features/**` in the web lane. Edit freely.
//
// One file per capability, mirroring the web lane's
// `src/features/<Cap>/<Cap>.tsx`. Adding a capability to mfe-manifest.yaml
// creates its own file here — it does not exist yet, so regeneration writes it
// — and the package keeps compiling.
//
// The view is wired to the data provider the same way the web lane's feature
// scaffold comes with its hook call and loading/error states: it already asks
// `provider.payStatus()` and renders loading / error / loaded. What is
// left for you is the "render real data" branch, once `PayStatusOutputs`
// (Platform/Types.swift) has fields.

import Foundation
#if canImport(SwiftUI)
import SwiftUI

/// Compact pay-status card for the console status rail — held and scheduled payroll at a glance
public struct PayStatusView: View {
    @State private var output: PayStatusOutputs?
    @State private var error: Error?
    private let provider: any MeridianCrewServicesDataProvider

    /// `provider` is the one the MFE was constructed with when this view is
    /// reached through `CapabilityViewRegistry`; the BFF-backed provider is the
    /// default for hosts instantiating the view directly.
    public init(provider: any MeridianCrewServicesDataProvider = BFFMeridianCrewServicesDataProvider()) {
        self.provider = provider
    }

    public var body: some View {
        Group {
            if output != nil {
                // TODO: `if let output` and render the PayStatus data.
                VStack(alignment: .leading, spacing: 8) {
                    Text("PayStatus")
                        .font(.headline)
                    Text("Compact pay-status card for the console status rail — held and scheduled payroll at a glance")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding()
            } else if let error {
                Text(error.localizedDescription)
                    .foregroundStyle(.red)
                    .padding()
            } else {
                ProgressView()
                    .padding()
            }
        }
        .task {
            do {
                output = try await provider.payStatus()
            } catch {
                self.error = error
            }
        }
    }
}

/// Canned data for the preview canvas, so it renders without a BFF running.
private struct PayStatusPreviewData: MeridianCrewServicesDataProvider {
    func crewRoster() async throws -> CrewRosterOutputs { CrewRosterOutputs() }
    func payStatus() async throws -> PayStatusOutputs { PayStatusOutputs() }
}

// `PreviewProvider` rather than `#Preview`: the macro needs Xcode's
// PreviewsMacros plugin, so a `#Preview` block fails `swift build` on the
// command line. This form renders in the Xcode canvas and compiles anywhere
// SwiftUI does.
struct PayStatusView_Previews: PreviewProvider {
    static var previews: some View {
        PayStatusView(provider: PayStatusPreviewData())
    }
}

#endif
