// src/validators/bidValidator.js
/**
 * ────────────────────────────────────────────────────────────────────────────
 * BID VALIDATORS
 * Only structural rules live here (shape, type, sane bounds).
 * BUSINESS rules (min next bid, balance, seller-can't-bid) stay in the
 * service layer — validators must never know about money logic.
 * ────────────────────────────────────────────────────────────────────────────
 */
const Joi = require("joi");

/** Mongo ObjectId as a route param — reject garbage before it hits Mongoose. */
const objectId = Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({ "string.pattern.base": "Invalid auction id" });

/** POST /auctions/:id/bid */
exports.place = Joi.object({
    params: Joi.object({ id: objectId }).required(),
    body: Joi.object({
        // Positive, finite, capped — absurd values are rejected at the door.
        amount: Joi.number().positive().max(10_000_000).required(),
    }).required(),
});