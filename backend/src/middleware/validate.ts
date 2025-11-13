import express from 'express';
import { ZodError, z } from 'zod';


/**
 * Middleware to validate request body, query, or params against a Zod schema.
 * @param schema - The Zod schema to validate against.
 */
export const validate = (schema: z.Schema): express.RequestHandler => (req: express.Request, res: express.Response, next: express.NextFunction) => {
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