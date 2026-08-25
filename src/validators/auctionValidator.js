// src/validators/auctionValidator.js
/**
 * ────────────────────────────────────────────────────────────────────────────
 * AUCTION VALIDATORS
 * One shared field map powers CREATE (all required) and UPDATE (all optional)
 * — DRY schemas, zero drift between the two verbs.
 * Category whitelist MUST match the frontend's AUCTION_CATEGORIES.
 * ────────────────────────────────────────────────────────────────────────────
 */
const Joi = require("joi");

const objectId = Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({ "string.pattern.base": "Invalid auction id" });

/** Single source of truth for writable auction fields. */
const fields = {
    title: Joi.string().trim().min(3).max(120),
    description: Joi.string().trim().min(10).max(5000),
    category: Joi.string().valid(
        "Art",
        "Watches",
        "Electronics",
        "Collectibles",
        "Fashion",
        "Sports"
    ),
    // URLs only (Cloudinary secure_url), 1–5 images — mirrors the ImageStudio.
    images: Joi.array().items(Joi.string().uri()).min(1).max(5),
    startingPrice: Joi.number().positive().max(10_000_000),
    startTime: Joi.date().iso(),
    // Must be in the future; the service re-checks at write time (authority).
    endTime: Joi.date().iso().greater("now"),
};

/** POST /auctions — creation demands the full contract. */
exports.create = Joi.object({
    body: Joi.object({
        ...fields,
        title: fields.title.required(),
        description: fields.description.required(),
        category: fields.category.required(),
        images: fields.images.required(),
        startingPrice: fields.startingPrice.required(),
        endTime: fields.endTime.required(),
    }).required(),
});

/** PATCH /auctions/:id — partial updates; unknown keys are stripped, not errored. */
exports.update = Joi.object({
    params: Joi.object({ id: objectId }).required(),
    body: Joi.object(fields).required(),
});

/** POST /auctions/:id/cancel — only the id matters. */
exports.cancel = Joi.object({
    params: Joi.object({ id: objectId }).required(),
});