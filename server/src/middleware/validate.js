const { ApiError } = require('../utils/http');

/**
 * Validates and coerces req[source] against a zod schema. The parsed (clean)
 * value replaces the original so controllers only ever see sanitized input.
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(ApiError.badRequest(details[0]?.message || 'Invalid input', details));
  }
  if (source === 'query') {
    // req.query is a getter in Express 5 / read-only in some setups – store separately.
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }
  return next();
};

module.exports = validate;
