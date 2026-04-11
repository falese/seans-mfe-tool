#!/usr/bin/env node

import { query, type Options, type SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";
import { RequirementPrompter } from "./prompter.js";
import { RequirementDocGenerator } from "./doc-generator.js";
import path from "path";
import fs from "fs/promises";

interface RequirementSession {
  sessionId: string;
  timestamp: Date;
  requirements: Requirement[];
  context: ProjectContext;
}

interface Requirement {
  id: string;
  type: RequirementType;
  category: string;
  title: string;
  description: string;
  rationale: string;
  acceptanceCriteria: string[];
  relatedRequirements: string[];
  priority: "critical" | "high" | "medium" | "low";
  status: "draft" | "proposed" | "approved" | "implemented";
}

type RequirementType = "functional" | "non-functional" | "technical" | "architectural";

interface ProjectContext {
  existingRequirements: string[];
  mfeTypes: string[];
  capabilities: string[];
  platformHandlers: string[];
}

export class RequirementsElicitationAgent {
  private projectRoot: string;
  private docsPath: string;
  private prompter: RequirementPrompter;
  private docGenerator: RequirementDocGenerator;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.docsPath = path.join(projectRoot, "docs");
    this.prompter = new RequirementPrompter();
    this.docGenerator = new RequirementDocGenerator(this.docsPath);
  }

  /**
   * Main entry point for requirements elicitation
   */
  async elicitRequirements(mode: "interactive" | "analyze" | "generate" | "comprehensive"): Promise<RequirementSession> {
    console.log("🔍 MFE Platform Requirements Elicitation Agent");
    console.log("=".repeat(60));

    const context = await this.gatherProjectContext();
    let requirements: Requirement[] = [];

    switch (mode) {
      case "interactive":
        requirements = await this.runInteractiveSession(context);
        break;
      case "analyze":
        requirements = await this.analyzeExistingDocuments(context);
        break;
      case "generate":
        requirements = await this.generateRequirementDocuments(context);
        break;
      case "comprehensive":
        requirements = await this.runComprehensiveSession(context);
        break;
    }

    const session: RequirementSession = {
      sessionId: `REQ-SESSION-${new Date().toISOString().split('T')[0]}`,
      timestamp: new Date(),
      requirements,
      context
    };

    await this.saveSession(session);
    return session;
  }

  /**
   * Gather context about the MFE platform
   */
  private async gatherProjectContext(): Promise<ProjectContext> {
    console.log("\n📊 Gathering project context...");

    const options: Options = {
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      systemPrompt: `You are a requirements analysis assistant for an MFE platform.
Your task is to gather context about the existing system by reading documentation and code.
Be thorough but concise in your analysis.`,
      cwd: this.projectRoot,
      maxTurns: 5
    };

    const contextPrompt = `Analyze this MFE platform project and provide:
1. List of all existing requirement IDs (REQ-XXX format) found in docs/requirements/
2. All MFE types defined in the DSL (from src/dsl/schema.ts or docs/)
3. All capabilities mentioned in the platform (load, render, refresh, query, emit, etc.)
4. All platform handlers (auth, validation, error-handling, etc.)

Provide output as structured lists.`;

    let analysisResult = "";

    for await (const message of query({
      prompt: contextPrompt,
      options
    })) {
      if (message.type === "assistant") {
        const assistantMessage = message as SDKAssistantMessage;
        const apiMessage = assistantMessage.message;
        for (const block of apiMessage.content) {
          if (block.type === "text") {
            analysisResult += block.text;
          }
        }
      }
    }

    return this.parseContextFromAnalysis(analysisResult);
  }

  /**
   * Parse context from agent analysis
   */
  private parseContextFromAnalysis(analysis: string): ProjectContext {
    const existingReqPattern = /REQ-[A-Z]+-\d+/g;
    const existingRequirements = [...new Set(analysis.match(existingReqPattern) || [])];

    return {
      existingRequirements,
      mfeTypes: ["tool", "agent", "feature", "service", "remote", "shell", "bff"],
      capabilities: ["load", "render", "refresh", "query", "emit", "health", "telemetry"],
      platformHandlers: ["auth", "validation", "error-handling", "caching", "rate-limiting", "telemetry"]
    };
  }

  /**
   * Run interactive requirements gathering session
   */
  private async runInteractiveSession(context: ProjectContext): Promise<Requirement[]> {
    console.log("\n💬 Starting interactive requirements session...\n");

    const requirements: Requirement[] = [];
    const sessionData = await this.prompter.runInteractivePrompts(context);

    for (const reqData of sessionData) {
      const requirement = await this.createRequirementWithAI(reqData, context);
      requirements.push(requirement);
      console.log(`✅ Created ${requirement.id}: ${requirement.title}`);
    }

    return requirements;
  }

  /**
   * Analyze existing documents and extract/validate requirements
   */
  private async analyzeExistingDocuments(context: ProjectContext): Promise<Requirement[]> {
    console.log("\n📖 Analyzing existing documentation...\n");

    const options: Options = {
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      systemPrompt: `You are a requirements extraction specialist for an MFE platform.
Your task is to analyze existing documentation and extract structured requirements.
Look for:
- Explicit requirements (REQ-XXX format)
- Implicit requirements in ADRs
- Missing or inconsistent requirements
- Requirements that need clarification`,
      cwd: this.projectRoot,
      maxTurns: 10
    };

    const analysisPrompt = `Analyze all documentation in the docs/ directory:
1. Extract all existing requirements from docs/requirements/
2. Identify implicit requirements in ADRs (docs/architecture-decisions/)
3. Find gaps or inconsistencies in requirements coverage
4. Suggest new requirements based on architectural decisions
5. Cross-reference runtime requirements with BFF requirements

For each requirement found or suggested, provide:
- ID (if exists) or suggest new ID
- Type (functional/non-functional/technical/architectural)
- Category (runtime/bff/dsl/platform/etc.)
- Title
- Description
- Rationale
- Related requirements`;

    const requirements: Requirement[] = [];
    let analysisOutput = "";

    for await (const message of query({
      prompt: analysisPrompt,
      options
    })) {
      if (message.type === "assistant") {
        const assistantMessage = message as SDKAssistantMessage;
        const apiMessage = assistantMessage.message;
        for (const block of apiMessage.content) {
          if (block.type === "text") {
            analysisOutput += block.text;
            console.log(block.text);
          }
        }
      }
    }

    return requirements;
  }

  /**
   * Generate requirement documents in proper format
   */
  private async generateRequirementDocuments(_context: ProjectContext): Promise<Requirement[]> {
    console.log("\n📝 Generating requirement documents...\n");

    const requirements: Requirement[] = [];

    // This would use the doc-generator to create formatted documents
    // For now, return empty array as this is a placeholder

    return requirements;
  }

  /**
   * Run comprehensive session (all modes combined)
   */
  private async runComprehensiveSession(context: ProjectContext): Promise<Requirement[]> {
    console.log("\n🚀 Running comprehensive requirements session...\n");

    const requirements: Requirement[] = [];

    // 1. Analyze existing docs
    console.log("Phase 1: Analyzing existing documentation");
    const existingReqs = await this.analyzeExistingDocuments(context);
    requirements.push(...existingReqs);

    // 2. Interactive session for new requirements
    console.log("\nPhase 2: Interactive requirements gathering");
    const newReqs = await this.runInteractiveSession(context);
    requirements.push(...newReqs);

    // 3. Generate documentation
    console.log("\nPhase 3: Generating requirement documents");
    await this.docGenerator.generateRequirementDocs(requirements, context);

    return requirements;
  }

  /**
   * Use AI to create well-formed requirement from user input
   */
  private async createRequirementWithAI(
    rawData: unknown,
    context: ProjectContext
  ): Promise<Requirement> {
    const options: Options = {
      allowedTools: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      systemPrompt: `You are a requirements engineering expert for an MFE platform.
Transform user input into well-structured requirements following these guidelines:
- Use clear, testable language
- Include specific acceptance criteria
- Reference related requirements
- Provide strong rationale
- Consider MFE platform context`,
      maxTurns: 1
    };

    const prompt = `Create a structured requirement from this input:
${JSON.stringify(rawData, null, 2)}

Context:
- Existing requirements: ${context.existingRequirements.join(", ")}
- MFE types: ${context.mfeTypes.join(", ")}
- Capabilities: ${context.capabilities.join(", ")}

Provide the requirement in this JSON format:
{
  "id": "REQ-[CATEGORY]-XXX",
  "type": "functional|non-functional|technical|architectural",
  "category": "runtime|bff|dsl|platform|etc",
  "title": "Brief title",
  "description": "Detailed description",
  "rationale": "Why this requirement is needed",
  "acceptanceCriteria": ["criterion 1", "criterion 2"],
  "relatedRequirements": ["REQ-XXX-YYY"],
  "priority": "critical|high|medium|low",
  "status": "draft"
}`;

    let result = "";
    for await (const message of query({ prompt, options })) {
      if (message.type === "assistant") {
        const assistantMessage = message as SDKAssistantMessage;
        const apiMessage = assistantMessage.message;
        for (const block of apiMessage.content) {
          if (block.type === "text") {
            result += block.text;
          }
        }
      }
    }

    // Parse JSON from result
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback if parsing fails
    const rawDataObj = rawData as Record<string, unknown>;
    return {
      id: `REQ-DRAFT-${Date.now()}`,
      type: "functional",
      category: (rawDataObj.category as string) || "general",
      title: (rawDataObj.title as string) || "Untitled Requirement",
      description: (rawDataObj.description as string) || "",
      rationale: (rawDataObj.rationale as string) || "",
      acceptanceCriteria: (rawDataObj.acceptanceCriteria as string[]) || [],
      relatedRequirements: [],
      priority: (rawDataObj.priority as "critical" | "high" | "medium" | "low") || "medium",
      status: "draft"
    };
  }

  /**
   * Save requirement session to disk
   */
  private async saveSession(session: RequirementSession): Promise<void> {
    const sessionDir = path.join(this.docsPath, "requirement-sessions");
    const sessionFile = path.join(sessionDir, `${session.sessionId}.json`);

    // Ensure directory exists
    await fs.mkdir(sessionDir, { recursive: true });

    // Save session as JSON
    await fs.writeFile(
      sessionFile,
      JSON.stringify(session, null, 2),
      "utf-8"
    );

    console.log(`\n💾 Session saved to: ${sessionFile}`);
    console.log(`📋 Total requirements: ${session.requirements.length}`);
  }
}

// CLI Interface
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;
if (isMainModule) {
  const mode = (process.argv[2] as "interactive" | "analyze" | "generate" | "comprehensive") || "comprehensive";
  const agent = new RequirementsElicitationAgent();

  agent.elicitRequirements(mode)
    .then((session) => {
      console.log("\n✨ Requirements elicitation complete!");
      console.log(`Session ID: ${session.sessionId}`);
    })
    .catch((error) => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}

export default RequirementsElicitationAgent;
