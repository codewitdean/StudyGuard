import {
  createStudySessionForUser,
  deleteStudySessionForUser,
  getProgressSummaryForUser,
  getStudySessionForUser,
  listStudySessionsForUser,
  updateStudySessionForUser,
} from "../services/progressService.js";

export async function getProgressSummary(req, res) {
  const progress = await getProgressSummaryForUser(
    req.user.id,
    req.validated.query,
  );

  res.status(200).json({
    success: true,
    data: {
      progress,
    },
  });
}

export async function listStudySessions(req, res) {
  const studySessions = await listStudySessionsForUser(
    req.user.id,
    req.validated.query,
  );

  res.status(200).json({
    success: true,
    data: {
      studySessions,
    },
  });
}

export async function createStudySession(req, res) {
  const studySession = await createStudySessionForUser(
    req.user.id,
    req.validated.body,
  );

  res.status(201).json({
    success: true,
    data: {
      studySession,
    },
  });
}

export async function getStudySession(req, res) {
  const studySession = await getStudySessionForUser(
    req.user.id,
    req.validated.params.studySessionId,
  );

  res.status(200).json({
    success: true,
    data: {
      studySession,
    },
  });
}

export async function updateStudySession(req, res) {
  const studySession = await updateStudySessionForUser(
    req.user.id,
    req.validated.params.studySessionId,
    req.validated.body,
  );

  res.status(200).json({
    success: true,
    data: {
      studySession,
    },
  });
}

export async function deleteStudySession(req, res) {
  await deleteStudySessionForUser(
    req.user.id,
    req.validated.params.studySessionId,
  );

  res.status(204).send();
}
