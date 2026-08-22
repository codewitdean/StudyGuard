import { Router } from "express";
import multer from "multer";
import {
  createCoursework,
  deleteCoursework,
  getCoursework,
  importSyllabusCoursework,
  listCoursework,
  previewSyllabusCoursework,
  previewUploadedSyllabusCoursework,
  updateCoursework,
} from "../controllers/courseworkController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { badRequest } from "../utils/httpErrors.js";
import {
  courseworkIdSchema,
  createCourseworkSchema,
  listCourseworkSchema,
  syllabusImportSchema,
  syllabusPreviewSchema,
  syllabusUploadPreviewSchema,
  updateCourseworkSchema,
} from "../validators/courseworkValidators.js";

const maxSyllabusUploadBytes = 15 * 1024 * 1024;
const supportedSyllabusExtensions = new Set([
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".csv",
]);

function getFileExtension(fileName = "") {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return "";
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

function isSupportedSyllabusFile(file) {
  return supportedSyllabusExtensions.has(getFileExtension(file.originalname));
}

const syllabusUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxSyllabusUploadBytes,
  },
  fileFilter(req, file, callback) {
    if (!isSupportedSyllabusFile(file)) {
      callback(
        badRequest(
          "Upload a PDF, Word .docx, text, Markdown, or CSV syllabus file.",
        ),
      );
      return;
    }

    callback(null, true);
  },
});

function uploadSyllabusFile(req, res, next) {
  syllabusUpload.single("syllabus")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      next(badRequest("Syllabus file must be 15 MB or smaller."));
      return;
    }

    next(error);
  });
}

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validateRequest(listCourseworkSchema),
  asyncHandler(listCoursework),
);
router.post(
  "/",
  validateRequest(createCourseworkSchema),
  asyncHandler(createCoursework),
);
router.post(
  "/syllabus/preview",
  validateRequest(syllabusPreviewSchema),
  asyncHandler(previewSyllabusCoursework),
);
router.post(
  "/syllabus/upload-preview",
  uploadSyllabusFile,
  validateRequest(syllabusUploadPreviewSchema),
  asyncHandler(previewUploadedSyllabusCoursework),
);
router.post(
  "/syllabus/import",
  validateRequest(syllabusImportSchema),
  asyncHandler(importSyllabusCoursework),
);
router.get(
  "/:courseworkId",
  validateRequest(courseworkIdSchema),
  asyncHandler(getCoursework),
);
router.patch(
  "/:courseworkId",
  validateRequest(updateCourseworkSchema),
  asyncHandler(updateCoursework),
);
router.delete(
  "/:courseworkId",
  validateRequest(courseworkIdSchema),
  asyncHandler(deleteCoursework),
);

export default router;
