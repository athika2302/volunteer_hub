import { ZodError } from 'zod';

/**
 * Input validation middleware using Zod schemas
 */
export function validate(schema, source = 'body') {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError || err.name === 'ZodError' || err.issues) {
        const issues = err.issues || err.errors || [];
        const errorMessages = issues.map((e) => `${e.path.join('.') || 'field'}: ${e.message}`);
        return res.status(400).json({
          error: errorMessages.join('; '),
          details: issues,
        });
      }
      next(err);
    }
  };
}
