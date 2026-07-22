const storageConfig = require("../../config/storage");
const localProvider      = require("./localStorageProvider");
const cloudinaryProvider = require("./cloudinaryProvider");

const getProvider = () => {
  switch (storageConfig.provider) {
    case "cloudinary": return cloudinaryProvider;
    case "local":
    default:           return localProvider;
  }
};

module.exports = {
  getUploadUrl: (filename) => getProvider().getFileUrl(filename),
  deleteFile:   (filename) => getProvider().deleteFile(filename),
  getFileUrl:   (filename) => getProvider().getFileUrl(filename),
  getStorage:   ()         => getProvider().storage,
};