interface ProjectContext {
    existingRequirements: string[];
    mfeTypes: string[];
    capabilities: string[];
    platformHandlers: string[];
}
interface RequirementInput {
    category: string;
    title: string;
    description: string;
    rationale: string;
    priority: "critical" | "high" | "medium" | "low";
    acceptanceCriteria: string[];
    relatedArea: string;
}
export declare class RequirementPrompter {
    /**
     * Run interactive prompts to gather requirements from user
     */
    runInteractivePrompts(context: ProjectContext): Promise<RequirementInput[]>;
    /**
     * Prompt for a single requirement
     */
    private promptForSingleRequirement;
    /**
     * Get related area choices based on category
     */
    private getRelatedAreaChoices;
    /**
     * Prompt for acceptance criteria (Given-When-Then style)
     */
    private promptForAcceptanceCriteria;
    /**
     * Quick mode - gather multiple requirements with minimal prompts
     */
    quickMode(context: ProjectContext): Promise<RequirementInput[]>;
}
export {};
//# sourceMappingURL=prompter.d.ts.map