import { type z } from 'zod';
import { ValidationError } from '@argoniq/observability';

/**
 * Validate service input at the edge (step 1). Every service
 * starts by parsing its input through this, turning an invalid call into a typed
 * `ValidationError` rather than trusting the caller. Never trust the client.
 */
export function parseInput<Schema extends z.ZodTypeAny>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ValidationError.fromZod(result.error);
  }
  return result.data;
}
