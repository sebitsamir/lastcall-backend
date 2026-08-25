// src/middleware/validate.js
/**
 * ────────────────────────────────────────────────────────────────────────────
 * GENERIC REQUEST VALIDATION RUNNER (Joi)
 * Schemas declare expectations for `body`, `params` and `query`.
 * This middleware validates all three in ONE pass and either:
 *   - rejects with a 400 AppError (human-readable, joined messages), or
 *   - replaces req.body/params/query with the SANITIZED values.
 * ────────────────────────────────────────────────────────────────────────────
 */
const AppError = require("../utils/AppError");

const validate = (schema) => (req, res, next) => {
    const payload = {
        body: req.body,
        params: req.params,
        query: req.query,
    };

    const { error, value } = schema.validate(payload, {
        abortEarly: false,   // report every problem at once, not just the first
        stripUnknown: true,  // silently drop unexpected fields (defense in depth)
    });

    if (error) {
        // Flatten Joi's quoted messages into one clean, client-friendly sentence.
        const message = error.details
            .map((d) => d.message.replace(/"/g, ""))
            .join(". ");
        return next(new AppError(`Validation failed: ${message}`, 400));
    }

    // Only sanitized, schema-approved values reach the controllers.
    req.body = value.body || {};
    req.params = value.params || {};
    req.query = value.query || {};
    next();
};

module.exports = validate;