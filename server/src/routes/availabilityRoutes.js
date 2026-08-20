import { Router } from "express";
import {
  createAvailabilityException,
  createWeeklyAvailability,
  deleteAvailabilityException,
  deleteWeeklyAvailability,
  getAvailabilityException,
  getWeeklyAvailability,
  listAvailabilityExceptions,
  listWeeklyAvailability,
  updateAvailabilityException,
  updateWeeklyAvailability,
} from "../controllers/availabilityController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  availabilityExceptionIdSchema,
  availabilityWindowIdSchema,
  createAvailabilityExceptionSchema,
  createWeeklyAvailabilitySchema,
  listAvailabilityExceptionsSchema,
  listWeeklyAvailabilitySchema,
  updateAvailabilityExceptionSchema,
  updateWeeklyAvailabilitySchema,
} from "../validators/availabilityValidators.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/weekly",
  validateRequest(listWeeklyAvailabilitySchema),
  asyncHandler(listWeeklyAvailability),
);
router.post(
  "/weekly",
  validateRequest(createWeeklyAvailabilitySchema),
  asyncHandler(createWeeklyAvailability),
);
router.get(
  "/weekly/:availabilityWindowId",
  validateRequest(availabilityWindowIdSchema),
  asyncHandler(getWeeklyAvailability),
);
router.patch(
  "/weekly/:availabilityWindowId",
  validateRequest(updateWeeklyAvailabilitySchema),
  asyncHandler(updateWeeklyAvailability),
);
router.delete(
  "/weekly/:availabilityWindowId",
  validateRequest(availabilityWindowIdSchema),
  asyncHandler(deleteWeeklyAvailability),
);

router.get(
  "/exceptions",
  validateRequest(listAvailabilityExceptionsSchema),
  asyncHandler(listAvailabilityExceptions),
);
router.post(
  "/exceptions",
  validateRequest(createAvailabilityExceptionSchema),
  asyncHandler(createAvailabilityException),
);
router.get(
  "/exceptions/:availabilityExceptionId",
  validateRequest(availabilityExceptionIdSchema),
  asyncHandler(getAvailabilityException),
);
router.patch(
  "/exceptions/:availabilityExceptionId",
  validateRequest(updateAvailabilityExceptionSchema),
  asyncHandler(updateAvailabilityException),
);
router.delete(
  "/exceptions/:availabilityExceptionId",
  validateRequest(availabilityExceptionIdSchema),
  asyncHandler(deleteAvailabilityException),
);

export default router;
