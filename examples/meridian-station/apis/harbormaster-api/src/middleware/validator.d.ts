/**
 * Express middleware for validating request data
 * @param {string} location - Request location to validate ('body', 'query', 'params')
 * @param {Object|Joi.Schema} schema - Joi schema or object to validate against
 */
export function validateSchema(location: string, schema: any | Joi.Schema): (req: any, res: any, next: any) => any;
//# sourceMappingURL=validator.d.ts.map