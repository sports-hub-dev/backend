const Feedback = require("../models/Feedback");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/AppError");
const { successResponse, paginatedResponse } = require("../utils/apiResponse");

exports.submitFeedback = asyncHandler(async (req, res) => {
  const { name, email, rating, message } = req.body;
  const feedback = await Feedback.create({
    name,
    email,
    rating,
    message,
    user: req.user?._id || null,
    isGuest: !req.user,
  });
  successResponse(res, 201, "Thank you for your feedback!", { feedback });
});

exports.getAllFeedback = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, rating } = req.query;
  const filter = {};
  if (rating) filter.rating = parseInt(rating);
  const skip = (page - 1) * limit;
  const [feedback, total] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Feedback.countDocuments(filter),
  ]);
  paginatedResponse(res, "Feedback fetched", feedback, page, limit, total);
});

exports.deleteFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findByIdAndDelete(req.params.id);
  if (!feedback) throw new AppError("Feedback not found", 404);
  successResponse(res, 200, "Feedback deleted");
});
