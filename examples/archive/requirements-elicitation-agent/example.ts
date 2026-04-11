#!/usr/bin/env ts-node

/**
 * Example usage of the Requirements Elicitation Agent
 *
 * This demonstrates how to use the agent programmatically
 * or as a standalone script.
 */

import RequirementsElicitationAgent from "./requirements-agent";
import path from "path";

async function main() {
  console.log("🚀 Requirements Elicitation Agent - Example Usage\n");

  // Initialize agent with project root
  const projectRoot = path.join(__dirname, "..", "..");
  const agent = new RequirementsElicitationAgent(projectRoot);

  console.log("Project root:", projectRoot);
  console.log();

  // Get mode from command line argument or default to interactive
  const mode = (process.argv[2] as "interactive" | "analyze" | "generate" | "comprehensive") || "interactive";

  console.log(`Running in ${mode.toUpperCase()} mode...\n`);

  try {
    // Run the elicitation session
    const session = await agent.elicitRequirements(mode);

    // Display results
    console.log("\n" + "=".repeat(60));
    console.log("✅ Session Complete!");
    console.log("=".repeat(60));
    console.log(`Session ID: ${session.sessionId}`);
    console.log(`Timestamp: ${session.timestamp.toISOString()}`);
    console.log(`Requirements gathered: ${session.requirements.length}`);
    console.log();

    if (session.requirements.length > 0) {
      console.log("Requirements Summary:");
      console.log("─".repeat(60));

      session.requirements.forEach((req, index) => {
        const priEmoji = {
          critical: "🔴",
          high: "🟠",
          medium: "🟡",
          low: "🟢"
        };

        console.log(`${index + 1}. ${priEmoji[req.priority]} ${req.id}: ${req.title}`);
        console.log(`   Category: ${req.category.toUpperCase()}`);
        console.log(`   Status: ${req.status}`);
        console.log();
      });
    }

    console.log("Project Context:");
    console.log("─".repeat(60));
    console.log(`Existing requirements: ${session.context.existingRequirements.length}`);
    console.log(`MFE types: ${session.context.mfeTypes.join(", ")}`);
    console.log(`Capabilities: ${session.context.capabilities.join(", ")}`);
    console.log(`Platform handlers: ${session.context.platformHandlers.join(", ")}`);
    console.log();

    console.log("📁 Output locations:");
    console.log(`   Requirements: docs/requirements/`);
    console.log(`   Acceptance Criteria: docs/acceptance-criteria/`);
    console.log(`   Session data: docs/requirement-sessions/`);

  } catch (error) {
    console.error("\n❌ Error during requirements elicitation:");
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default main;
