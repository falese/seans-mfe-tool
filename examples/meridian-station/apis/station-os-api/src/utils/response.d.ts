/**
 * Standard response formatter
 */
export function formatResponse(data: any, message?: string): {
    success: boolean;
    message: string;
    data: any;
};
/**
 * Error response formatter
 */
export function formatError(error: any, message?: string): {
    success: boolean;
    message: string;
    error: {
        stack: any;
        message: any;
    };
};
//# sourceMappingURL=response.d.ts.map