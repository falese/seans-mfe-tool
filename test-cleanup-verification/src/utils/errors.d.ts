export class BaseError extends Error {
    constructor(message: any, statusCode?: number, details?: any);
    statusCode: number;
    details: any;
}
export class ValidationError extends BaseError {
    constructor(message: any, details: any);
}
export class UnauthorizedError extends BaseError {
    constructor(message: any);
}
export class NotFoundError extends BaseError {
    constructor(message: any);
}
export class ConflictError extends BaseError {
    constructor(message: any);
}
//# sourceMappingURL=errors.d.ts.map