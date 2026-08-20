import { useEffect, useState } from "react";
import { listCourses } from "../api/courseApi.js";
import {
  createCoursework,
  deleteCoursework,
  listCoursework,
  updateCoursework,
} from "../api/courseworkApi.js";

const typeOptions = [
  { label: "Assignment", value: "assignment" },
  { label: "Project", value: "project" },
  { label: "Quiz", value: "quiz" },
  { label: "Test", value: "test" },
  { label: "Exam", value: "exam" },
  { label: "Reading", value: "reading" },
  { label: "Study Task", value: "study_task" },
];

const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

const difficultyOptions = [
  { label: "Easy", value: "easy" },
  { label: "Medium", value: "medium" },
  { label: "Hard", value: "hard" },
  { label: "Very Hard", value: "very_hard" },
];

const statusOptions = [
  { label: "Not Started", value: "not_started" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Postponed", value: "postponed" },
  { label: "Missed", value: "missed" },
  { label: "Archived", value: "archived" },
];

const statusFilterOptions = [
  { label: "Open", value: "open" },
  { label: "All", value: "all" },
  ...statusOptions,
];

const dueFilterOptions = [
  { label: "All Due Dates", value: "all" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Overdue", value: "overdue" },
  { label: "No Due Date", value: "no_due_date" },
];

const sortOptions = [
  { label: "Due Date", value: "dueDate" },
  { label: "Newest", value: "createdNewest" },
  { label: "Effort High", value: "effortHigh" },
];

const initialCourseworkFilters = {
  status: "open",
  courseId: "all",
  type: "all",
  due: "all",
  sort: "dueDate",
};

const initialCourseworkFormData = {
  courseId: "",
  title: "",
  description: "",
  type: "assignment",
  dueAt: "",
  priority: "medium",
  difficulty: "medium",
  estimatedMinutes: "60",
  gradeWeight: "",
  topic: "",
  notes: "",
  status: "not_started",
};

const statusStyles = {
  not_started: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-800",
  completed: "bg-emerald-50 text-emerald-800",
  postponed: "bg-amber-50 text-amber-800",
  missed: "bg-red-50 text-red-800",
  archived: "bg-slate-200 text-slate-600",
};

const priorityStyles = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-50 text-blue-800",
  high: "bg-amber-50 text-amber-800",
  urgent: "bg-red-50 text-red-800",
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

function formatOptionLabel(value) {
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMinutes(minutes) {
  if (!minutes) {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return minutes + "m";
  }

  if (remainingMinutes === 0) {
    return hours + "h";
  }

  return hours + "h " + remainingMinutes + "m";
}

function formatDueDate(dueAt) {
  if (!dueAt) {
    return "No due date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dueAt));
}

function formatDateTimeForInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toApiDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function isOverdue(item) {
  return Boolean(
    item.dueAt &&
    item.status !== "completed" &&
    item.status !== "archived" &&
    new Date(item.dueAt).getTime() < Date.now(),
  );
}

function buildCourseLabel(course) {
  const label = [course.code, course.name].filter(Boolean).join(" - ");
  return course.isArchived ? label + " (Archived)" : label;
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

function TextArea({ error, id, label, ...props }) {
  return (
    <label
      className="grid gap-2 text-sm font-medium text-slate-700"
      htmlFor={id}
    >
      <span>{label}</span>
      <textarea
        aria-describedby={error ? id + "-error" : undefined}
        aria-invalid={Boolean(error)}
        className="min-h-20 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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

function SelectInput({ children, error, id, label, ...props }) {
  return (
    <label
      className="grid gap-2 text-sm font-medium text-slate-700"
      htmlFor={id}
    >
      <span>{label}</span>
      <select
        aria-describedby={error ? id + "-error" : undefined}
        aria-invalid={Boolean(error)}
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        id={id}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span className="text-xs font-medium text-red-700" id={id + "-error"}>
          {error.message}
        </span>
      ) : null}
    </label>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (statusStyles[status] ?? statusStyles.not_started)
      }
    >
      {formatOptionLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (priorityStyles[priority] ?? priorityStyles.medium)
      }
    >
      {formatOptionLabel(priority)}
    </span>
  );
}

function CourseworkForm({
  courses,
  editingCourseworkId,
  fieldErrors,
  formData,
  formError,
  isSaving,
  onCancelEdit,
  onChange,
  onSubmit,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">
          {editingCourseworkId ? "Edit Coursework" : "New Coursework"}
        </p>
        <h3 className="mt-1 text-xl font-semibold">
          {editingCourseworkId ? "Update Task" : "Create Task"}
        </h3>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "title")}
          id="coursework-title"
          label="Title"
          maxLength={200}
          name="title"
          onChange={onChange}
          placeholder="Biology lab report"
          required
          type="text"
          value={formData.title}
        />

        <SelectInput
          error={getErrorForField(fieldErrors, "courseId")}
          id="coursework-course"
          label="Course"
          name="courseId"
          onChange={onChange}
          value={formData.courseId}
        >
          <option value="">No course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {buildCourseLabel(course)}
            </option>
          ))}
        </SelectInput>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput
            error={getErrorForField(fieldErrors, "type")}
            id="coursework-type"
            label="Type"
            name="type"
            onChange={onChange}
            value={formData.type}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          <TextInput
            error={getErrorForField(fieldErrors, "dueAt")}
            id="coursework-due-at"
            label="Due"
            name="dueAt"
            onChange={onChange}
            type="datetime-local"
            value={formData.dueAt}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput
            error={getErrorForField(fieldErrors, "priority")}
            id="coursework-priority"
            label="Priority"
            name="priority"
            onChange={onChange}
            value={formData.priority}
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            error={getErrorForField(fieldErrors, "difficulty")}
            id="coursework-difficulty"
            label="Difficulty"
            name="difficulty"
            onChange={onChange}
            value={formData.difficulty}
          >
            {difficultyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            error={getErrorForField(fieldErrors, "estimatedMinutes")}
            id="coursework-estimated-minutes"
            label="Effort Minutes"
            min="1"
            name="estimatedMinutes"
            onChange={onChange}
            placeholder="180"
            type="number"
            value={formData.estimatedMinutes}
          />
          <TextInput
            error={getErrorForField(fieldErrors, "gradeWeight")}
            id="coursework-grade-weight"
            label="Grade Weight"
            max="100"
            min="0"
            name="gradeWeight"
            onChange={onChange}
            placeholder="12.5"
            step="0.01"
            type="number"
            value={formData.gradeWeight}
          />
        </div>

        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "topic")}
          id="coursework-topic"
          label="Topic"
          maxLength={120}
          name="topic"
          onChange={onChange}
          placeholder="Enzymes"
          type="text"
          value={formData.topic}
        />

        {editingCourseworkId ? (
          <SelectInput
            error={getErrorForField(fieldErrors, "status")}
            id="coursework-status"
            label="Status"
            name="status"
            onChange={onChange}
            value={formData.status}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        ) : null}

        <TextArea
          error={getErrorForField(fieldErrors, "description")}
          id="coursework-description"
          label="Description"
          name="description"
          onChange={onChange}
          placeholder="Write the enzyme lab report."
          value={formData.description}
        />

        <TextArea
          error={getErrorForField(fieldErrors, "notes")}
          id="coursework-notes"
          label="Notes"
          name="notes"
          onChange={onChange}
          placeholder="Start with data table cleanup."
          value={formData.notes}
        />

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
              : editingCourseworkId
                ? "Update Task"
                : "Create Task"}
          </button>
          {editingCourseworkId ? (
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

function CourseworkFilters({
  courses,
  filters,
  isLoading,
  onChange,
  onRefresh,
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
      <SelectInput
        id="coursework-filter-status"
        label="Status"
        name="status"
        onChange={onChange}
        value={filters.status}
      >
        {statusFilterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>

      <SelectInput
        id="coursework-filter-course"
        label="Course"
        name="courseId"
        onChange={onChange}
        value={filters.courseId}
      >
        <option value="all">All Courses</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {buildCourseLabel(course)}
          </option>
        ))}
      </SelectInput>

      <SelectInput
        id="coursework-filter-type"
        label="Type"
        name="type"
        onChange={onChange}
        value={filters.type}
      >
        <option value="all">All Types</option>
        {typeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>

      <SelectInput
        id="coursework-filter-due"
        label="Due"
        name="due"
        onChange={onChange}
        value={filters.due}
      >
        {dueFilterOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>

      <SelectInput
        id="coursework-filter-sort"
        label="Sort"
        name="sort"
        onChange={onChange}
        value={filters.sort}
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>

      <button
        className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        disabled={isLoading}
        onClick={onRefresh}
        type="button"
      >
        {isLoading ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  );
}

function CourseworkRows({
  coursework,
  deletingCourseworkId,
  onDeleteCoursework,
  onEditCoursework,
  onQuickStatusChange,
  updatingStatusId,
}) {
  if (coursework.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        No coursework found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Coursework
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Course
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Due
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Effort
            </th>
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              Priority
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
          {coursework.map((item) => (
            <tr className="align-top" key={item.id}>
              <td className="border-b border-slate-100 px-3 py-3">
                <div className="min-w-60">
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[formatOptionLabel(item.type), item.topic]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                  {item.gradeWeight !== null ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {item.gradeWeight}% of grade
                    </p>
                  ) : null}
                </div>
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {item.course ? (
                  <div className="flex min-w-40 items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-slate-200"
                      style={{
                        backgroundColor: item.course.color ?? "#CBD5E1",
                      }}
                    />
                    <span>
                      {[item.course.code, item.course.name]
                        .filter(Boolean)
                        .join(" - ")}
                    </span>
                  </div>
                ) : (
                  "No course"
                )}
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <span
                  className={
                    isOverdue(item)
                      ? "font-semibold text-red-700"
                      : "text-slate-600"
                  }
                >
                  {formatDueDate(item.dueAt)}
                </span>
              </td>
              <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                {formatMinutes(item.estimatedMinutes)}
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <PriorityBadge priority={item.priority} />
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="border-b border-slate-100 px-3 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  {item.status === "completed" ? (
                    <button
                      className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={updatingStatusId === item.id}
                      onClick={() => onQuickStatusChange(item, "in_progress")}
                      type="button"
                    >
                      Reopen
                    </button>
                  ) : item.status === "archived" ? (
                    <button
                      className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={updatingStatusId === item.id}
                      onClick={() => onQuickStatusChange(item, "not_started")}
                      type="button"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      className="h-8 rounded-md border border-emerald-200 px-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={updatingStatusId === item.id}
                      onClick={() => onQuickStatusChange(item, "completed")}
                      type="button"
                    >
                      Complete
                    </button>
                  )}
                  {item.status !== "archived" ? (
                    <button
                      className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={updatingStatusId === item.id}
                      onClick={() => onQuickStatusChange(item, "archived")}
                      type="button"
                    >
                      Archive
                    </button>
                  ) : null}
                  <button
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    onClick={() => onEditCoursework(item)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="h-8 rounded-md border border-red-200 px-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={deletingCourseworkId === item.id}
                    onClick={() => onDeleteCoursework(item)}
                    type="button"
                  >
                    {deletingCourseworkId === item.id ? "Deleting" : "Delete"}
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

function CourseworkList({
  courses,
  coursework,
  deletingCourseworkId,
  filters,
  isLoading,
  onDeleteCoursework,
  onEditCoursework,
  onFilterChange,
  onQuickStatusChange,
  onRefresh,
  statusMessage,
  updatingStatusId,
}) {
  const openCount = coursework.filter((item) =>
    ["not_started", "in_progress", "postponed"].includes(item.status),
  ).length;
  const overdueCount = coursework.filter(isOverdue).length;
  const totalMinutes = coursework.reduce(
    (total, item) => total + item.estimatedMinutes,
    0,
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Coursework
          </p>
          <h3 className="mt-1 text-xl font-semibold">Task List</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryStat label="Visible" value={coursework.length} />
          <SummaryStat label="Open" value={openCount} />
          <SummaryStat label="Effort" value={formatMinutes(totalMinutes)} />
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <CourseworkFilters
          courses={courses}
          filters={filters}
          isLoading={isLoading}
          onChange={onFilterChange}
          onRefresh={onRefresh}
        />

        {overdueCount > 0 ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {overdueCount} visible item{overdueCount === 1 ? " is" : "s are"}{" "}
            overdue.
          </div>
        ) : null}

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
            Loading coursework.
          </div>
        ) : (
          <CourseworkRows
            coursework={coursework}
            deletingCourseworkId={deletingCourseworkId}
            onDeleteCoursework={onDeleteCoursework}
            onEditCoursework={onEditCoursework}
            onQuickStatusChange={onQuickStatusChange}
            updatingStatusId={updatingStatusId}
          />
        )}
      </div>
    </section>
  );
}

export default function CourseworkManagement({ authToken, onAuthExpired }) {
  const [courses, setCourses] = useState([]);
  const [coursework, setCoursework] = useState([]);
  const [courseworkFilters, setCourseworkFilters] = useState(
    initialCourseworkFilters,
  );
  const [courseworkFormData, setCourseworkFormData] = useState(
    initialCourseworkFormData,
  );
  const [deletingCourseworkId, setDeletingCourseworkId] = useState("");
  const [editingCourseworkId, setEditingCourseworkId] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState("");

  async function loadCourseOptions({ silent = false } = {}) {
    if (!authToken) {
      return;
    }

    try {
      const data = await listCourses(authToken, "all");
      setCourses(data.courses);
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      if (!silent) {
        setFormError(error.message);
        setFieldErrors(error.details ?? []);
      }
    }
  }

  async function loadCoursework(
    filters = courseworkFilters,
    { silent = false } = {},
  ) {
    if (!authToken) {
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }

    try {
      const data = await listCoursework(authToken, filters);
      setCoursework(data.coursework);
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

      try {
        const data = await listCourses(authToken, "all");

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
      }
    }

    loadInitialCourses();

    return () => {
      isCurrent = false;
    };
  }, [authToken, onAuthExpired]);

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialCoursework() {
      if (!authToken) {
        return;
      }

      setIsLoading(true);
      setFormError("");
      setFieldErrors([]);

      try {
        const data = await listCoursework(authToken, courseworkFilters);

        if (!isCurrent) {
          return;
        }

        setCoursework(data.coursework);
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

    loadInitialCoursework();

    return () => {
      isCurrent = false;
    };
  }, [authToken, courseworkFilters, onAuthExpired]);

  function resetCourseworkForm() {
    setCourseworkFormData(initialCourseworkFormData);
    setEditingCourseworkId("");
    setFieldErrors([]);
    setFormError("");
  }

  function handleCourseworkFormChange(event) {
    const { name, value } = event.target;

    setCourseworkFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setCourseworkFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
    setStatusMessage("");
    setFormError("");
    setFieldErrors([]);
  }

  function getPayloadFromForm() {
    return {
      courseId: courseworkFormData.courseId,
      title: courseworkFormData.title,
      description: courseworkFormData.description,
      type: courseworkFormData.type,
      dueAt: toApiDateTime(courseworkFormData.dueAt),
      priority: courseworkFormData.priority,
      difficulty: courseworkFormData.difficulty,
      estimatedMinutes: courseworkFormData.estimatedMinutes,
      gradeWeight: courseworkFormData.gradeWeight,
      topic: courseworkFormData.topic,
      notes: courseworkFormData.notes,
    };
  }

  async function handleCourseworkSubmit(event) {
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
      if (editingCourseworkId) {
        await updateCoursework(authToken, editingCourseworkId, {
          ...getPayloadFromForm(),
          status: courseworkFormData.status,
        });
        setStatusMessage("Coursework updated.");
        resetCourseworkForm();
        await loadCoursework(courseworkFilters, { silent: true });
        return;
      }

      await createCoursework(authToken, getPayloadFromForm());
      setStatusMessage("Coursework created.");
      resetCourseworkForm();

      if (
        JSON.stringify(courseworkFilters) !==
        JSON.stringify(initialCourseworkFilters)
      ) {
        setCourseworkFilters(initialCourseworkFilters);
      } else {
        await loadCoursework(initialCourseworkFilters, { silent: true });
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

  function handleEditCoursework(item) {
    setEditingCourseworkId(item.id);
    setCourseworkFormData({
      courseId: item.courseId ?? "",
      title: item.title,
      description: item.description ?? "",
      type: item.type,
      dueAt: formatDateTimeForInput(item.dueAt),
      priority: item.priority,
      difficulty: item.difficulty,
      estimatedMinutes: String(item.estimatedMinutes),
      gradeWeight: item.gradeWeight === null ? "" : String(item.gradeWeight),
      topic: item.topic ?? "",
      notes: item.notes ?? "",
      status: item.status,
    });
    setFieldErrors([]);
    setFormError("");
    setStatusMessage("");
  }

  async function handleQuickStatusChange(item, status) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    setUpdatingStatusId(item.id);
    setStatusMessage("");
    setFormError("");
    setFieldErrors([]);

    try {
      await updateCoursework(authToken, item.id, { status });
      setStatusMessage("Coursework status updated.");

      if (editingCourseworkId === item.id) {
        resetCourseworkForm();
      }

      await loadCoursework(courseworkFilters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setUpdatingStatusId("");
    }
  }

  async function handleDeleteCoursework(item) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    const confirmed = window.confirm("Delete " + item.title + "?");

    if (!confirmed) {
      return;
    }

    setDeletingCourseworkId(item.id);
    setStatusMessage("");
    setFormError("");
    setFieldErrors([]);

    try {
      await deleteCoursework(authToken, item.id);
      setStatusMessage("Coursework deleted.");

      if (editingCourseworkId === item.id) {
        resetCourseworkForm();
      }

      await loadCoursework(courseworkFilters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setDeletingCourseworkId("");
    }
  }

  async function handleRefresh() {
    setStatusMessage("");
    setFormError("");
    setFieldErrors([]);
    await Promise.all([loadCourseOptions(), loadCoursework(courseworkFilters)]);
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <CourseworkForm
        courses={courses}
        editingCourseworkId={editingCourseworkId}
        fieldErrors={fieldErrors}
        formData={courseworkFormData}
        formError={formError}
        isSaving={isSaving}
        onCancelEdit={resetCourseworkForm}
        onChange={handleCourseworkFormChange}
        onSubmit={handleCourseworkSubmit}
      />
      <CourseworkList
        courses={courses}
        coursework={coursework}
        deletingCourseworkId={deletingCourseworkId}
        filters={courseworkFilters}
        isLoading={isLoading}
        onDeleteCoursework={handleDeleteCoursework}
        onEditCoursework={handleEditCoursework}
        onFilterChange={handleFilterChange}
        onQuickStatusChange={handleQuickStatusChange}
        onRefresh={handleRefresh}
        statusMessage={statusMessage}
        updatingStatusId={updatingStatusId}
      />
    </div>
  );
}
