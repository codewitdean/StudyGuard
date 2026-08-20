import { useEffect, useMemo, useState } from "react";
import {
  approveRecommendation,
  createRecommendation,
  deleteRecommendation,
  editRecommendation,
  listRecommendations,
  rejectRecommendation,
} from "../api/recommendationApi.js";

const recommendationTypeOptions = [
  { label: "Move Block", value: "move_block" },
  { label: "Split Task", value: "split_task" },
  { label: "Start Earlier", value: "start_earlier" },
  { label: "Add Break", value: "add_break" },
  { label: "Reestimate Effort", value: "reestimate_effort" },
  { label: "Seek Support", value: "seek_support" },
  { label: "Postpone Lower Priority", value: "postpone_lower_priority" },
];

const statusFilterOptions = [
  { label: "Needs Review", value: "review" },
  { label: "Pending", value: "pending" },
  { label: "Edited", value: "edited" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" },
];

const statusStyles = {
  pending: "bg-amber-50 text-amber-800",
  edited: "bg-blue-50 text-blue-800",
  approved: "bg-emerald-50 text-emerald-800",
  rejected: "bg-slate-100 text-slate-700",
};

const typeStyles = {
  move_block: "bg-indigo-50 text-indigo-800",
  split_task: "bg-purple-50 text-purple-800",
  start_earlier: "bg-cyan-50 text-cyan-800",
  add_break: "bg-teal-50 text-teal-800",
  reestimate_effort: "bg-orange-50 text-orange-800",
  seek_support: "bg-rose-50 text-rose-800",
  postpone_lower_priority: "bg-slate-100 text-slate-700",
};

const initialFilters = {
  status: "review",
  type: "all",
};

const initialDraftFormData = {
  type: "move_block",
  title: "",
  reason: "",
  proposedChangeText: formatJson(getDefaultChangeForType("move_block")),
};

function getDefaultChangeForType(type) {
  const defaults = {
    move_block: {
      action: "move_block",
      startAt: "",
      endAt: "",
    },
    split_task: {
      action: "split_task",
      blocks: [],
    },
    start_earlier: {
      action: "start_earlier",
    },
    add_break: {
      action: "add_break",
    },
    reestimate_effort: {
      action: "reestimate_effort",
      estimatedMinutes: 60,
    },
    seek_support: {
      action: "seek_support",
    },
    postpone_lower_priority: {
      action: "postpone_lower_priority",
    },
  };

  return defaults[type] ?? { action: type };
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

function formatJson(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonObject(value, fieldLabel) {
  let parsedValue;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error(fieldLabel + " must be valid JSON.");
  }

  if (
    !parsedValue ||
    typeof parsedValue !== "object" ||
    Array.isArray(parsedValue)
  ) {
    throw new Error(fieldLabel + " must be a JSON object.");
  }

  return parsedValue;
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

function getRecommendationDate(recommendation) {
  return recommendation.decidedAt ?? recommendation.updatedAt;
}

function isTerminalRecommendation(recommendation) {
  return ["approved", "rejected"].includes(recommendation.status);
}

function getRelatedLabel(recommendation) {
  if (recommendation.coursework) {
    const courseLabel = recommendation.coursework.course
      ? [
          recommendation.coursework.course.code,
          recommendation.coursework.course.name,
        ]
          .filter(Boolean)
          .join(" - ")
      : "No course";

    return recommendation.coursework.title + " · " + courseLabel;
  }

  if (recommendation.studyBlock) {
    return "Study block · " + formatDateTime(recommendation.studyBlock.startAt);
  }

  return "General";
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
        className="min-h-24 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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

function StatusBadge({ status }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (statusStyles[status] ?? "bg-slate-100 text-slate-700")
      }
    >
      {formatOptionLabel(status)}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span
      className={
        "inline-flex min-h-7 items-center rounded-md px-2 text-xs font-semibold " +
        (typeStyles[type] ?? "bg-slate-100 text-slate-700")
      }
    >
      {formatOptionLabel(type)}
    </span>
  );
}

function DraftRecommendationForm({
  fieldErrors,
  formData,
  formError,
  isSaving,
  onChange,
  onReset,
  onSubmit,
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">Draft</p>
        <h3 className="mt-1 text-xl font-semibold">New Recommendation</h3>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <SelectInput
          error={getErrorForField(fieldErrors, "type")}
          id="recommendation-type"
          label="Type"
          name="type"
          onChange={onChange}
          value={formData.type}
        >
          {recommendationTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>

        <TextInput
          autoComplete="off"
          error={getErrorForField(fieldErrors, "title")}
          id="recommendation-title"
          label="Title"
          maxLength={200}
          name="title"
          onChange={onChange}
          placeholder="Move biology review earlier"
          required
          type="text"
          value={formData.title}
        />

        <TextArea
          error={getErrorForField(fieldErrors, "reason")}
          id="recommendation-reason"
          label="Reason"
          maxLength={1000}
          name="reason"
          onChange={onChange}
          placeholder="This block is close to the deadline."
          required
          value={formData.reason}
        />

        <TextArea
          error={getErrorForField(fieldErrors, "proposedChange")}
          id="recommendation-proposed-change"
          label="Proposed Change"
          name="proposedChangeText"
          onChange={onChange}
          rows={8}
          value={formData.proposedChangeText}
        />

        <ErrorPanel fieldErrors={fieldErrors} formError={formError} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Create Draft"}
          </button>
          <button
            className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-28"
            disabled={isSaving}
            onClick={onReset}
            type="button"
          >
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}

function RecommendationFilters({ filters, isLoading, onChange, onRefresh }) {
  return (
    <div className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,220px))_auto] md:items-end">
      <SelectInput
        id="recommendation-filter-status"
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
        id="recommendation-filter-type"
        label="Type"
        name="type"
        onChange={onChange}
        value={filters.type}
      >
        <option value="all">All Types</option>
        {recommendationTypeOptions.map((option) => (
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

function ChangePreview({ label, value }) {
  if (!value) {
    return null;
  }

  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
        {formatJson(value)}
      </pre>
    </div>
  );
}

function RecommendationCard({
  deletingRecommendationId,
  isUpdating,
  onApprove,
  onDelete,
  onReject,
  onStartEdit,
  recommendation,
}) {
  const isTerminal = isTerminalRecommendation(recommendation);
  const isBusy = isUpdating || deletingRecommendationId === recommendation.id;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <TypeBadge type={recommendation.type} />
            <StatusBadge status={recommendation.status} />
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {recommendation.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {recommendation.reason}
          </p>
        </div>
        <p className="text-sm font-medium text-slate-500">
          {formatDateTime(getRecommendationDate(recommendation))}
        </p>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Related
          </p>
          <p className="mt-1 font-medium text-slate-800">
            {getRelatedLabel(recommendation)}
          </p>
        </div>
        {recommendation.studyBlock ? (
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Block
            </p>
            <p className="mt-1 font-medium text-slate-800">
              {formatDateTime(recommendation.studyBlock.startAt)} -{" "}
              {formatDateTime(recommendation.studyBlock.endAt)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <ChangePreview label="Proposed" value={recommendation.proposedChange} />
        <ChangePreview label="Edited" value={recommendation.editedChange} />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {!isTerminal ? (
          <>
            <button
              className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              disabled={isBusy}
              onClick={() => onStartEdit(recommendation)}
              type="button"
            >
              Edit
            </button>
            <button
              className="h-9 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              disabled={isBusy}
              onClick={() => onReject(recommendation)}
              type="button"
            >
              Reject
            </button>
            <button
              className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isBusy}
              onClick={() => onApprove(recommendation)}
              type="button"
            >
              Approve
            </button>
          </>
        ) : null}
        <button
          className="h-9 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={isBusy}
          onClick={() => onDelete(recommendation)}
          type="button"
        >
          {deletingRecommendationId === recommendation.id
            ? "Deleting"
            : "Delete"}
        </button>
      </div>
    </article>
  );
}

function RecommendationList({
  deletingRecommendationId,
  filters,
  isLoading,
  isUpdating,
  onApprove,
  onDelete,
  onFilterChange,
  onRefresh,
  onReject,
  onStartEdit,
  recommendations,
  statusMessage,
}) {
  const pendingCount = recommendations.filter(
    (recommendation) => recommendation.status === "pending",
  ).length;
  const editedCount = recommendations.filter(
    (recommendation) => recommendation.status === "edited",
  ).length;
  const decidedCount = recommendations.filter((recommendation) =>
    ["approved", "rejected"].includes(recommendation.status),
  ).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Recommendations
          </p>
          <h3 className="mt-1 text-xl font-semibold">Review Queue</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <SummaryStat label="Visible" value={recommendations.length} />
          <SummaryStat label="Pending" value={pendingCount} />
          <SummaryStat label="Edited" value={editedCount} />
          <SummaryStat label="Decided" value={decidedCount} />
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <RecommendationFilters
          filters={filters}
          isLoading={isLoading}
          onChange={onFilterChange}
          onRefresh={onRefresh}
        />

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
            Loading recommendations.
          </div>
        ) : recommendations.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No recommendations found.
          </div>
        ) : (
          <div className="grid gap-3">
            {recommendations.map((recommendation) => (
              <RecommendationCard
                deletingRecommendationId={deletingRecommendationId}
                isUpdating={isUpdating}
                key={recommendation.id}
                onApprove={onApprove}
                onDelete={onDelete}
                onReject={onReject}
                onStartEdit={onStartEdit}
                recommendation={recommendation}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EditRecommendationPanel({
  editingRecommendation,
  editText,
  fieldErrors,
  formError,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}) {
  if (!editingRecommendation) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
        Select a recommendation to edit.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase text-emerald-700">Edit</p>
        <h3 className="mt-1 text-xl font-semibold">
          {editingRecommendation.title}
        </h3>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
        <TextArea
          error={getErrorForField(fieldErrors, "editedChange")}
          id="recommendation-edited-change"
          label="Edited Change"
          name="editedChangeText"
          onChange={onChange}
          rows={10}
          value={editText}
        />

        <ErrorPanel fieldErrors={fieldErrors} formError={formError} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save Edit"}
          </button>
          <button
            className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-28"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export default function RecommendationManagement({ authToken, onAuthExpired }) {
  const [recommendations, setRecommendations] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [draftFormData, setDraftFormData] = useState(initialDraftFormData);
  const [editingRecommendation, setEditingRecommendation] = useState(null);
  const [editText, setEditText] = useState("");
  const [draftFieldErrors, setDraftFieldErrors] = useState([]);
  const [draftFormError, setDraftFormError] = useState("");
  const [editFieldErrors, setEditFieldErrors] = useState([]);
  const [editFormError, setEditFormError] = useState("");
  const [listFieldErrors, setListFieldErrors] = useState([]);
  const [listFormError, setListFormError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingDecision, setIsUpdatingDecision] = useState(false);
  const [deletingRecommendationId, setDeletingRecommendationId] = useState("");

  const visibleError = useMemo(() => {
    if (!listFormError) {
      return null;
    }

    return {
      message: listFormError,
      details: listFieldErrors,
    };
  }, [listFieldErrors, listFormError]);

  async function loadRecommendations(
    activeFilters = filters,
    { silent = false } = {},
  ) {
    if (!authToken) {
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }

    try {
      const data = await listRecommendations(authToken, activeFilters);
      setRecommendations(data.recommendations);
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

    async function loadInitialRecommendations() {
      if (!authToken) {
        return;
      }

      setIsLoading(true);
      setListFormError("");
      setListFieldErrors([]);

      try {
        const data = await listRecommendations(authToken, filters);

        if (!isCurrent) {
          return;
        }

        setRecommendations(data.recommendations);
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

    loadInitialRecommendations();

    return () => {
      isCurrent = false;
    };
  }, [authToken, filters, onAuthExpired]);

  function resetDraftForm() {
    setDraftFormData(initialDraftFormData);
    setDraftFieldErrors([]);
    setDraftFormError("");
  }

  function clearListMessages() {
    setStatusMessage("");
    setListFormError("");
    setListFieldErrors([]);
  }

  function handleDraftChange(event) {
    const { name, value } = event.target;

    if (name === "type") {
      setDraftFormData((currentFormData) => ({
        ...currentFormData,
        type: value,
        proposedChangeText: formatJson(getDefaultChangeForType(value)),
      }));
      return;
    }

    setDraftFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
    clearListMessages();
  }

  function handleStartEdit(recommendation) {
    setEditingRecommendation(recommendation);
    setEditText(
      formatJson(recommendation.editedChange ?? recommendation.proposedChange),
    );
    setEditFieldErrors([]);
    setEditFormError("");
    setStatusMessage("");
  }

  function handleCancelEdit() {
    setEditingRecommendation(null);
    setEditText("");
    setEditFieldErrors([]);
    setEditFormError("");
  }

  async function handleDraftSubmit(event) {
    event.preventDefault();

    if (!authToken) {
      onAuthExpired();
      return;
    }

    setIsCreating(true);
    setDraftFormError("");
    setDraftFieldErrors([]);
    clearListMessages();

    try {
      const proposedChange = parseJsonObject(
        draftFormData.proposedChangeText,
        "Proposed change",
      );

      await createRecommendation(authToken, {
        type: draftFormData.type,
        title: draftFormData.title,
        reason: draftFormData.reason,
        proposedChange,
      });

      setStatusMessage("Recommendation created.");
      resetDraftForm();

      if (JSON.stringify(filters) !== JSON.stringify(initialFilters)) {
        setFilters(initialFilters);
      } else {
        await loadRecommendations(initialFilters, { silent: true });
      }
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setDraftFormError(error.message);
      setDraftFieldErrors(error.details ?? []);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();

    if (!authToken) {
      onAuthExpired();
      return;
    }

    if (!editingRecommendation) {
      return;
    }

    setIsEditing(true);
    setEditFormError("");
    setEditFieldErrors([]);
    clearListMessages();

    try {
      const editedChange = parseJsonObject(editText, "Edited change");
      await editRecommendation(
        authToken,
        editingRecommendation.id,
        editedChange,
      );
      setStatusMessage("Recommendation edited.");
      handleCancelEdit();
      await loadRecommendations(filters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setEditFormError(error.message);
      setEditFieldErrors(error.details ?? []);
    } finally {
      setIsEditing(false);
    }
  }

  async function handleApproveRecommendation(recommendation) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    setIsUpdatingDecision(true);
    clearListMessages();

    try {
      await approveRecommendation(authToken, recommendation.id);
      setStatusMessage("Recommendation approved.");
      if (editingRecommendation?.id === recommendation.id) {
        handleCancelEdit();
      }
      await loadRecommendations(filters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setListFormError(error.message);
      setListFieldErrors(error.details ?? []);
    } finally {
      setIsUpdatingDecision(false);
    }
  }

  async function handleRejectRecommendation(recommendation) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    setIsUpdatingDecision(true);
    clearListMessages();

    try {
      await rejectRecommendation(authToken, recommendation.id);
      setStatusMessage("Recommendation rejected.");
      if (editingRecommendation?.id === recommendation.id) {
        handleCancelEdit();
      }
      await loadRecommendations(filters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setListFormError(error.message);
      setListFieldErrors(error.details ?? []);
    } finally {
      setIsUpdatingDecision(false);
    }
  }

  async function handleDeleteRecommendation(recommendation) {
    if (!authToken) {
      onAuthExpired();
      return;
    }

    const confirmed = window.confirm("Delete " + recommendation.title + "?");

    if (!confirmed) {
      return;
    }

    setDeletingRecommendationId(recommendation.id);
    clearListMessages();

    try {
      await deleteRecommendation(authToken, recommendation.id);
      setStatusMessage("Recommendation deleted.");
      if (editingRecommendation?.id === recommendation.id) {
        handleCancelEdit();
      }
      await loadRecommendations(filters, { silent: true });
    } catch (error) {
      if (error.statusCode === 401) {
        onAuthExpired();
        return;
      }

      setListFormError(error.message);
      setListFieldErrors(error.details ?? []);
    } finally {
      setDeletingRecommendationId("");
    }
  }

  async function handleRefresh() {
    clearListMessages();
    await loadRecommendations(filters);
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <DraftRecommendationForm
          fieldErrors={draftFieldErrors}
          formData={draftFormData}
          formError={draftFormError}
          isSaving={isCreating}
          onChange={handleDraftChange}
          onReset={resetDraftForm}
          onSubmit={handleDraftSubmit}
        />
        <EditRecommendationPanel
          editingRecommendation={editingRecommendation}
          editText={editText}
          fieldErrors={editFieldErrors}
          formError={editFormError}
          isSaving={isEditing}
          onCancel={handleCancelEdit}
          onChange={(event) => setEditText(event.target.value)}
          onSubmit={handleEditSubmit}
        />
      </div>

      <div className="grid content-start gap-4">
        {visibleError ? (
          <ErrorPanel
            fieldErrors={visibleError.details}
            formError={visibleError.message}
          />
        ) : null}
        <RecommendationList
          deletingRecommendationId={deletingRecommendationId}
          filters={filters}
          isLoading={isLoading}
          isUpdating={isUpdatingDecision}
          onApprove={handleApproveRecommendation}
          onDelete={handleDeleteRecommendation}
          onFilterChange={handleFilterChange}
          onRefresh={handleRefresh}
          onReject={handleRejectRecommendation}
          onStartEdit={handleStartEdit}
          recommendations={recommendations}
          statusMessage={statusMessage}
        />
      </div>
    </div>
  );
}
