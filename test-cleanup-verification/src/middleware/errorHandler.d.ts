export class ApiError extends Error {
    constructor(statusCode: any, message: any);
    statusCode: any;
    status: string;
}
export function errorHandler(err: any, req: any, res: any, next: any): void;
//# sourceMappingURL=errorHandler.d.ts.map