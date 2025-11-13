import { NextFunction, Request, Response } from 'express';
import { z, ZodError, ZodIssue } from 'zod';
import { ApiError } from '../utils/errors';
import { RequestHandler } from 'express';


/**
 * Middleware to validate request body, query, or params against a Zod schema.
 * @param schema - The Zod schema to validate against.
 */
export const validate = (schema: z.Schema): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((issue: ZodIssue) => ({
        message: `${issue.path.join('.')} is ${issue.message.toLowerCase()}`,
      }));
      next(new ApiError(400, 'Invalid input', errorMessages));
    } else {
      next(new ApiError(500, 'Internal Server Error during validation'));
    }
  }
};