export namespace development {
    let useMemoryServer: boolean;
    namespace options {
        let useNewUrlParser: boolean;
        let useUnifiedTopology: boolean;
    }
}
export namespace test {
    let useMemoryServer_1: boolean;
    export { useMemoryServer_1 as useMemoryServer };
    export namespace options_1 {
        let useNewUrlParser_1: boolean;
        export { useNewUrlParser_1 as useNewUrlParser };
        let useUnifiedTopology_1: boolean;
        export { useUnifiedTopology_1 as useUnifiedTopology };
    }
    export { options_1 as options };
}
export namespace production {
    export let url: string;
    export namespace options_2 {
        let useNewUrlParser_2: boolean;
        export { useNewUrlParser_2 as useNewUrlParser };
        let useUnifiedTopology_2: boolean;
        export { useUnifiedTopology_2 as useUnifiedTopology };
    }
    export { options_2 as options };
}
//# sourceMappingURL=database.d.ts.map