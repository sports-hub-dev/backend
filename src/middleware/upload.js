const multer  = require("multer");
const AppError = require("../utils/AppError");
const { getStorage } = require("../services/storage/storageService");

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext  = allowed.test(file.originalname.toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new AppError("Only image files are allowed", 400));
};

const upload = multer({
  storage:    getStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = upload;