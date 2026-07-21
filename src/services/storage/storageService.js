const storageConfig = require("../../config/storage");
const localStorageProvider = require("./localStorageProvider");

// Future: import S3Provider, CloudinaryProvider, AzureProvider

const getProvider = () => {
  switch (storageConfig.provider) {
    case "local":
    default:
      return localStorageProvider;
    // case "s3": return s3Provider;
    // case "cloudinary": return cloudinaryProvider;
  }
};

module.exports = {
  getUploadUrl: (filename) => getProvider().getUploadUrl(filename),
  deleteFile: (filename) => getProvider().deleteFile(filename),
  getFileUrl: (filename) => getProvider().getFileUrl(filename),
};
