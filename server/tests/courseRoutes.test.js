import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/studyguard_dev";
process.env.JWT_SECRET = "stage-9b-course-routes-test-secret";
process.env.JWT_EXPIRES_IN = "1h";

const { default: app } = await import("../src/app.js");
const { closeDatabase, query } = await import("../src/database/db.js");

const testEmailPattern = "course-test-%@example.com";

async function deleteTestUsers() {
  await query("DELETE FROM users WHERE email LIKE $1", [testEmailPattern]);
}

async function createTestStudent(label = "student") {
  const email = `course-test-${label}@example.com`;
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: `Course ${label}`,
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

async function updateCourse(token, courseId, body) {
  return request(app)
    .patch(`/api/courses/${courseId}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
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

describe("/api/courses", () => {
  it("requires authentication before listing courses", async () => {
    const response = await request(app).get("/api/courses");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Authentication required.",
      },
    });
  });

  it("creates an owned course and normalizes optional fields", async () => {
    const student = await createTestStudent("create");

    const response = await createCourse(student.token, {
      name: " Biology I ",
      code: " BIO 101 ",
      instructor: " ",
      color: " #10B981 ",
      term: " Spring 2027 ",
      targetGrade: "",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.course).toMatchObject({
      id: expect.any(String),
      name: "Biology I",
      code: "BIO 101",
      instructor: null,
      color: "#10B981",
      term: "Spring 2027",
      targetGrade: null,
      isArchived: false,
    });

    const storedCourse = await query(
      "SELECT user_id, instructor, target_grade FROM courses WHERE id = $1",
      [response.body.data.course.id],
    );

    expect(storedCourse.rows[0].user_id).toBe(student.user.id);
    expect(storedCourse.rows[0].instructor).toBeNull();
    expect(storedCourse.rows[0].target_grade).toBeNull();
  });

  it("returns 400 when create input is invalid", async () => {
    const student = await createTestStudent("invalid-create");

    const response = await createCourse(student.token, {
      name: "Biology I",
      color: "green",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe("Validation failed.");
  });

  it("lists active courses owned by the signed-in student by default", async () => {
    const student = await createTestStudent("list-owner");
    const otherStudent = await createTestStudent("list-other");

    await createCourse(student.token, { name: "Biology I" });
    const archivedCourse = await createCourse(student.token, {
      name: "History",
    });
    await updateCourse(student.token, archivedCourse.body.data.course.id, {
      isArchived: true,
    });
    await createCourse(otherStudent.token, { name: "Calculus" });

    const response = await request(app)
      .get("/api/courses")
      .set("Authorization", `Bearer ${student.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.courses.map((course) => course.name)).toEqual([
      "Biology I",
    ]);
  });

  it("filters archived courses and all courses", async () => {
    const student = await createTestStudent("filters");

    await createCourse(student.token, { name: "Biology I" });
    const archivedCourse = await createCourse(student.token, {
      name: "History",
    });
    await updateCourse(student.token, archivedCourse.body.data.course.id, {
      isArchived: true,
    });

    const archivedResponse = await request(app)
      .get("/api/courses?status=archived")
      .set("Authorization", `Bearer ${student.token}`);
    const allResponse = await request(app)
      .get("/api/courses?status=all")
      .set("Authorization", `Bearer ${student.token}`);

    expect(archivedResponse.status).toBe(200);
    expect(
      archivedResponse.body.data.courses.map((course) => course.name),
    ).toEqual(["History"]);
    expect(allResponse.status).toBe(200);
    expect(allResponse.body.data.courses.map((course) => course.name)).toEqual([
      "Biology I",
      "History",
    ]);
  });

  it("returns 400 when the list status filter is invalid", async () => {
    const student = await createTestStudent("bad-filter");

    const response = await request(app)
      .get("/api/courses?status=old")
      .set("Authorization", `Bearer ${student.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Validation failed.");
  });

  it("gets one owned course", async () => {
    const student = await createTestStudent("get-owned");
    const createdCourse = await createCourse(student.token, {
      name: "Chemistry",
    });
    const courseId = createdCourse.body.data.course.id;

    const response = await request(app)
      .get(`/api/courses/${courseId}`)
      .set("Authorization", `Bearer ${student.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.course).toMatchObject({
      id: courseId,
      name: "Chemistry",
    });
  });

  it("returns 404 for another student's course", async () => {
    const student = await createTestStudent("private-owner");
    const otherStudent = await createTestStudent("private-other");
    const otherCourse = await createCourse(otherStudent.token, {
      name: "Physics",
    });
    const otherCourseId = otherCourse.body.data.course.id;

    const getResponse = await request(app)
      .get(`/api/courses/${otherCourseId}`)
      .set("Authorization", `Bearer ${student.token}`);
    const patchResponse = await updateCourse(student.token, otherCourseId, {
      name: "Changed",
    });
    const deleteResponse = await request(app)
      .delete(`/api/courses/${otherCourseId}`)
      .set("Authorization", `Bearer ${student.token}`);

    expect(getResponse.status).toBe(404);
    expect(patchResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);

    const ownerResponse = await request(app)
      .get(`/api/courses/${otherCourseId}`)
      .set("Authorization", `Bearer ${otherStudent.token}`);

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.data.course.name).toBe("Physics");
  });

  it("updates an owned course", async () => {
    const student = await createTestStudent("update");
    const createdCourse = await createCourse(student.token);
    const courseId = createdCourse.body.data.course.id;

    const response = await updateCourse(student.token, courseId, {
      name: " Biology Lab ",
      code: "",
      instructor: " Prof. Allen ",
      color: "#2563EB",
      term: "Summer 2027",
      targetGrade: "A",
      isArchived: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.course).toMatchObject({
      id: courseId,
      name: "Biology Lab",
      code: null,
      instructor: "Prof. Allen",
      color: "#2563EB",
      term: "Summer 2027",
      targetGrade: "A",
      isArchived: true,
    });
  });

  it("returns 400 when update input is empty", async () => {
    const student = await createTestStudent("empty-update");
    const createdCourse = await createCourse(student.token);

    const response = await updateCourse(
      student.token,
      createdCourse.body.data.course.id,
      {},
    );

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Validation failed.");
  });

  it("returns 400 when the course id param is not a UUID", async () => {
    const student = await createTestStudent("bad-id");

    const response = await request(app)
      .get("/api/courses/not-a-uuid")
      .set("Authorization", `Bearer ${student.token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Validation failed.");
  });

  it("deletes one owned course", async () => {
    const student = await createTestStudent("delete");
    const createdCourse = await createCourse(student.token, {
      name: "Art History",
    });
    const courseId = createdCourse.body.data.course.id;

    const deleteResponse = await request(app)
      .delete(`/api/courses/${courseId}`)
      .set("Authorization", `Bearer ${student.token}`);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.text).toBe("");

    const getResponse = await request(app)
      .get(`/api/courses/${courseId}`)
      .set("Authorization", `Bearer ${student.token}`);

    expect(getResponse.status).toBe(404);
  });
});
