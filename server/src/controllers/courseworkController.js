import {
  createCourseworkForUser,
  deleteCourseworkForUser,
  getCourseworkForUser,
  listCourseworkForUser,
  updateCourseworkForUser,
} from "../services/courseworkService.js";
import {
  importSyllabusCourseworkForUser,
  previewSyllabusCourseworkForUser,
  previewUploadedSyllabusCourseworkForUser,
} from "../services/syllabusImportService.js";

export async function listCoursework(req, res) {
  const coursework = await listCourseworkForUser(
    req.user.id,
    req.validated.query,
  );

  res.status(200).json({
    success: true,
    data: {
      coursework,
    },
  });
}

export async function createCoursework(req, res) {
  const courseworkItem = await createCourseworkForUser(
    req.user.id,
    req.validated.body,
  );

  res.status(201).json({
    success: true,
    data: {
      courseworkItem,
    },
  });
}

export async function previewSyllabusCoursework(req, res) {
  const preview = await previewSyllabusCourseworkForUser(
    req.user.id,
    req.validated.body,
  );

  res.status(200).json({
    success: true,
    data: {
      preview,
    },
  });
}

export async function previewUploadedSyllabusCoursework(req, res) {
  const preview = await previewUploadedSyllabusCourseworkForUser(
    req.user.id,
    req.validated.body,
    req.file,
  );

  res.status(200).json({
    success: true,
    data: {
      preview,
    },
  });
}

export async function importSyllabusCoursework(req, res) {
  const importResult = await importSyllabusCourseworkForUser(
    req.user.id,
    req.validated.body,
  );

  res.status(201).json({
    success: true,
    data: {
      importResult,
    },
  });
}

export async function getCoursework(req, res) {
  const courseworkItem = await getCourseworkForUser(
    req.user.id,
    req.validated.params.courseworkId,
  );

  res.status(200).json({
    success: true,
    data: {
      courseworkItem,
    },
  });
}

export async function updateCoursework(req, res) {
  const courseworkItem = await updateCourseworkForUser(
    req.user.id,
    req.validated.params.courseworkId,
    req.validated.body,
  );

  res.status(200).json({
    success: true,
    data: {
      courseworkItem,
    },
  });
}

export async function deleteCoursework(req, res) {
  await deleteCourseworkForUser(req.user.id, req.validated.params.courseworkId);

  res.status(204).send();
}
