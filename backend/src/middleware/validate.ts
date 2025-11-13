import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError, z } from 'zod';


/**
 * Middleware to validate request body, query, or params against a Zod schema.
 * @param schema - The Zod schema to validate against.
 */
// FIX: Changed schema type to the more generic z.Schema to allow for ZodEffects (from .refine())
export const validate = (schema: z.Schema): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
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