


// FIX: Use RequestHandler type to ensure correct type inference.
// Changed to regular import to fix type resolution issues.
import { RequestHandler } from 'express';
import { ZodError, z } from 'zod';


/**
 * Middleware to validate request body, query, or params against a Zod schema.
 * @param schema - The Zod schema to validate against.
 */
export const validate = (schema: z.Schema): RequestHandler => (req, res, next) => {
  try {
    schema.parse({
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
  
        return res.status(400).json({ errors: errorMessages });
    }
  
    next(error);
  }
};