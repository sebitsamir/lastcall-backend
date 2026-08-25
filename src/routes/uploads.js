const express = require("express");
const uploadMiddleware = require("../middleware/upload");
const uploadController = require("../controllers/uploadController");
const { protect } = require("../middleware/auth");

const router = express.Router();

/**
 * @route   POST /api/v1/uploads
 * @desc    Upload a single image to Cloudinary
 * @access  Private (Requires authentication)
 */
router.post(
    "/",
    protect,
    uploadMiddleware.single("image"), // 👈 MUST match the frontend's form.append("image", file)
    uploadController.uploadImage
);

module.exports = router;