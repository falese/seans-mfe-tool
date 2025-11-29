# REQ-057: BaseMFE Boilerplate Generation

**Status:** 🟡 In Progress
**GitHub Issue:** #39
**Last Updated:** 2025-11-28

## Core Requirement & Architectural Principle

- The code generator must produce a BaseMFE class as the foundational seed for every remote MFE.
- This BaseMFE class is generated from the DSL manifest and includes all required lifecycle hooks and capability method stubs.
- Domain capabilities defined in the DSL are implemented as additional methods or subclasses that extend the generated BaseMFE.
- The generated BaseMFE ensures contract compliance, lifecycle structure, and provides a starting point for further extension and customization by developers.
- This approach centralizes logic and contract enforcement, while allowing domain-specific features to be layered on top as the project evolves.

## Next: Requirements Elicitation Questions

1. How should lifecycle hooks from the DSL be mapped to method stubs in the BaseMFE?
2. Should all 9 capability methods always be generated, or only those present in the DSL?
3. How should input/output types be mapped from the DSL to TypeScript interfaces?
4. What is the expected relationship between BaseMFE and React components (if any)?
5. How should JSDoc comments and documentation be extracted from the DSL and included in generated code?
6. Should the generator support both TypeScript and JavaScript output, and how should this be controlled?
7. How should errors and edge cases (e.g., missing hooks, unknown capabilities) be handled in generated code?
8. What is the preferred file/folder structure for generated BaseMFE and domain capability files?
9. How should tests be generated for BaseMFE subclasses and domain capabilities?
10. What are the expectations for extensibility and developer customization after generation?

---

**Traceability:**
- ADR-036: Lifecycle execution model
- ADR-046: Codegen approach
- Issue #39: MFE Boilerplate Code Generation from DSL

---

*Session notes and answers to these questions will be appended below as requirements are clarified.*
## Acceptance Criteria

- [ ] CLI generates `/src/platform/base-mfe/mfe.ts` containing a BaseMFE subclass with all lifecycle hook stubs and 9 capability methods, mapped from DSL manifest.
- [ ] Lifecycle hooks and capabilities include JSDoc comments extracted from DSL descriptions.
- [ ] All platform handlers (auth, validation, telemetry, caching, rate-limiting, error-handling) are imported and integrated into the generated BaseMFE.
- [ ] CLI generates `/src/platform/bff/bff.ts` and related config, implementing BFF layer from DSL data section, protected from manual modification.
- [ ] All platform code is TypeScript-only and separated from app/domain code.
- [ ] CLI generates test files for BaseMFE (`/src/platform/base-mfe/mfe.test.ts`) and BFF (`/src/platform/bff/bff.test.ts`), covering contract and stub logic.
- [ ] Platform files are protected from manual modification; only updated via CLI runs.
- [ ] App/domain code and tests remain developer-managed.

---

## Session Summary

- BaseMFE is logic-only, generated as `mfe.ts`, with all lifecycle/capability stubs and handler integration.
- BFF layer is generated in `/src/platform/bff/`, CLI-managed and protected.
- JSDoc is extracted from DSL and included in all generated stubs.
- Platform code is separated from app/domain code and tests.
- All requirements and acceptance criteria are documented and ready for implementation.
