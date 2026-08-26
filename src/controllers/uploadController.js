const cloudinary = require("../config/cloudinary");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");

/**
 * @desc    Upload image buffer to Cloudinary and return the secure URL
 * @route   POST /api/v1/uploads
 */
exports.uploadImage = asyncHandler(async (req, res, next) => {
    // 1. Ensure Multer actually caught a file
    if (!req.file) {
        return next(new AppError("Please upload an image file.", 400));
    }

    // 2. Stream the memory buffer directly to Cloudinary
    const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "lastcall", // Organizes images in your Cloudinary dashboard
                resource_type: "image",
            },
            (error, cloudinaryResult) => {
                if (error) return reject(error);
                resolve(cloudinaryResult);
            }
        );

        // Pipe the buffer into the stream
        uploadStream.end(req.file.buffer);
    });

    // 3. Send the secure URL back to the frontend
    // This shape { data: { url: "..." } } matches what your frontend normalizeImageUrl expects
    res.status(200).json({
        status: "success",
        data: {
            url: result.secure_url,
        },
    });
});