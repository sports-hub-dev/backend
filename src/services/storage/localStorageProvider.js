const path = require("path");
const fs = require("fs");
const storageConfig = require("../../config/storage");

const getFileUrl = (filename) => {
  if (!filename) return null;
  if (filename.startsWith("http")) return filename;
  return `${storageConfig.baseUrl}/uploads/products/${filename}`;
};

const getUploadUrl = (filename) => getFileUrl(filename);

const deleteFile = (filename) => {
  try {
    const filePath = path.join(process.cwd(), storageConfig.uploadDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    // Non-fatal: log but don't throw
    console.error(`Failed to delete file ${filename}:`, err.message);
  }
};

module.exports = { getFileUrl, getUploadUrl, deleteFile };
