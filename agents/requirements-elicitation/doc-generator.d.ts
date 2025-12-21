interface Requirement {
    id: string;
    type: "functional" | "non-functional" | "technical" | "architectural";
    category: string;
    title: string;
    description: string;
    rationale: string;
    acceptanceCriteria: string[];
    relatedRequirements: string[];
    priority: "critical" | "high" | "medium" | "low";
    status: "draft" | "proposed" | "approved" | "implemented";
}
interface ProjectContext {
    existingRequirements: string[];
    mfeTypes: string[];
    capabilities: string[];
    platformHandlers: string[];
}
export declare class RequirementDocGenerator {
    private docsPath;
    private requirementsPath;
    private acceptanceCriteriaPath;
    constructor(docsPath: string);
    /**
     * Generate requirement documents in the project's standard format
     */
    generateRequirementDocs(requirements: Requirement[], context: ProjectContext): Promise<void>;
    /**
     * Ensure output directories exist
     */
    private ensureDirectoriesExist;
    /**
     * Generate individual requirement document
     */
    private generateRequirementFile;
    /**
     * Format requirement as markdown document
     */
    private formatRequirementDocument;
    /**
     * Format acceptance criteria section
     */
    private formatAcceptanceCriteria;
    /**
     * Format related requirements section
     */
    private formatRelatedRequirements;
    /**
     * Generate acceptance criteria file (GWT format)
     */
    private generateAcceptanceCriteriaFile;
    /**
     * Format as Gherkin feature file
     */
    private formatFeatureFile;
    /**
     * Format acceptance criteria as Gherkin scenarios
     */
    private formatGherkinScenarios;
    /**
     * Generate summary document of all requirements
     */
    private generateRequirementsSummary;
    /**
     * Group requirements by category
     */
    private groupByCategory;
    /**
     * Group requirements by priority
     */
    private groupByPriority;
    /**
     * Group requirements by status
     */
    private groupByStatus;
    /**
     * Format category section
     */
    private formatCategorySection;
    /**
     * Format priority section
     */
    private formatPrioritySection;
    /**
     * Format status section
     */
    private formatStatusSection;
    /**
     * Format full list of requirements
     */
    private formatFullList;
}
export {};
//# sourceMappingURL=doc-generator.d.ts.map