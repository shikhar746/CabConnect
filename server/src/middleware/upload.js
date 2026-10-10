const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { ApiError } = require('../utils/http');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(ApiError.badRequest('Only JPG, PNG or WebP images are allowed'));
    return cb(null, true);
  },
}).single('avatar');

module.exports = { avatarUpload, UPLOAD_DIR };
