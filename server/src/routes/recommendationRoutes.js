import { Router } from "express";
import {
  approveRecommendation,
  createRecommendation,
  deleteRecommendation,
  editRecommendation,
  getRecommendation,
  listRecommendations,
  rejectRecommendation,
} from "../controllers/recommendationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createRecommendationSchema,
  editRecommendationSchema,
  listRecommendationsSchema,
  recommendationIdSchema,
} from "../validators/recommendationValidators.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listRecommendationsSchema),
  asyncHandler(listRecommendations),
);
router.post(
  "/",
  validateRequest(createRecommendationSchema),
  asyncHandler(createRecommendation),
);
router.get(
  "/:recommendationId",
  validateRequest(recommendationIdSchema),
  asyncHandler(getRecommendation),
);
router.patch(
  "/:recommendationId",
  validateRequest(editRecommendationSchema),
  asyncHandler(editRecommendation),
);
router.post(
  "/:recommendationId/approve",
  validateRequest(recommendationIdSchema),
  asyncHandler(approveRecommendation),
);
router.post(
  "/:recommendationId/reject",
  validateRequest(recommendationIdSchema),
  asyncHandler(rejectRecommendation),
);
router.delete(
  "/:recommendationId",
  validateRequest(recommendationIdSchema),
  asyncHandler(deleteRecommendation),
);

export default router;
