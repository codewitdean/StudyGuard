import { useEffect, useMemo, useState } from "react";
import {
  createStudySession,
  deleteStudySession,
  getProgressSummary,
  listStudySessions,
  updateStudySession,
} from "../api/progressApi.js";

const sourceOptions = [
  { label: "Manual", value: "manual" },
  { label: "Timer", value: "timer" },
];

const sourceFilterOptions = [
  { label: "All Sources", value: "all" },
  ...sourceOptions,
];

const accuracyStyles = {
  not_enough_data: "bg-slate-100 text-slate-700",
  usually_close: "bg-emerald-50 text-emerald-800",
  taking_longer_than_estimated: "bg-amber-50 text-amber-800",
  finishing_faster_than_estimated: "bg-blue-50 text-blue-800",
  mixed: "bg-purple-50 text-purple-800",
};

const sourceStyles = {
  manual: "bg-emerald-50 text-emerald-800",
  timer: "bg-blue-50 text-blue-800",
};

function getLocalDateString(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function getCurrentWeekRange() {
  const today = getLocalDateString(new Date());
  const date = new Date(today + "T00:00:00");
  const mondayOffset = (date.getDay() + 6) % 7;
  const from = addDays(today, -mondayOffset);

  return {
    from,
    to: addDays(from, 6),
  };
}

function getDateTimeInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function getInitialSessionFormData() {
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - 60 * 60000);

  return {
    courseworkId: "",
    studyBlockId: "",
    source: "manual",
    startedAt: getDateTimeInputValue(startedAt),
    endedAt: getDateTimeInputValue(endedAt),
    durationMinutes: "60",
    notes: "",
  };
}

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
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMinutes(minutes) {
  if (!minutes) {
    return "0m";
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

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(dateString + "T00:00:00"));
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateTimeForInput(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return getDateTimeInputValue(date);
}

function toApiDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function getRelatedLabel(studySession) {
  if (studySession.coursework) {
    const courseLabel = studySession.coursework.course
      ? [
          studySession.coursework.course.code,
          studySession.coursework.course.name,
        ]
          .filter(Boolean)
          .join(" - ")
      : "No course";

    return studySession.coursework.title + " - " + courseLabel;
  }

  if (studySession.studyBlock) {
    return "Study block - " + formatDateTime(studySession.studyBlock.startAt);
  }

  return "General study";
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
        className="min-h-24 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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

function ErrorPanel({ fieldErrors, formError }) {
  if (!formError) {
    return null;
  }

  return (
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

function SourceBadge({ source }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (sourceStyles[source] ?? "bg-slate-100 text-slate-700")
      }
    >
      {formatOptionLabel(source)}
    </span>
  );
}

function AccuracyBadge({ label }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (accuracyStyles[label] ?? "bg-slate-100 text-slate-700")
      }
    >
      {formatOptionLabel(label)}
    </span>
  );
}

function ProgressFilters({
  filters,
  isLoading,
  onChange,
  onRefresh,
  onResetWeek,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">Range</p>
        <h3 className="mt-1 text-xl font-semibold">Progress Window</h3>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
          <TextInput
            id="progress-filter-from"
            label="From"
            name="from"
            onChange={onChange}
            type="date"
            value={filters.from}
          />
          <TextInput
            id="progress-filter-to"
            label="To"
            name="to"
            onChange={onChange}
            type="date"
            value={filters.to}
          />
        </div>

        <SelectInput
          id="progress-filter-source"
          label="Session Source"
          name="source"
          onChange={onChange}
          value={filters.source}
        >
          {sourceFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>

        <TextInput
          autoComplete="off"
          id="progress-filter-coursework"
          label="Coursework ID"
          name="courseworkId"
          onChange={onChange}
          placeholder="Optional UUID"
          type="text"
          value={filters.courseworkId}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:flex-1"
            disabled={isLoading}
            onClick={onRefresh}
            type="button"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:flex-1"
            disabled={isLoading}
            onClick={onResetWeek}
            type="button"
          >
            This Week
          </button>
        </div>
      </div>
    </section>
  );
}

function StudySessionForm({
  editingStudySessionId,
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
          {editingStudySessionId ? "Edit Session" : "New Session"}
        </p>
        <h3 className="mt-1 text-xl font-semibold">
          {editingStudySessionId ? "Update Study Time" : "Log Study Time"}
        </h3>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
          <SelectInput
            error={getErrorForField(fieldErrors, "source")}
            id="study-session-source"
            label="Source"
            name="source"
            onChange={onChange}
            value={formData.source}
          >
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
          <TextInput
            error={getErrorForField(fieldErrors, "durationMinutes")}
            id="study-session-duration"
            label="Minutes"
            min="1"
            name="durationMinutes"
            onChange={onChange}
            type="number"
            value={formData.durationMinutes}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
          <TextInput
            error={getErrorForField(fieldErrors, "startedAt")}
            id="study-session-started-at"
            label="Started"
            name="startedAt"
            onChange={onChange}
            type="datetime-local"
            value={formData.startedAt}
          />
          <TextInput
            error={getErrorForField(fieldErrors, "endedAt")}
            id="study-session-ended-at"
            label="Ended"
            name="endedAt"
            onChange={onChange}
            type="datetime-local"
            value={formData.endedAt}
          />
        </div>

        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "courseworkId")}
          id="study-session-coursework-id"
          label="Coursework ID"
          name="courseworkId"
          onChange={onChange}
          placeholder="Optional UUID"
          type="text"
          value={formData.courseworkId}
        />

        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "studyBlockId")}
          id="study-session-block-id"
          label="Study Block ID"
          name="studyBlockId"
          onChange={onChange}
          placeholder="Optional UUID"
          type="text"
          value={formData.studyBlockId}
        />

        <TextArea
          error={getErrorForField(fieldErrors, "notes")}
          id="study-session-notes"
          label="Notes"
          name="notes"
          onChange={onChange}
          placeholder="What did you work on?"
          value={formData.notes}
        />

        <ErrorPanel fieldErrors={fieldErrors} formError={formError} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
            disabled={isSaving}
            type="submit"
          >
            {isSaving
              ? "Saving..."
              : editingStudySessionId
                ? "Update Session"
                : "Log Session"}
          </button>
          {editingStudySessionId ? (
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

function ProgressSummary({ isLoading, progress }) {
  if (isLoading && !progress) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
        Loading progress.
      </section>
    );
  }

  if (!progress) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500 shadow-sm">
        No progress summary loaded.
      </section>
    );
  }

  const { estimateAccuracy, range, studyTime, taskCounts } = progress;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Summary
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            {formatDate(range.from)} - {formatDate(range.to)}
          </h3>
        </div>
        <AccuracyBadge label={estimateAccuracy.label} />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Completed" value={taskCounts.completed} />
        <SummaryStat label="Missed" value={taskCounts.missed} />
        <SummaryStat label="Postponed" value={taskCounts.postponed} />
        <SummaryStat label="Open" value={taskCounts.open} />
        <SummaryStat label="Due" value={taskCounts.totalDue} />
        <SummaryStat
          label="Study Time"
          value={formatMinutes(studyTime.totalMinutes)}
        />
        <SummaryStat label="Sessions" value={studyTime.sessionCount} />
        <SummaryStat
          label="Avg Session"
          value={formatMinutes(studyTime.averageSessionMinutes)}
        />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <SummaryStat
          label="Compared"
          value={estimateAccuracy.comparedCourseworkCount}
        />
        <SummaryStat
          label="Estimated Avg"
          value={formatMinutes(estimateAccuracy.averageEstimatedMinutes)}
        />
        <SummaryStat
          label="Actual Avg"
          value={formatMinutes(estimateAccuracy.averageActualMinutes)}
        />
      </div>
    </section>
  );
}

function StudySessionCard({
  deletingStudySessionId,
  onDelete,
  onEdit,
  studySession,
}) {
  const isDeleting = deletingStudySessionId === studySession.id;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <SourceBadge source={studySession.source} />
            <span className="inline-flex min-h-7 items-center rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-700">
              {formatMinutes(studySession.durationMinutes)}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {getRelatedLabel(studySession)}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {formatDateTime(studySession.startedAt ?? studySession.createdAt)}
            {studySession.endedAt
              ? " - " + formatDateTime(studySession.endedAt)
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={isDeleting}
            onClick={() => onEdit(studySession)}
            type="button"
          >
            Edit
          </button>
          <button
            className="h-9 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={isDeleting}
            onClick={() => onDelete(studySession)}
            type="button"
          >
            {isDeleting ? "Deleting" : "Delete"}
          </button>
        </div>
      </div>

      {studySession.notes ? (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          {studySession.notes}
        </p>
      ) : null}
    </article>
  );
}

function StudySessionList({
  deletingStudySessionId,
  isLoading,
  onDelete,
  onEdit,
  sessions,
  statusMessage,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Sessions
          </p>
          <h3 className="mt-1 text-xl font-semibold">Recent Study Time</h3>
        </div>
        <SummaryStat label="Visible" value={sessions.length} />
      </div>

      <div className="mt-5 grid gap-4">
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
            Loading sessions.
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No study sessions found.
          </div>
        ) : (
          <div className="grid gap-3">
            {sessions.map((studySession) => (
              <StudySessionCard
                deletingStudySessionId={deletingStudySessionId}
                key={studySession.id}
                onDelete={onDelete}
                onEdit={onEdit}
                studySession={studySession}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ProgressManagement({ authToken, onAuthExpired }) {
  const [filters, setFilters] = useState(() => ({
    ...getCurrentWeekRange(),
    courseworkId: "",
    source: "all",
  }));
  const [progress, setProgress] = useState(null);
  const [studySessions, setStudySessions] = useState([]);
  const [sessionFormData, setSessionFormData] = useState(
    getInitialSessionFormData,
  );
  const [editingStudySessionId, setEditingStudySessionId] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [listFormError, setListFormError] = useState("");
  const [listFieldErrors, setListFieldErrors] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingStudySessionId, setDeletingStudySessionId] = useState("");

  const activeFilters = useMemo(
    () => ({
      from: filters.from,
      to: filters.to,
      courseworkId: filters.courseworkId.trim(),
      source: filters.source,
      limit: 25,
    }),
    [filters],
  );

  async function loadProgress(
    nextFilters = activeFilters,
    { silent = false } = {},
  ) {
    if (!authToken) {
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }

    try {
      const [summaryData, sessionsData] = await Promise.all([
        getProgressSummary(authToken, nextFilters),
        listStudySessions(authToken, nextFilters),
      ]);
      setProgress(summaryData.progress);
      setStudySessions(sessionsData.studySessions);
      setListFormError("");
      setListFieldErrors([]);
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setListFormError(error.message);
      setListFieldErrors(error.details ?? []);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialProgress() {
      if (!authToken) {
        return;
      }

      setIsLoading(true);
      setListFormError("");
      setListFieldErrors([]);

      try {
        const [summaryData, sessionsData] = await Promise.all([
          getProgressSummary(authToken, activeFilters),
          listStudySessions(authToken, activeFilters),
        ]);

        if (!isCurrent) {
          return;
        }

        setProgress(summaryData.progress);
        setStudySessions(sessionsData.studySessions);
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        if (error.statusCode === 401) {
          onAuthExpired();
          return;
        }

        setListFormError(error.message);
        setListFieldErrors(error.details ?? []);
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadInitialProgress();

    return () => {
      isCurrent = false;
    };
  }, [activeFilters, authToken, onAuthExpired]);

  function resetSessionForm() {
    setSessionFormData(getInitialSessionFormData());
    setEditingStudySessionId("");
    setFormError("");
    setFieldErrors([]);
  }

  function clearListMessages() {
    setStatusMessage("");
    setListFormError("");
    setListFieldErrors([]);
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
    clearListMessages();
  }

  function handleResetWeek() {
    setFilters({
      ...getCurrentWeekRange(),
      courseworkId: "",
      source: "all",
    });
    clearListMessages();
  }

  function handleSessionFormChange(event) {
    const { name, value } = event.target;

    setSessionFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function getSessionPayload() {
    return {
      courseworkId: sessionFormData.courseworkId,
      studyBlockId: sessionFormData.studyBlockId,
      source: sessionFormData.source,
      startedAt: toApiDateTime(sessionFormData.startedAt),
      endedAt: toApiDateTime(sessionFormData.endedAt),
      durationMinutes: sessionFormData.durationMinutes,
      notes: sessionFormData.notes,
    };
  }

  async function handleSessionSubmit(event) {
    event.preventDefault();

    if (!authToken) {
      onAuthExpired();
      return;
    }

    setIsSaving(true);
    setFormError("");
    setFieldErrors([]);
    clearListMessages();

    try {
      if (editingStudySessionId) {
        await updateStudySession(
          authToken,
          editingStudySessionId,
          getSessionPayload(),
        );
        setStatusMessage("Study session updated.");
        resetSessionForm();
        await loadProgress(activeFilters, { silent: true });
        return;
      }

      await createStudySession(authToken, getSessionPayload());
      setStatusMessage("Study session logged.");
      resetSessionForm();
      await loadProgress(activeFilters, { silent: true });
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

  function handleEditStudySession(studySession) {
    setEditingStudySessionId(studySession.id);
    setSessionFormData({
      courseworkId: studySession.courseworkId ?? "",
      studyBlockId: studySession.studyBlockId ?? "",
      source: studySession.source,
      startedAt: formatDateTimeForInput(studySession.startedAt),
      endedAt: formatDateTimeForInput(studySession.endedAt),
      durationMinutes: String(studySession.durationMinutes),
      notes: studySession.notes ?? "",
    });
    setFormError("");
    setFieldErrors([]);
    setStatusMessage("");
  }

  async function handleDeleteStudySession(studySession) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    const confirmed = window.confirm("Delete this study session?");

    if (!confirmed) {
      return;
    }

    setDeletingStudySessionId(studySession.id);
    clearListMessages();

    try {
      await deleteStudySession(authToken, studySession.id);
      setStatusMessage("Study session deleted.");

      if (editingStudySessionId === studySession.id) {
        resetSessionForm();
      }

      await loadProgress(activeFilters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setListFormError(error.message);
      setListFieldErrors(error.details ?? []);
    } finally {
      setDeletingStudySessionId("");
    }
  }

  async function handleRefresh() {
    clearListMessages();
    await loadProgress(activeFilters);
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <ProgressFilters
          filters={filters}
          isLoading={isLoading}
          onChange={handleFilterChange}
          onRefresh={handleRefresh}
          onResetWeek={handleResetWeek}
        />
        <StudySessionForm
          editingStudySessionId={editingStudySessionId}
          fieldErrors={fieldErrors}
          formData={sessionFormData}
          formError={formError}
          isSaving={isSaving}
          onCancelEdit={resetSessionForm}
          onChange={handleSessionFormChange}
          onSubmit={handleSessionSubmit}
        />
      </div>

      <div className="grid content-start gap-4">
        <ErrorPanel fieldErrors={listFieldErrors} formError={listFormError} />
        <ProgressSummary isLoading={isLoading} progress={progress} />
        <StudySessionList
          deletingStudySessionId={deletingStudySessionId}
          isLoading={isLoading}
          onDelete={handleDeleteStudySession}
          onEdit={handleEditStudySession}
          sessions={studySessions}
          statusMessage={statusMessage}
        />
      </div>
    </div>
  );
}
