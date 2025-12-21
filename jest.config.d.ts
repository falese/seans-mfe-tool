export let testEnvironment: string;
export let testMatch: string[];
export let transform: {
    '^.+\\.tsx?$': (string | {
        tsconfig: string;
        isolatedModules: boolean;
    })[];
    '^.+\\.jsx?$': (string | {
        presets: (string | {
            targets: {
                node: string;
            };
        })[][];
    })[];
};
export let moduleFileExtensions: string[];
export let testTimeout: number;
export let setupFilesAfterEnv: string[];
export let moduleDirectories: string[];
export let collectCoverage: boolean;
export let coverageDirectory: string;
export let coverageReporters: string[];
export let collectCoverageFrom: string[];
export let coverageThreshold: {
    global: {
        branches: number;
        functions: number;
        lines: number;
        statements: number;
    };
    'packages/dsl/src/type-system.ts': {
        branches: number;
        functions: number;
        lines: number;
        statements: number;
    };
    'packages/runtime/src/base-mfe.ts': {
        branches: number;
        functions: number;
        lines: number;
        statements: number;
    };
    'packages/cli/src/utils/*.js': {
        branches: number;
        functions: number;
        lines: number;
        statements: number;
    };
};
export namespace fakeTimers {
    let enableGlobally: boolean;
}
export let testPathIgnorePatterns: string[];
export namespace testEnvironmentOptions {
    let url: string;
}
export let bail: boolean;
export let verbose: boolean;
export let moduleNameMapper: {
    '^@seans-mfe-tool/dsl$': string;
    '^@seans-mfe-tool/runtime$': string;
    '^@seans-mfe-tool/codegen$': string;
    '^@seans-mfe-tool/cli$': string;
};
//# sourceMappingURL=jest.config.d.ts.map