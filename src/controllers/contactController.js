const ContactMessage = require("../models/ContactMessage");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { successResponse, paginatedResponse } = require("../utils/apiResponse");

exports.submitContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;
  const contactMessage = await ContactMessage.create({
    name, email, subject, message,
    user: req.user?._id || null,
  });
  successResponse(res, 201, "Thanks for reaching out — we'll get back to you soon.", { contactMessage });
});

exports.getAllContactMessages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isRead } = req.query;
  const filter = {};
  if (isRead !== undefined) filter.isRead = isRead === "true";
  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    ContactMessage.countDocuments(filter),
  ]);
  paginatedResponse(res, "Contact messages fetched", messages, page, limit, total);
});

exports.markContactMessageRead = asyncHandler(async (req, res) => {
  const contactMessage = await ContactMessage.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
  if (!contactMessage) throw new AppError("Message not found", 404);
  successResponse(res, 200, "Marked as read", { contactMessage });
});

exports.deleteContactMessage = asyncHandler(async (req, res) => {
  const contactMessage = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!contactMessage) throw new AppError("Message not found", 404);
  successResponse(res, 200, "Message deleted");
});