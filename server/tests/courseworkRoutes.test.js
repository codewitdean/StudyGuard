import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-10b-coursework-routes-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "coursework-test-%@example.com";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
}

async function createTestStudent(label = "student") {
  const email = `coursework-test-${label}@example.com`;
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: `Coursework ${label}`,
      email,
      password: "correct-password",
    });

  return {
    email,
    token: response.body.data.token,
    user: response.body.data.user,
  };
}

async function createCourse(token, body = {}) {
  return request(app)
    .post("/api/courses")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Biology I",
      code: "BIO 101",
      instructor: "Dr. Rivera",
      color: "#10B981",
      term: "Spring 2027",
      targetGrade: "A-",
      ...body,
    });
}

async function createCoursework(token, body = {}) {
  return request(app)
    .post("/api/coursework")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Biology lab report",
      type: "assignment",
      ...body,
    });
}

async function updateCoursework(token, courseworkId, body) {
  return request(app)
    .patch(`/api/coursework/${courseworkId}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function getCourseworkItem(response) {
  return response.body.data.courseworkItem;
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

describe("/api/coursework", () => {
  it("requires authentication before listing coursework", async () => {
    const response = await request(app).get("/api/coursework");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Authentication required.",
      },
    });
  });

  it("creates owned coursework without a course and applies defaults", async () => {
    const student = await createTestStudent("create-no-course");

    const response = await createCoursework(student.token, {
      title: " Biology lab report ",
      type: " assignment ",
      dueAt: "",
      estimatedMinutes: "",
      gradeWeight: "",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(getCourseworkItem(response)).toMatchObject({
      id: expect.any(String),
      courseId: null,
      course: null,
      title: "Biology lab report",
      type: "assignment",
      dueAt: null,
      priority: "medium",
      difficulty: "medium",
      estimatedMinutes: 60,
      status: "not_started",
      gradeWeight: null,
      completedAt: null,
    });

    const storedCoursework = await query(
      "SELECT user_id, course_id FROM coursework WHERE id = $1",
      [getCourseworkItem(response).id],
    );

    expect(storedCoursework.rows[0].user_id).toBe(student.user.id);
    expect(storedCoursework.rows[0].course_id).toBeNull();
  });

  it("creates coursework for an owned course and normalizes optional fields", async () => {
    const student = await createTestStudent("create-owned-course");
    const courseResponse = await createCourse(student.token, {
      name: "Chemistry",
      code: "CHEM 201",
      color: "#2563EB",
    });
    const course = courseResponse.body.data.course;

    const response = await createCoursework(student.token, {
      courseId: course.id,
      title: " Enzyme lab ",
      description: " ",
      type: " project ",
      dueAt: "2999-02-16T02:00:00.000Z",
      priority: " high ",
      difficulty: " hard ",
      estimatedMinutes: "180",
      gradeWeight: "12.5",
      topic: "",
      notes: " Start with graph cleanup. ",
    });

    expect(response.status).toBe(201);
    expect(getCourseworkItem(response)).toMatchObject({
      courseId: course.id,
      course: {
        id: course.id,
        name: "Chemistry",
        code: "CHEM 201",
        color: "#2563EB",
      },
      title: "Enzyme lab",
      description: null,
      type: "project",
      dueAt: "2999-02-16T02:00:00.000Z",
      priority: "high",
      difficulty: "hard",
      estimatedMinutes: 180,
      gradeWeight: 12.5,
      topic: null,
      notes: "Start with graph cleanup.",
    });
  });

  it("returns 404 when attaching another student's course", async () => {
    const student = await createTestStudent("attach-owner");
    const otherStudent = await createTestStudent("attach-other");
    const otherCourse = await createCourse(otherStudent.token, {
      name: "Private Physics",
    });

    const response = await createCoursework(student.token, {
      courseId: otherCourse.body.data.course.id,
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Course not found.",
      },
    });
  });

  it("returns 400 for invalid create bodies and invalid list filters", async () => {
    const student = await createTestStudent("invalid-input");

    const createResponse = await request(app)
      .post("/api/coursework")
      .set("Authorization", `Bearer ${student.token}`)
      .send({
        title: "",
        type: "essay",
        dueAt: "not-a-date",
        estimatedMinutes: -1,
        gradeWeight: 101,
      });
    const listResponse = await request(app)
      .get("/api/coursework?status=done")
      .set("Authorization", `Bearer ${student.token}`);

    expect(createResponse.status).toBe(400);
    expect(createResponse.body.error.message).toBe("Validation failed.");
    expect(listResponse.status).toBe(400);
    expect(listResponse.body.error.message).toBe("Validation failed.");
  });

  it("lists open coursework owned by the signed-in student by default", async () => {
    const student = await createTestStudent("list-owner");
    const otherStudent = await createTestStudent("list-other");

    await createCoursework(student.token, { title: "Open assignment" });
    const completedCoursework = await createCoursework(student.token, {
      title: "Completed assignment",
    });
    await updateCoursework(
      student.token,
      getCourseworkItem(completedCoursework).id,
      { status: "completed" },
    );
    await createCoursework(otherStudent.token, { title: "Other assignment" });

    const response = await request(app)
      .get("/api/coursework")
      .set("Authorization", `Bearer ${student.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.coursework.map((item) => item.title)).toEqual([
      "Open assignment",
    ]);
  });

  it("filters coursework by course, type, status, due date, and sort", async () => {
    const student = await createTestStudent("filters");
    const biologyCourse = await createCourse(student.token, {
      name: "Biology",
    });
    const historyCourse = await createCourse(student.token, {
      name: "History",
    });
    const biologyCourseId = biologyCourse.body.data.course.id;
    const historyCourseId = historyCourse.body.data.course.id;

    await createCoursework(student.token, {
      courseId: biologyCourseId,
      title: "Past project",
      type: "project",
      dueAt: "2020-01-01T00:00:00.000Z",
      estimatedMinutes: 300,
    });
    await createCoursework(student.token, {
      courseId: historyCourseId,
      title: "Future reading",
      type: "reading",
      dueAt: "2999-01-01T00:00:00.000Z",
      estimatedMinutes: 30,
    });
    await createCoursework(student.token, {
      title: "No due assignment",
      type: "assignment",
      estimatedMinutes: 60,
    });
    const completedCoursework = await createCoursework(student.token, {
      title: "Completed quiz",
      type: "quiz",
      dueAt: "2999-02-01T00:00:00.000Z",
      estimatedMinutes: 10,
    });
    await updateCoursework(
      student.token,
      getCourseworkItem(completedCoursework).id,
      { status: "completed" },
    );

    const courseTypeDueResponse = await request(app)
      .get(
        `/api/coursework?courseId=${biologyCourseId}&type=project&due=overdue`,
      )
      .set("Authorization", `Bearer ${student.token}`);
    const completedResponse = await request(app)
      .get("/api/coursework?status=completed")
      .set("Authorization", `Bearer ${student.token}`);
    const noDueResponse = await request(app)
      .get("/api/coursework?due=no_due_date")
      .set("Authorization", `Bearer ${student.token}`);
    const upcomingResponse = await request(app)
      .get("/api/coursework?due=upcoming")
      .set("Authorization", `Bearer ${student.token}`);
    const effortSortResponse = await request(app)
      .get("/api/coursework?status=all&sort=effortHigh")
      .set("Authorization", `Bearer ${student.token}`);

    expect(courseTypeDueResponse.status).toBe(200);
    expect(
      courseTypeDueResponse.body.data.coursework.map((item) => item.title),
    ).toEqual(["Past project"]);
    expect(
      completedResponse.body.data.coursework.map((item) => item.title),
    ).toEqual(["Completed quiz"]);
    expect(
      noDueResponse.body.data.coursework.map((item) => item.title),
    ).toEqual(["No due assignment"]);
    expect(
      upcomingResponse.body.data.coursework.map((item) => item.title),
    ).toEqual(["Future reading"]);
    expect(effortSortResponse.body.data.coursework[0].title).toBe(
      "Past project",
    );
  });

  it("gets one owned coursework item", async () => {
    const student = await createTestStudent("get-owned");
    const createdCoursework = await createCoursework(student.token, {
      title: "Chemistry problem set",
    });
    const courseworkId = getCourseworkItem(createdCoursework).id;

    const response = await request(app)
      .get(`/api/coursework/${courseworkId}`)
      .set("Authorization", `Bearer ${student.token}`);

    expect(response.status).toBe(200);
    expect(getCourseworkItem(response)).toMatchObject({
      id: courseworkId,
      title: "Chemistry problem set",
    });
  });

  it("returns 404 for another student's coursework item", async () => {
    const student = await createTestStudent("private-owner");
    const otherStudent = await createTestStudent("private-other");
    const otherCoursework = await createCoursework(otherStudent.token, {
      title: "Private reading",
    });
    const otherCourseworkId = getCourseworkItem(otherCoursework).id;

    const getResponse = await request(app)
      .get(`/api/coursework/${otherCourseworkId}`)
      .set("Authorization", `Bearer ${student.token}`);
    const patchResponse = await updateCoursework(
      student.token,
      otherCourseworkId,
      {
        title: "Changed",
      },
    );
    const deleteResponse = await request(app)
      .delete(`/api/coursework/${otherCourseworkId}`)
      .set("Authorization", `Bearer ${student.token}`);

    expect(getResponse.status).toBe(404);
    expect(patchResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);

    const ownerResponse = await request(app)
      .get(`/api/coursework/${otherCourseworkId}`)
      .set("Authorization", `Bearer ${otherStudent.token}`);

    expect(ownerResponse.status).toBe(200);
    expect(getCourseworkItem(ownerResponse).title).toBe("Private reading");
  });

  it("updates an owned coursework item", async () => {
    const student = await createTestStudent("update");
    const originalCourse = await createCourse(student.token, {
      name: "Biology",
    });
    const newCourse = await createCourse(student.token, { name: "Chemistry" });
    const createdCoursework = await createCoursework(student.token, {
      courseId: originalCourse.body.data.course.id,
    });
    const courseworkId = getCourseworkItem(createdCoursework).id;

    const response = await updateCoursework(student.token, courseworkId, {
      courseId: newCourse.body.data.course.id,
      title: " Final exam prep ",
      description: "",
      type: "exam",
      dueAt: "2999-06-01T12:00:00.000Z",
      priority: "urgent",
      difficulty: "very_hard",
      estimatedMinutes: "210",
      gradeWeight: null,
      topic: " Kinetics ",
      notes: " Ask about practice packet. ",
    });

    expect(response.status).toBe(200);
    expect(getCourseworkItem(response)).toMatchObject({
      id: courseworkId,
      courseId: newCourse.body.data.course.id,
      course: {
        id: newCourse.body.data.course.id,
        name: "Chemistry",
      },
      title: "Final exam prep",
      description: null,
      type: "exam",
      dueAt: "2999-06-01T12:00:00.000Z",
      priority: "urgent",
      difficulty: "very_hard",
      estimatedMinutes: 210,
      gradeWeight: null,
      topic: "Kinetics",
      notes: "Ask about practice packet.",
    });
  });

  it("sets and clears completedAt when status changes", async () => {
    const student = await createTestStudent("completion");
    const createdCoursework = await createCoursework(student.token);
    const courseworkId = getCourseworkItem(createdCoursework).id;

    const completedResponse = await updateCoursework(
      student.token,
      courseworkId,
      {
        status: "completed",
      },
    );
    const completedAt = getCourseworkItem(completedResponse).completedAt;
    const inProgressResponse = await updateCoursework(
      student.token,
      courseworkId,
      {
        status: "in_progress",
      },
    );
    const storedCoursework = await query(
      "SELECT completed_at FROM coursework WHERE id = $1",
      [courseworkId],
    );

    expect(completedResponse.status).toBe(200);
    expect(completedAt).toEqual(expect.any(String));
    expect(inProgressResponse.status).toBe(200);
    expect(getCourseworkItem(inProgressResponse).completedAt).toBeNull();
    expect(storedCoursework.rows[0].completed_at).toBeNull();
  });

  it("returns 400 when update input is empty", async () => {
    const student = await createTestStudent("empty-update");
    const createdCoursework = await createCoursework(student.token);

    const response = await updateCoursework(
      student.token,
      getCourseworkItem(createdCoursework).id,
      {},
    );

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Validation failed.");
  });

  it("returns 400 when the coursework id param is not a UUID", async () => {
    const student = await createTestStudent("bad-id");

    const response = await request(app)
      .get("/api/coursework/not-a-uuid")
      .set("Authorization", `Bearer ${student.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Validation failed.");
  });

  it("deletes one owned coursework item", async () => {
    const student = await createTestStudent("delete");
    const createdCoursework = await createCoursework(student.token, {
      title: "Delete this task",
    });
    const courseworkId = getCourseworkItem(createdCoursework).id;

    const deleteResponse = await request(app)
      .delete(`/api/coursework/${courseworkId}`)
      .set("Authorization", `Bearer ${student.token}`);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.text).toBe("");

    const getResponse = await request(app)
      .get(`/api/coursework/${courseworkId}`)
      .set("Authorization", `Bearer ${student.token}`);

    expect(getResponse.status).toBe(404);
  });
});
