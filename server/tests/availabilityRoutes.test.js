import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-11b-availability-routes-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "availability-test-%@example.com";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
}

async function createTestStudent(label = "student") {
  const email = "availability-test-" + label + "@example.com";
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Availability " + label,
      email,
      password: "correct-password",
    });

  return {
    email,
    token: response.body.data.token,
    user: response.body.data.user,
  };
}

async function createWeeklyAvailability(token, body = {}) {
  return request(app)
    .post("/api/availability/weekly")
    .set("Authorization", "Bearer " + token)
    .send({
      weekday: 1,
      startTime: "18:00",
      endTime: "21:00",
      label: "Library time",
      ...body,
    });
}

async function updateWeeklyAvailability(token, availabilityWindowId, body) {
  return request(app)
    .patch("/api/availability/weekly/" + availabilityWindowId)
    .set("Authorization", "Bearer " + token)
    .send(body);
}

async function createAvailabilityException(token, body = {}) {
  return request(app)
    .post("/api/availability/exceptions")
    .set("Authorization", "Bearer " + token)
    .send({
      exceptionDate: "2027-02-17",
      type: "extra_available",
      isFullDay: false,
      startTime: "14:00",
      endTime: "16:00",
      reason: "Class cancelled",
      ...body,
    });
}

async function updateAvailabilityException(
  token,
  availabilityExceptionId,
  body,
) {
  return request(app)
    .patch("/api/availability/exceptions/" + availabilityExceptionId)
    .set("Authorization", "Bearer " + token)
    .send(body);
}

function getAvailabilityWindow(response) {
  return response.body.data.availabilityWindow;
}

function getAvailabilityException(response) {
  return response.body.data.availabilityException;
}

beforeAll(async () => {
  await deleteTestUsers();
});

beforeEach(async () => {
  await deleteTestUsers();
});

afterAll(async () => {
  await deleteTestUsers();
  await closeDatabase();
});

describe("/api/availability", () => {
  it("requires authentication for weekly windows and exceptions", async () => {
    const weeklyResponse = await request(app).get("/api/availability/weekly");
    const exceptionResponse = await request(app).get(
      "/api/availability/exceptions",
    );

    expect(weeklyResponse.status).toBe(401);
    expect(weeklyResponse.body).toEqual({
      success: false,
      error: {
        message: "Authentication required.",
      },
    });
    expect(exceptionResponse.status).toBe(401);
    expect(exceptionResponse.body.error.message).toBe(
      "Authentication required.",
    );
  });

  it("creates an owned weekly window and normalizes an empty label", async () => {
    const student = await createTestStudent("weekly-create");

    const response = await createWeeklyAvailability(student.token, {
      weekday: "1",
      startTime: " 18:00 ",
      endTime: "21:00",
      label: " ",
    });

    expect(response.status).toBe(201);
    expect(getAvailabilityWindow(response)).toMatchObject({
      id: expect.any(String),
      weekday: 1,
      startTime: "18:00",
      endTime: "21:00",
      label: null,
    });

    const storedWindow = await query(
      "SELECT user_id, label FROM weekly_availability WHERE id = $1",
      [getAvailabilityWindow(response).id],
    );

    expect(storedWindow.rows[0].user_id).toBe(student.user.id);
    expect(storedWindow.rows[0].label).toBeNull();
  });

  it("returns 400 for invalid weekly window bodies and filters", async () => {
    const student = await createTestStudent("weekly-invalid");

    const createResponse = await createWeeklyAvailability(student.token, {
      weekday: 8,
      startTime: "21:00",
      endTime: "18:00",
    });
    const filterResponse = await request(app)
      .get("/api/availability/weekly?weekday=8")
      .set("Authorization", "Bearer " + student.token);

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.error.message).toBe("Validation failed.");
    expect(filterResponse.status).toBe(400);
    expect(filterResponse.body.error.message).toBe("Validation failed.");
  });

  it("returns 409 for duplicate or overlapping weekly windows", async () => {
    const student = await createTestStudent("weekly-conflict");

    await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "18:00",
      endTime: "21:00",
    });
    const duplicateResponse = await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "18:00",
      endTime: "21:00",
    });
    const overlapResponse = await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "20:30",
      endTime: "22:00",
    });
    const adjacentResponse = await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "21:00",
      endTime: "22:00",
    });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error.message).toBe(
      "Availability window conflicts with an existing window.",
    );
    expect(overlapResponse.status).toBe(409);
    expect(adjacentResponse.status).toBe(201);
  });

  it("lists only owned weekly windows and supports weekday filtering", async () => {
    const student = await createTestStudent("weekly-list-owner");
    const otherStudent = await createTestStudent("weekly-list-other");

    await createWeeklyAvailability(student.token, {
      weekday: 2,
      startTime: "10:00",
      endTime: "11:00",
      label: "Morning",
    });
    await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "18:00",
      endTime: "21:00",
      label: "Evening",
    });
    await createWeeklyAvailability(otherStudent.token, {
      weekday: 1,
      startTime: "18:00",
      endTime: "21:00",
      label: "Other",
    });

    const listResponse = await request(app)
      .get("/api/availability/weekly")
      .set("Authorization", "Bearer " + student.token);
    const filteredResponse = await request(app)
      .get("/api/availability/weekly?weekday=2")
      .set("Authorization", "Bearer " + student.token);

    expect(listResponse.status).toBe(200);
    expect(
      listResponse.body.data.weeklyAvailability.map((window) => window.label),
    ).toEqual(["Evening", "Morning"]);
    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.data.weeklyAvailability).toHaveLength(1);
    expect(filteredResponse.body.data.weeklyAvailability[0].weekday).toBe(2);
  });

  it("gets one owned weekly window", async () => {
    const student = await createTestStudent("weekly-get");
    const createdWindow = await createWeeklyAvailability(student.token, {
      label: "Library",
    });
    const availabilityWindowId = getAvailabilityWindow(createdWindow).id;

    const response = await request(app)
      .get("/api/availability/weekly/" + availabilityWindowId)
      .set("Authorization", "Bearer " + student.token);

    expect(response.status).toBe(200);
    expect(getAvailabilityWindow(response)).toMatchObject({
      id: availabilityWindowId,
      label: "Library",
    });
  });

  it("returns 404 for another student's weekly window", async () => {
    const student = await createTestStudent("weekly-private-owner");
    const otherStudent = await createTestStudent("weekly-private-other");
    const otherWindow = await createWeeklyAvailability(otherStudent.token, {
      label: "Private",
    });
    const otherWindowId = getAvailabilityWindow(otherWindow).id;

    const getResponse = await request(app)
      .get("/api/availability/weekly/" + otherWindowId)
      .set("Authorization", "Bearer " + student.token);
    const patchResponse = await updateWeeklyAvailability(
      student.token,
      otherWindowId,
      { label: "Changed" },
    );
    const deleteResponse = await request(app)
      .delete("/api/availability/weekly/" + otherWindowId)
      .set("Authorization", "Bearer " + student.token);

    expect(getResponse.status).toBe(404);
    expect(patchResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);

    const ownerResponse = await request(app)
      .get("/api/availability/weekly/" + otherWindowId)
      .set("Authorization", "Bearer " + otherStudent.token);

    expect(ownerResponse.status).toBe(200);
    expect(getAvailabilityWindow(ownerResponse).label).toBe("Private");
  });

  it("updates an owned weekly window and blocks overlap updates", async () => {
    const student = await createTestStudent("weekly-update");
    const firstWindow = await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "18:00",
      endTime: "19:00",
    });
    const secondWindow = await createWeeklyAvailability(student.token, {
      weekday: 1,
      startTime: "20:00",
      endTime: "21:00",
    });

    const updateResponse = await updateWeeklyAvailability(
      student.token,
      getAvailabilityWindow(firstWindow).id,
      {
        weekday: 2,
        startTime: "16:00",
        endTime: "17:30",
        label: " ",
      },
    );
    const conflictResponse = await updateWeeklyAvailability(
      student.token,
      getAvailabilityWindow(secondWindow).id,
      {
        weekday: 2,
        startTime: "16:30",
        endTime: "18:00",
      },
    );

    expect(updateResponse.status).toBe(200);
    expect(getAvailabilityWindow(updateResponse)).toMatchObject({
      weekday: 2,
      startTime: "16:00",
      endTime: "17:30",
      label: null,
    });
    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body.error.message).toBe(
      "Availability window conflicts with an existing window.",
    );
  });

  it("returns 400 for empty weekly updates and invalid weekly IDs", async () => {
    const student = await createTestStudent("weekly-bad-update");
    const createdWindow = await createWeeklyAvailability(student.token);

    const emptyUpdateResponse = await updateWeeklyAvailability(
      student.token,
      getAvailabilityWindow(createdWindow).id,
      {},
    );
    const invalidIdResponse = await request(app)
      .get("/api/availability/weekly/not-a-uuid")
      .set("Authorization", "Bearer " + student.token);

    expect(emptyUpdateResponse.status).toBe(400);
    expect(emptyUpdateResponse.body.error.message).toBe("Validation failed.");
    expect(invalidIdResponse.status).toBe(400);
    expect(invalidIdResponse.body.error.message).toBe("Validation failed.");
  });

  it("deletes one owned weekly window", async () => {
    const student = await createTestStudent("weekly-delete");
    const createdWindow = await createWeeklyAvailability(student.token);
    const availabilityWindowId = getAvailabilityWindow(createdWindow).id;

    const deleteResponse = await request(app)
      .delete("/api/availability/weekly/" + availabilityWindowId)
      .set("Authorization", "Bearer " + student.token);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.text).toBe("");

    const getResponse = await request(app)
      .get("/api/availability/weekly/" + availabilityWindowId)
      .set("Authorization", "Bearer " + student.token);

    expect(getResponse.status).toBe(404);
  });

  it("creates owned full-day and partial-day exceptions", async () => {
    const student = await createTestStudent("exception-create");

    const fullDayResponse = await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-16",
      type: " unavailable ",
      isFullDay: true,
      startTime: undefined,
      endTime: undefined,
      reason: " ",
    });
    const partialDayResponse = await createAvailabilityException(
      student.token,
      {
        exceptionDate: "2027-02-17",
        type: "extra_available",
        isFullDay: false,
        startTime: " 14:00 ",
        endTime: "16:00",
        reason: " Class cancelled ",
      },
    );

    expect(fullDayResponse.status).toBe(201);
    expect(getAvailabilityException(fullDayResponse)).toMatchObject({
      exceptionDate: "2027-02-16",
      type: "unavailable",
      isFullDay: true,
      startTime: null,
      endTime: null,
      reason: null,
    });
    expect(partialDayResponse.status).toBe(201);
    expect(getAvailabilityException(partialDayResponse)).toMatchObject({
      exceptionDate: "2027-02-17",
      type: "extra_available",
      isFullDay: false,
      startTime: "14:00",
      endTime: "16:00",
      reason: "Class cancelled",
    });

    const storedException = await query(
      "SELECT user_id, reason FROM availability_exceptions WHERE id = $1",
      [getAvailabilityException(fullDayResponse).id],
    );

    expect(storedException.rows[0].user_id).toBe(student.user.id);
    expect(storedException.rows[0].reason).toBeNull();
  });

  it("returns 400 for invalid exception bodies and filters", async () => {
    const student = await createTestStudent("exception-invalid");

    const fullDayWithTimesResponse = await createAvailabilityException(
      student.token,
      {
        exceptionDate: "2027-02-16",
        type: "unavailable",
        isFullDay: true,
        startTime: "12:00",
        endTime: "13:00",
      },
    );
    const partialWithoutTimesResponse = await createAvailabilityException(
      student.token,
      {
        exceptionDate: "2027-02-17",
        type: "extra_available",
        isFullDay: false,
        startTime: "",
        endTime: "",
      },
    );
    const filterResponse = await request(app)
      .get("/api/availability/exceptions?from=2027-02-20&to=2027-02-01")
      .set("Authorization", "Bearer " + student.token);

    expect(fullDayWithTimesResponse.status).toBe(400);
    expect(fullDayWithTimesResponse.body.error.message).toBe(
      "Validation failed.",
    );
    expect(partialWithoutTimesResponse.status).toBe(400);
    expect(partialWithoutTimesResponse.body.error.message).toBe(
      "Validation failed.",
    );
    expect(filterResponse.status).toBe(400);
    expect(filterResponse.body.error.message).toBe("Validation failed.");
  });

  it("returns 409 for conflicting exceptions", async () => {
    const student = await createTestStudent("exception-conflict");

    await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-16",
      type: "unavailable",
      isFullDay: true,
      startTime: undefined,
      endTime: undefined,
    });
    const fullDayConflictResponse = await createAvailabilityException(
      student.token,
      {
        exceptionDate: "2027-02-16",
        type: "extra_available",
        isFullDay: false,
        startTime: "12:00",
        endTime: "13:00",
      },
    );

    await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-17",
      type: "extra_available",
      startTime: "14:00",
      endTime: "16:00",
    });
    const partialOverlapResponse = await createAvailabilityException(
      student.token,
      {
        exceptionDate: "2027-02-17",
        type: "unavailable",
        startTime: "15:30",
        endTime: "17:00",
      },
    );
    const adjacentResponse = await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-17",
      type: "extra_available",
      startTime: "16:00",
      endTime: "17:00",
    });

    expect(fullDayConflictResponse.status).toBe(409);
    expect(fullDayConflictResponse.body.error.message).toBe(
      "Availability exception conflicts with an existing exception.",
    );
    expect(partialOverlapResponse.status).toBe(409);
    expect(adjacentResponse.status).toBe(201);
  });

  it("lists only owned exceptions and supports date and type filters", async () => {
    const student = await createTestStudent("exception-list-owner");
    const otherStudent = await createTestStudent("exception-list-other");

    await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-10",
      type: "unavailable",
      isFullDay: true,
      startTime: undefined,
      endTime: undefined,
      reason: "Travel",
    });
    await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-20",
      type: "extra_available",
      startTime: "13:00",
      endTime: "15:00",
      reason: "Class cancelled",
    });
    await createAvailabilityException(otherStudent.token, {
      exceptionDate: "2027-02-20",
      type: "extra_available",
      startTime: "13:00",
      endTime: "15:00",
      reason: "Other",
    });

    const allResponse = await request(app)
      .get("/api/availability/exceptions")
      .set("Authorization", "Bearer " + student.token);
    const filteredResponse = await request(app)
      .get(
        "/api/availability/exceptions?from=2027-02-15&to=2027-02-28&type=extra_available",
      )
      .set("Authorization", "Bearer " + student.token);

    expect(allResponse.status).toBe(200);
    expect(
      allResponse.body.data.availabilityExceptions.map(
        (exception) => exception.reason,
      ),
    ).toEqual(["Travel", "Class cancelled"]);
    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.data.availabilityExceptions).toHaveLength(1);
    expect(filteredResponse.body.data.availabilityExceptions[0]).toMatchObject({
      exceptionDate: "2027-02-20",
      type: "extra_available",
      reason: "Class cancelled",
    });
  });

  it("gets one owned exception", async () => {
    const student = await createTestStudent("exception-get");
    const createdException = await createAvailabilityException(student.token, {
      reason: "Work shift",
    });
    const availabilityExceptionId =
      getAvailabilityException(createdException).id;

    const response = await request(app)
      .get("/api/availability/exceptions/" + availabilityExceptionId)
      .set("Authorization", "Bearer " + student.token);

    expect(response.status).toBe(200);
    expect(getAvailabilityException(response)).toMatchObject({
      id: availabilityExceptionId,
      reason: "Work shift",
    });
  });

  it("returns 404 for another student's exception", async () => {
    const student = await createTestStudent("exception-private-owner");
    const otherStudent = await createTestStudent("exception-private-other");
    const otherException = await createAvailabilityException(
      otherStudent.token,
      {
        reason: "Private",
      },
    );
    const otherExceptionId = getAvailabilityException(otherException).id;

    const getResponse = await request(app)
      .get("/api/availability/exceptions/" + otherExceptionId)
      .set("Authorization", "Bearer " + student.token);
    const patchResponse = await updateAvailabilityException(
      student.token,
      otherExceptionId,
      { reason: "Changed" },
    );
    const deleteResponse = await request(app)
      .delete("/api/availability/exceptions/" + otherExceptionId)
      .set("Authorization", "Bearer " + student.token);

    expect(getResponse.status).toBe(404);
    expect(patchResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);

    const ownerResponse = await request(app)
      .get("/api/availability/exceptions/" + otherExceptionId)
      .set("Authorization", "Bearer " + otherStudent.token);

    expect(ownerResponse.status).toBe(200);
    expect(getAvailabilityException(ownerResponse).reason).toBe("Private");
  });

  it("updates an owned exception and clears times for full-day updates", async () => {
    const student = await createTestStudent("exception-update");
    const createdException = await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-17",
      type: "extra_available",
      startTime: "14:00",
      endTime: "16:00",
    });
    const availabilityExceptionId =
      getAvailabilityException(createdException).id;

    const partialUpdateResponse = await updateAvailabilityException(
      student.token,
      availabilityExceptionId,
      {
        exceptionDate: "2027-02-18",
        type: "unavailable",
        startTime: "15:00",
        endTime: "17:00",
        reason: " Work shift ",
      },
    );
    const fullDayUpdateResponse = await updateAvailabilityException(
      student.token,
      availabilityExceptionId,
      {
        isFullDay: true,
        reason: "Travel day",
      },
    );

    expect(partialUpdateResponse.status).toBe(200);
    expect(getAvailabilityException(partialUpdateResponse)).toMatchObject({
      exceptionDate: "2027-02-18",
      type: "unavailable",
      isFullDay: false,
      startTime: "15:00",
      endTime: "17:00",
      reason: "Work shift",
    });
    expect(fullDayUpdateResponse.status).toBe(200);
    expect(getAvailabilityException(fullDayUpdateResponse)).toMatchObject({
      exceptionDate: "2027-02-18",
      isFullDay: true,
      startTime: null,
      endTime: null,
      reason: "Travel day",
    });
  });

  it("blocks exception overlap updates", async () => {
    const student = await createTestStudent("exception-update-conflict");
    await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-17",
      startTime: "14:00",
      endTime: "16:00",
    });
    const secondException = await createAvailabilityException(student.token, {
      exceptionDate: "2027-02-17",
      startTime: "16:30",
      endTime: "17:30",
    });

    const conflictResponse = await updateAvailabilityException(
      student.token,
      getAvailabilityException(secondException).id,
      {
        startTime: "15:00",
        endTime: "17:00",
      },
    );

    expect(conflictResponse.status).toBe(409);
    expect(conflictResponse.body.error.message).toBe(
      "Availability exception conflicts with an existing exception.",
    );
  });

  it("returns 400 for empty exception updates and invalid exception IDs", async () => {
    const student = await createTestStudent("exception-bad-update");
    const createdException = await createAvailabilityException(student.token);

    const emptyUpdateResponse = await updateAvailabilityException(
      student.token,
      getAvailabilityException(createdException).id,
      {},
    );
    const invalidIdResponse = await request(app)
      .get("/api/availability/exceptions/not-a-uuid")
      .set("Authorization", "Bearer " + student.token);

    expect(emptyUpdateResponse.status).toBe(400);
    expect(emptyUpdateResponse.body.error.message).toBe("Validation failed.");
    expect(invalidIdResponse.status).toBe(400);
    expect(invalidIdResponse.body.error.message).toBe("Validation failed.");
  });

  it("deletes one owned exception", async () => {
    const student = await createTestStudent("exception-delete");
    const createdException = await createAvailabilityException(student.token);
    const availabilityExceptionId =
      getAvailabilityException(createdException).id;

    const deleteResponse = await request(app)
      .delete("/api/availability/exceptions/" + availabilityExceptionId)
      .set("Authorization", "Bearer " + student.token);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.text).toBe("");

    const getResponse = await request(app)
      .get("/api/availability/exceptions/" + availabilityExceptionId)
      .set("Authorization", "Bearer " + student.token);

    expect(getResponse.status).toBe(404);
  });
});
