export let env: string;
export let port: string | number;
export let logDir: string;
export namespace cors {
    let origin: string;
    let methods: string[];
}
export namespace database {
    namespace mongodb {
        namespace development {
            let useMemoryServer: boolean;
            let url: string;
            namespace options {
                let useNewUrlParser: boolean;
                let useUnifiedTopology: boolean;
            }
        }
        namespace test {
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
        namespace production {
            let url_1: string;
            export { url_1 as url };
            export namespace options_2 {
                let useNewUrlParser_2: boolean;
                export { useNewUrlParser_2 as useNewUrlParser };
                let useUnifiedTopology_2: boolean;
                export { useUnifiedTopology_2 as useUnifiedTopology };
                export let maxPoolSize: number;
                export let serverSelectionTimeoutMS: number;
                export let socketTimeoutMS: number;
            }
            export { options_2 as options };
        }
    }
    namespace sqlite {
        export namespace development_1 {
            let dialect: string;
            let storage: string;
            let logging: (message?: any, ...optionalParams: any[]) => void;
            namespace define {
                let timestamps: boolean;
                let underscored: boolean;
            }
        }
        export { development_1 as development };
        export namespace test_1 {
            let dialect_1: string;
            export { dialect_1 as dialect };
            let storage_1: string;
            export { storage_1 as storage };
            let logging_1: boolean;
            export { logging_1 as logging };
            export namespace define_1 {
                let timestamps_1: boolean;
                export { timestamps_1 as timestamps };
                let underscored_1: boolean;
                export { underscored_1 as underscored };
            }
            export { define_1 as define };
        }
        export { test_1 as test };
        export namespace production_1 {
            let dialect_2: string;
            export { dialect_2 as dialect };
            let storage_2: string;
            export { storage_2 as storage };
            let logging_2: boolean;
            export { logging_2 as logging };
            export namespace define_2 {
                let timestamps_2: boolean;
                export { timestamps_2 as timestamps };
                let underscored_2: boolean;
                export { underscored_2 as underscored };
            }
            export { define_2 as define };
            export namespace pool {
                let max: number;
                let min: number;
                let acquire: number;
                let idle: number;
            }
        }
        export { production_1 as production };
    }
}
//# sourceMappingURL=config.d.ts.map