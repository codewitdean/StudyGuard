import {
  createAvailabilityExceptionForUser,
  createWeeklyAvailabilityForUser,
  deleteAvailabilityExceptionForUser,
  deleteWeeklyAvailabilityForUser,
  getAvailabilityExceptionForUser,
  getWeeklyAvailabilityForUser,
  listAvailabilityExceptionsForUser,
  listWeeklyAvailabilityForUser,
  updateAvailabilityExceptionForUser,
  updateWeeklyAvailabilityForUser,
} from "../services/availabilityService.js";

export async function listWeeklyAvailability(req, res) {
  const weeklyAvailability = await listWeeklyAvailabilityForUser(
    req.user.id,
    req.validated.query,
  );

  res.status(200).json({
    success: true,
    data: {
      weeklyAvailability,
    },
  });
}

export async function createWeeklyAvailability(req, res) {
  const availabilityWindow = await createWeeklyAvailabilityForUser(
    req.user.id,
    req.validated.body,
  );

  res.status(201).json({
    success: true,
    data: {
      availabilityWindow,
    },
  });
}

export async function getWeeklyAvailability(req, res) {
  const availabilityWindow = await getWeeklyAvailabilityForUser(
    req.user.id,
    req.validated.params.availabilityWindowId,
  );

  res.status(200).json({
    success: true,
    data: {
      availabilityWindow,
    },
  });
}

export async function updateWeeklyAvailability(req, res) {
  const availabilityWindow = await updateWeeklyAvailabilityForUser(
    req.user.id,
    req.validated.params.availabilityWindowId,
    req.validated.body,
  );

  res.status(200).json({
    success: true,
    data: {
      availabilityWindow,
    },
  });
}

export async function deleteWeeklyAvailability(req, res) {
  await deleteWeeklyAvailabilityForUser(
    req.user.id,
    req.validated.params.availabilityWindowId,
  );

  res.status(204).send();
}

export async function listAvailabilityExceptions(req, res) {
  const availabilityExceptions = await listAvailabilityExceptionsForUser(
    req.user.id,
    req.validated.query,
  );

  res.status(200).json({
    success: true,
    data: {
      availabilityExceptions,
    },
  });
}

export async function createAvailabilityException(req, res) {
  const availabilityException = await createAvailabilityExceptionForUser(
    req.user.id,
    req.validated.body,
  );

  res.status(201).json({
    success: true,
    data: {
      availabilityException,
    },
  });
}

export async function getAvailabilityException(req, res) {
  const availabilityException = await getAvailabilityExceptionForUser(
    req.user.id,
    req.validated.params.availabilityExceptionId,
  );

  res.status(200).json({
    success: true,
    data: {
      availabilityException,
    },
  });
}

export async function updateAvailabilityException(req, res) {
  const availabilityException = await updateAvailabilityExceptionForUser(
    req.user.id,
    req.validated.params.availabilityExceptionId,
    req.validated.body,
  );

  res.status(200).json({
    success: true,
    data: {
      availabilityException,
    },
  });
}

export async function deleteAvailabilityException(req, res) {
  await deleteAvailabilityExceptionForUser(
    req.user.id,
    req.validated.params.availabilityExceptionId,
  );

  res.status(204).send();
}
