export namespace development {
    let dialect: string;
    let storage: string;
    let logging: (message?: any, ...optionalParams: any[]) => void;
    namespace define {
        let timestamps: boolean;
        let underscored: boolean;
    }
}
export namespace test {
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
export namespace production {
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
//# sourceMappingURL=database.d.ts.map