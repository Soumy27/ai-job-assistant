/**
 * Returns middleware that validates req.body against a zod schema.
 * On failure: responds 400 with a readable message. On success: replaces
 * req.body with the parsed (and coerced) data, then calls next().
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join('; ');
      return res.status(400).json({ error: message });
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
