import { useEffect, useState } from "react";
import {
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
} from "../api/courseApi.js";

const colorOptions = [
  "#10B981",
  "#2563EB",
  "#F59E0B",
  "#DC2626",
  "#7C3AED",
  "#0F766E",
];

const filters = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" },
];

const initialCourseFormData = {
  name: "",
  code: "",
  instructor: "",
  color: "#10B981",
  term: "",
  targetGrade: "",
};

function formatFieldName(field) {
  return field
    .replace("body.", "")
    .replace("params.", "")
    .replace("query.", "");
}

function getErrorForField(fieldErrors, fieldName) {
  return fieldErrors.find((error) => error.field === "body." + fieldName);
}

function TextInput({ error, id, label, ...props }) {
  return (
    <label
      className="grid gap-2 text-sm font-medium text-slate-700"
      htmlFor={id}
    >
      <span>{label}</span>
      <input
        aria-describedby={error ? id + "-error" : undefined}
        aria-invalid={Boolean(error)}
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        id={id}
        {...props}
      />
      {error ? (
        <span className="text-xs font-medium text-red-700" id={id + "-error"}>
          {error.message}
        </span>
      ) : null}
    </label>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      className={
        "h-9 rounded-md px-3 text-sm font-semibold transition " +
        (active
          ? "bg-slate-950 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function CourseForm({
  editingCourseId,
  fieldErrors,
  formData,
  formError,
  isSaving,
  onCancelEdit,
  onChange,
  onColorChange,
  onSubmit,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">
          {editingCourseId ? "Edit Course" : "New Course"}
        </p>
        <h3 className="mt-1 text-xl font-semibold">
          {editingCourseId ? "Update Course" : "Create Course"}
        </h3>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "name")}
          id="course-name"
          label="Name"
          maxLength={160}
          name="name"
          onChange={onChange}
          placeholder="Biology I"
          required
          type="text"
          value={formData.name}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            autoComplete="off"
            error={getErrorForField(fieldErrors, "code")}
            id="course-code"
            label="Code"
            maxLength={40}
            name="code"
            onChange={onChange}
            placeholder="BIO 101"
            type="text"
            value={formData.code}
          />
          <TextInput
            autoComplete="off"
            error={getErrorForField(fieldErrors, "term")}
            id="course-term"
            label="Term"
            maxLength={80}
            name="term"
            onChange={onChange}
            placeholder="Spring 2027"
            type="text"
            value={formData.term}
          />
        </div>

        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "instructor")}
          id="course-instructor"
          label="Instructor"
          maxLength={120}
          name="instructor"
          onChange={onChange}
          placeholder="Dr. Rivera"
          type="text"
          value={formData.instructor}
        />

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Color</span>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  aria-label={"Use course color " + color}
                  className={
                    "h-9 w-9 rounded-md border transition focus:outline-none focus:ring-2 focus:ring-emerald-200 " +
                    (formData.color === color
                      ? "border-slate-950 ring-2 ring-slate-300"
                      : "border-slate-200 hover:border-slate-400")
                  }
                  key={color}
                  onClick={() => onColorChange(color)}
                  style={{ backgroundColor: color }}
                  title={color}
                  type="button"
                />
              ))}
            </div>
          </div>
          <TextInput
            autoComplete="off"
            error={getErrorForField(fieldErrors, "targetGrade")}
            id="course-target-grade"
            label="Target"
            maxLength={20}
            name="targetGrade"
            onChange={onChange}
            placeholder="A-"
            type="text"
            value={formData.targetGrade}
          />
        </div>

        {formError ? (
          <div
            aria-live="polite"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            <p>{formError}</p>
            {fieldErrors.length > 1 ? (
              <ul className="mt-2 grid gap-1">
                {fieldErrors.map((error) => (
                  <li key={error.field}>
                    {formatFieldName(error.field)}: {error.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? "Saving..."
              : editingCourseId
                ? "Update Course"
                : "Create Course"}
          </button>
          {editingCourseId ? (
            <button
              className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-28"
              disabled={isSaving}
              onClick={onCancelEdit}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function CourseRows({
  courses,
  deletingCourseId,
  onDeleteCourse,
  onEditCourse,
  onToggleArchive,
}) {
  if (courses.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        No courses found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Course
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Term
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Target
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Status
            </th>
            <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr className="align-top" key={course.id}>
              <td className="border-b border-slate-100 px-3 py-3">
                <div className="flex min-w-56 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 h-4 w-4 shrink-0 rounded-sm border border-slate-200"
                    style={{ backgroundColor: course.color ?? "#CBD5E1" }}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">
                      {course.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[course.code, course.instructor]
                        .filter(Boolean)
                        .join(" - ") || "No details"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {course.term ?? "-"}
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {course.targetGrade ?? "-"}
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <span
                  className={
                    "inline-flex h-7 items-center rounded-md px-2 text-xs font-semibold " +
                    (course.isArchived
                      ? "bg-slate-100 text-slate-600"
                      : "bg-emerald-50 text-emerald-800")
                  }
                >
                  {course.isArchived ? "Archived" : "Active"}
                </span>
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    onClick={() => onEditCourse(course)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    onClick={() => onToggleArchive(course)}
                    type="button"
                  >
                    {course.isArchived ? "Restore" : "Archive"}
                  </button>
                  <button
                    className="h-8 rounded-md border border-red-200 px-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={deletingCourseId === course.id}
                    onClick={() => onDeleteCourse(course)}
                    type="button"
                  >
                    {deletingCourseId === course.id ? "Deleting" : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseList({
  courses,
  deletingCourseId,
  filter,
  isLoading,
  onDeleteCourse,
  onEditCourse,
  onRefresh,
  onSetFilter,
  onToggleArchive,
  statusMessage,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Courses
          </p>
          <h3 className="mt-1 text-xl font-semibold">Course List</h3>
        </div>
        <button
          className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="inline-grid w-full grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 sm:w-auto">
          {filters.map((item) => (
            <FilterButton
              active={filter === item.value}
              key={item.value}
              onClick={() => onSetFilter(item.value)}
            >
              {item.label}
            </FilterButton>
          ))}
        </div>

        {statusMessage ? (
          <div
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {statusMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-md border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Loading courses.
          </div>
        ) : (
          <CourseRows
            courses={courses}
            deletingCourseId={deletingCourseId}
            onDeleteCourse={onDeleteCourse}
            onEditCourse={onEditCourse}
            onToggleArchive={onToggleArchive}
          />
        )}
      </div>
    </section>
  );
}

export default function CourseManagement({ authToken, onAuthExpired }) {
  const [courses, setCourses] = useState([]);
  const [courseFilter, setCourseFilter] = useState("active");
  const [courseFormData, setCourseFormData] = useState(initialCourseFormData);
  const [deletingCourseId, setDeletingCourseId] = useState("");
  const [editingCourseId, setEditingCourseId] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  async function loadCourses(status = courseFilter, { silent = false } = {}) {
    if (!authToken) {
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }

    try {
      const data = await listCourses(authToken, status);
      setCourses(data.courses);
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialCourses() {
      if (!authToken) {
        return;
      }

      setIsLoading(true);
      setFormError("");
      setFieldErrors([]);

      try {
        const data = await listCourses(authToken, courseFilter);

        if (!isCurrent) {
          return;
        }

        setCourses(data.courses);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        if (error.statusCode === 401) {
          onAuthExpired();
          return;
        }

        setFormError(error.message);
        setFieldErrors(error.details ?? []);
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadInitialCourses();

    return () => {
      isCurrent = false;
    };
  }, [authToken, courseFilter]);

  function resetCourseForm() {
    setCourseFormData(initialCourseFormData);
    setEditingCourseId("");
    setFieldErrors([]);
    setFormError("");
  }

  function handleCourseFormChange(event) {
    const { name, value } = event.target;

    setCourseFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleColorChange(color) {
    setCourseFormData((currentFormData) => ({
      ...currentFormData,
      color,
    }));
  }

  async function handleCourseSubmit(event) {
    event.preventDefault();

    if (!authToken) {
      onAuthExpired();
      return;
    }

    setFieldErrors([]);
    setFormError("");
    setStatusMessage("");
    setIsSaving(true);

    try {
      if (editingCourseId) {
        await updateCourse(authToken, editingCourseId, courseFormData);
        setStatusMessage("Course updated.");
        resetCourseForm();
        await loadCourses(courseFilter, { silent: true });
        return;
      }

      await createCourse(authToken, courseFormData);
      setStatusMessage("Course created.");
      resetCourseForm();

      if (courseFilter !== "active") {
        setCourseFilter("active");
      } else {
        await loadCourses("active", { silent: true });
      }
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditCourse(course) {
    setEditingCourseId(course.id);
    setCourseFormData({
      name: course.name,
      code: course.code ?? "",
      instructor: course.instructor ?? "",
      color: course.color ?? "",
      term: course.term ?? "",
      targetGrade: course.targetGrade ?? "",
    });
    setFieldErrors([]);
    setFormError("");
    setStatusMessage("");
  }

  async function handleToggleArchive(course) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    setStatusMessage("");
    setFormError("");
    setFieldErrors([]);

    try {
      await updateCourse(authToken, course.id, {
        isArchived: !course.isArchived,
      });
      setStatusMessage(
        course.isArchived ? "Course restored." : "Course archived.",
      );
      await loadCourses(courseFilter, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    }
  }

  async function handleDeleteCourse(course) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    const confirmed = window.confirm("Delete " + course.name + "?");

    if (!confirmed) {
      return;
    }

    setDeletingCourseId(course.id);
    setStatusMessage("");
    setFormError("");
    setFieldErrors([]);

    try {
      await deleteCourse(authToken, course.id);
      setStatusMessage("Course deleted.");

      if (editingCourseId === course.id) {
        resetCourseForm();
      }

      await loadCourses(courseFilter, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setDeletingCourseId("");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <CourseForm
        editingCourseId={editingCourseId}
        fieldErrors={fieldErrors}
        formData={courseFormData}
        formError={formError}
        isSaving={isSaving}
        onCancelEdit={resetCourseForm}
        onChange={handleCourseFormChange}
        onColorChange={handleColorChange}
        onSubmit={handleCourseSubmit}
      />
      <CourseList
        courses={courses}
        deletingCourseId={deletingCourseId}
        filter={courseFilter}
        isLoading={isLoading}
        onDeleteCourse={handleDeleteCourse}
        onEditCourse={handleEditCourse}
        onRefresh={() => loadCourses(courseFilter)}
        onSetFilter={setCourseFilter}
        onToggleArchive={handleToggleArchive}
        statusMessage={statusMessage}
      />
    </div>
  );
}
