import inquirer from "inquirer";

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

export class RequirementPrompter {
  /**
   * Run interactive prompts to gather requirements from user
   */
  async runInteractivePrompts(context: ProjectContext): Promise<RequirementInput[]> {
    const requirements: RequirementInput[] = [];
    let addMore = true;

    console.log("\n📝 Interactive Requirements Gathering");
    console.log("Answer the following questions to define new requirements.\n");

    while (addMore) {
      const requirement = await this.promptForSingleRequirement(context);
      requirements.push(requirement);

      const { continueAdding } = await inquirer.prompt([
        {
          type: "confirm",
          name: "continueAdding",
          message: "Would you like to add another requirement?",
          default: true
        }
      ]);

      addMore = continueAdding;
    }

    return requirements;
  }

  /**
   * Prompt for a single requirement
   */
  private async promptForSingleRequirement(context: ProjectContext): Promise<RequirementInput> {
    console.log("\n" + "─".repeat(60));

    // Step 1: Category selection
    const categoryAnswers = await inquirer.prompt([
      {
        type: "list",
        name: "category",
        message: "What category does this requirement belong to?",
        choices: [
          { name: "Runtime Platform (REQ-RUNTIME-XXX)", value: "runtime" },
          { name: "Backend for Frontend (REQ-BFF-XXX)", value: "bff" },
          { name: "DSL Contract (REQ-DSL-XXX)", value: "dsl" },
          { name: "Platform Handlers (REQ-HANDLER-XXX)", value: "handler" },
          { name: "Features (REQ-FEATURE-XXX)", value: "feature" },
          { name: "Code Generation (REQ-CODEGEN-XXX)", value: "codegen" },
          { name: "Testing (REQ-TEST-XXX)", value: "test" },
          { name: "Deployment (REQ-DEPLOY-XXX)", value: "deploy" },
          { name: "Other", value: "other" }
        ]
      }
    ]);

    // Step 2: Related area (based on category)
    const relatedAreaChoices = this.getRelatedAreaChoices(categoryAnswers.category, context);
    const areaAnswers = await inquirer.prompt([
      {
        type: "list",
        name: "relatedArea",
        message: "Which area does this requirement relate to?",
        choices: relatedAreaChoices
      }
    ]);

    // Step 3: Core requirement details
    const coreAnswers = await inquirer.prompt([
      {
        type: "input",
        name: "title",
        message: "Requirement title (brief, clear summary):",
        validate: (input) => input.length > 0 || "Title is required"
      },
      {
        type: "editor",
        name: "description",
        message: "Detailed description (opens editor):",
        default: "Describe what the system should do...",
        validate: (input) => input.length > 20 || "Description must be at least 20 characters"
      },
      {
        type: "editor",
        name: "rationale",
        message: "Rationale - why is this requirement needed? (opens editor):",
        default: "Explain the business/technical value...",
        validate: (input) => input.length > 20 || "Rationale must be at least 20 characters"
      }
    ]);

    // Step 4: Priority
    const priorityAnswers = await inquirer.prompt([
      {
        type: "list",
        name: "priority",
        message: "Priority level:",
        choices: [
          { name: "🔴 Critical - System cannot function without this", value: "critical" },
          { name: "🟠 High - Important for core functionality", value: "high" },
          { name: "🟡 Medium - Valuable enhancement", value: "medium" },
          { name: "🟢 Low - Nice to have", value: "low" }
        ]
      }
    ]);

    // Step 5: Acceptance Criteria
    const acceptanceCriteria = await this.promptForAcceptanceCriteria();

    return {
      category: categoryAnswers.category,
      relatedArea: areaAnswers.relatedArea,
      title: coreAnswers.title,
      description: coreAnswers.description,
      rationale: coreAnswers.rationale,
      priority: priorityAnswers.priority,
      acceptanceCriteria
    };
  }

  /**
   * Get related area choices based on category
   */
  private getRelatedAreaChoices(category: string, context: ProjectContext): string[] {
    switch (category) {
      case "runtime":
        return [
          "MFE Lifecycle (load/render/refresh)",
          "Context Management",
          "Platform Handlers",
          "Error Handling",
          "State Management",
          "Module Federation",
          "Other"
        ];

      case "bff":
        return [
          "GraphQL Mesh Configuration",
          "Data Source Handlers",
          "Transforms",
          "Plugins",
          "Schema Generation",
          "Authentication",
          "Other"
        ];

      case "dsl":
        return [
          "MFE Types",
          "Capabilities",
          "Lifecycle Hooks",
          "Data Sources",
          "Schema Validation",
          "Type System",
          "Other"
        ];

      case "handler":
        return [
          "Authentication Handler",
          "Validation Handler",
          "Error Handler",
          "Caching Handler",
          "Rate Limiting Handler",
          "Telemetry Handler",
          "Custom Handler",
          "Other"
        ];

      case "feature":
        return context.capabilities.map(cap =>
          cap.charAt(0).toUpperCase() + cap.slice(1)
        ).concat(["Other"]);

      case "codegen":
        return [
          "Template Processing",
          "API Generation",
          "BFF Generation",
          "MFE Scaffolding",
          "Docker/K8s Generation",
          "Test Generation",
          "Other"
        ];

      case "test":
        return [
          "Unit Testing",
          "Integration Testing",
          "E2E Testing",
          "Test Coverage",
          "TDD Workflow",
          "Other"
        ];

      case "deploy":
        return [
          "Docker Deployment",
          "Kubernetes Deployment",
          "CI/CD Pipeline",
          "Environment Configuration",
          "Monitoring",
          "Other"
        ];

      default:
        return ["General", "Other"];
    }
  }

  /**
   * Prompt for acceptance criteria (Given-When-Then style)
   */
  private async promptForAcceptanceCriteria(): Promise<string[]> {
    const criteria: string[] = [];
    let addMore = true;

    console.log("\n📋 Acceptance Criteria (Given-When-Then format recommended)");

    const { useTemplate } = await inquirer.prompt([
      {
        type: "list",
        name: "useTemplate",
        message: "How would you like to add acceptance criteria?",
        choices: [
          { name: "Use Given-When-Then template (Recommended)", value: true },
          { name: "Free-form entry", value: false }
        ]
      }
    ]);

    while (addMore) {
      let criterion: string;

      if (useTemplate) {
        const gwtAnswers = await inquirer.prompt([
          {
            type: "input",
            name: "given",
            message: "GIVEN (precondition):",
            default: "the system is in state X"
          },
          {
            type: "input",
            name: "when",
            message: "WHEN (action):",
            default: "user performs action Y"
          },
          {
            type: "input",
            name: "then",
            message: "THEN (expected outcome):",
            default: "system should respond with Z"
          }
        ]);

        criterion = `GIVEN ${gwtAnswers.given}\nWHEN ${gwtAnswers.when}\nTHEN ${gwtAnswers.then}`;
      } else {
        const { criterionText } = await inquirer.prompt([
          {
            type: "input",
            name: "criterionText",
            message: "Acceptance criterion:",
            validate: (input) => input.length > 0 || "Criterion cannot be empty"
          }
        ]);
        criterion = criterionText;
      }

      criteria.push(criterion);

      const { continueAdding } = await inquirer.prompt([
        {
          type: "confirm",
          name: "continueAdding",
          message: "Add another acceptance criterion?",
          default: criteria.length < 3
        }
      ]);

      addMore = continueAdding;
    }

    return criteria;
  }

  /**
   * Quick mode - gather multiple requirements with minimal prompts
   */
  async quickMode(context: ProjectContext): Promise<RequirementInput[]> {
    console.log("\n⚡ Quick Requirements Mode");
    console.log("Enter multiple requirements quickly with basic details.\n");

    const requirements: RequirementInput[] = [];

    const { count } = await inquirer.prompt([
      {
        type: "number",
        name: "count",
        message: "How many requirements do you want to add?",
        default: 3,
        validate: (input) => input > 0 && input <= 20 || "Enter between 1 and 20"
      }
    ]);

    for (let i = 0; i < count; i++) {
      console.log(`\n[${i + 1}/${count}]`);

      const answers = await inquirer.prompt([
        {
          type: "list",
          name: "category",
          message: "Category:",
          choices: ["runtime", "bff", "dsl", "handler", "feature", "other"]
        },
        {
          type: "input",
          name: "title",
          message: "Title:",
          validate: (input) => input.length > 0 || "Title required"
        },
        {
          type: "input",
          name: "description",
          message: "Brief description:",
          validate: (input) => input.length > 10 || "Description too short"
        },
        {
          type: "list",
          name: "priority",
          message: "Priority:",
          choices: ["critical", "high", "medium", "low"],
          default: "medium"
        }
      ]);

      requirements.push({
        ...answers,
        rationale: `To be determined in detail during refinement.`,
        acceptanceCriteria: ["To be defined"],
        relatedArea: "General"
      });
    }

    return requirements;
  }
}
