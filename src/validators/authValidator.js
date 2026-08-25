// src/validators/authValidator.js
/**
 * ────────────────────────────────────────────────────────────────────────────
 * AUTH VALIDATORS
 * Hard limits mirror security policy: no giant strings (DoS via payloads),
 * normalized emails, and a password floor that matches the frontend mirror.
 * ────────────────────────────────────────────────────────────────────────────
 */
const Joi = require("joi");

/** POST /auth/register */
exports.register = Joi.object({
    body: Joi.object({
        name: Joi.string().trim().min(2).max(50).required(),
        email: Joi.string().trim().lowercase().email({ tlds: false }).max(255).required(),
        // 8-char floor; 128 ceiling (bcrypt's hard limit is 72 bytes — we cap early)
        password: Joi.string().min(8).max(128).required(),
    }).required(),
});

/** POST /auth/login — no length hints: don't help attackers enumerate rules */
exports.login = Joi.object({
    body: Joi.object({
        email: Joi.string().trim().lowercase().email({ tlds: false }).required(),
        password: Joi.string().required(),
    }).required(),
});

/** PATCH /auth or profile-style name updates */
exports.updateName = Joi.object({
    body: Joi.object({
        name: Joi.string().trim().min(2).max(50).required(),
    }).required(),
});