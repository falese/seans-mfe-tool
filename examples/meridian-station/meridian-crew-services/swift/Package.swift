// swift-tools-version:5.9
// Seeded once by seans-mfe-tool, then yours — add dependencies freely.

import PackageDescription

let package = Package(
    name: "MeridianCrewServices",
    platforms: [
        .iOS(.v17),
        .macOS(.v13)
    ],
    products: [
        .library(name: "MeridianCrewServices", targets: ["MeridianCrewServices"])
    ],
    targets: [
        // `path:` is explicit so the generator can use fixed output paths —
        // the file plan's `out` is a static string, not a function of the
        // module name.
        .target(
            name: "MeridianCrewServices",
            path: "Sources/MFE",
            plugins: [.plugin(name: "ManifestCodegen")]
        ),
        // Re-derives the capability table from mfe-manifest.json on every
        // `swift build`, so the manifest stays the single source inside Xcode
        // and not only inside the CLI (ADR-095).
        .plugin(
            name: "ManifestCodegen",
            capability: .buildTool(),
            dependencies: ["ManifestMetadataGen"],
            path: "Plugins/ManifestCodegen"
        ),
        // The executable the plugin runs. A build-tool plugin declares
        // commands; it cannot write files itself, so the JSON→Swift step is a
        // real (tiny) executable target.
        .executableTarget(
            name: "ManifestMetadataGen",
            path: "Sources/ManifestMetadataGen"
        ),
        .testTarget(
            name: "MeridianCrewServicesTests",
            dependencies: ["MeridianCrewServices"],
            path: "Tests/MFETests"
        )
    ]
)
