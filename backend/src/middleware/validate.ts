import { NextFunction, RequestHandler } from 'express';
import { ZodError, ZodTypeAny } from 'zod';


/**
 * Middleware to validate request body, query, or params against a Zod schema.
 * @param schema - The Zod schema to validate against.
 */
// FIX: Removed explicit type annotations for req, res, next to allow for correct type inference from RequestHandler.
export const validate = (schema: ZodTypeAny): RequestHandler => (req, res, next) => {
  try {
    schema.parse({
      // FIX: Use inferred 'req' type which correctly contains body, query, and params.
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
  
        // FIX: Use inferred 'res' type which has the 'status' method.
        return res.status(400).json({ errors: errorMessages });
    }
  
    next(error);
  }
};
