#!/usr/bin/env node
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
export declare class RequirementsElicitationAgent {
    private projectRoot;
    private docsPath;
    private prompter;
    private docGenerator;
    constructor(projectRoot?: string);
    /**
     * Main entry point for requirements elicitation
     */
    elicitRequirements(mode: "interactive" | "analyze" | "generate" | "comprehensive"): Promise<RequirementSession>;
    /**
     * Gather context about the MFE platform
     */
    private gatherProjectContext;
    /**
     * Parse context from agent analysis
     */
    private parseContextFromAnalysis;
    /**
     * Run interactive requirements gathering session
     */
    private runInteractiveSession;
    /**
     * Analyze existing documents and extract/validate requirements
     */
    private analyzeExistingDocuments;
    /**
     * Generate requirement documents in proper format
     */
    private generateRequirementDocuments;
    /**
     * Run comprehensive session (all modes combined)
     */
    private runComprehensiveSession;
    /**
     * Use AI to create well-formed requirement from user input
     */
    private createRequirementWithAI;
    /**
     * Save requirement session to disk
     */
    private saveSession;
}
export default RequirementsElicitationAgent;
//# sourceMappingURL=requirements-agent.d.ts.map