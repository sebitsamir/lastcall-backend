const multer = require('multer');
const AppError = require('../utils/AppError');

// Store files in memory (not on disk) before uploading to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new AppError('Not an image! Please upload only images (JPEG, PNG, etc.).', 400), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per file
    fileFilter,
});

module.exports = upload;