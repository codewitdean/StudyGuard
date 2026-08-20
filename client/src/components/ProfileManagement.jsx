import { useEffect, useState } from "react";
import { updateCurrentStudent } from "../api/authApi.js";

const planningPriorityOptions = [
  { label: "Meet Deadlines", value: "meet_deadlines" },
  { label: "Prevent Burnout", value: "prevent_burnout" },
  {
    label: "Balance Deadlines + Wellbeing",
    value: "balance_deadlines_wellbeing",
  },
  { label: "Custom", value: "custom" },
];

function getInitialProfileFormData(currentUser) {
  return {
    name: currentUser.name ?? "",
    planningPriority:
      currentUser.planningPriority ?? "balance_deadlines_wellbeing",
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
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
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
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500"
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

function SummaryRow({ label, value }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}

export default function ProfileManagement({
  authToken,
  currentUser,
  onAuthExpired,
  onProfileUpdated,
}) {
  const [fieldErrors, setFieldErrors] = useState([]);
  const [formData, setFormData] = useState(() =>
    getInitialProfileFormData(currentUser),
  );
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    setFormData(getInitialProfileFormData(currentUser));
    setFieldErrors([]);
    setFormError("");
  }, [currentUser.id, currentUser.name, currentUser.planningPriority]);

  const trimmedName = formData.name.trim();
  const hasFormChanges =
    formData.name !== currentUser.name ||
    formData.planningPriority !== currentUser.planningPriority;
  const hasProfileChanges =
    trimmedName !== currentUser.name ||
    formData.planningPriority !== currentUser.planningPriority;

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleReset() {
    setFormData(getInitialProfileFormData(currentUser));
    setFieldErrors([]);
    setFormError("");
    setStatusMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setFieldErrors([]);
    setFormError("");
    setStatusMessage("");

    if (!hasProfileChanges) {
      setFormData(getInitialProfileFormData(currentUser));
      setStatusMessage("Profile is already up to date.");
      return;
    }

    const payload = {};

    if (trimmedName !== currentUser.name) {
      payload.name = trimmedName;
    }

    if (formData.planningPriority !== currentUser.planningPriority) {
      payload.planningPriority = formData.planningPriority;
    }

    setIsSaving(true);

    try {
      const data = await updateCurrentStudent(authToken, payload);
      onProfileUpdated(data.user);
      setStatusMessage("Profile updated.");
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

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Profile
          </p>
          <h3 className="mt-1 text-xl font-semibold">Preferences</h3>
        </div>

        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <TextInput
            autoComplete="name"
            error={getErrorForField(fieldErrors, "name")}
            id="profile-name"
            label="Name"
            maxLength={120}
            name="name"
            onChange={handleChange}
            required
            type="text"
            value={formData.name}
          />

          <TextInput
            disabled
            id="profile-email"
            label="Email"
            type="email"
            value={currentUser.email}
          />

          <SelectInput
            error={getErrorForField(fieldErrors, "planningPriority")}
            id="profile-planning-priority"
            label="Planning Priority"
            name="planningPriority"
            onChange={handleChange}
            value={formData.planningPriority}
          >
            {planningPriorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>

          <ErrorPanel fieldErrors={fieldErrors} formError={formError} />

          {statusMessage ? (
            <div
              aria-live="polite"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              {statusMessage}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:flex-1"
              disabled={isSaving || !hasFormChanges}
              type="submit"
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
            <button
              className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:w-28"
              disabled={isSaving || !hasFormChanges}
              onClick={handleReset}
              type="button"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Account
          </p>
          <h3 className="mt-1 text-xl font-semibold">Current Details</h3>
        </div>

        <div className="mt-5">
          <SummaryRow label="Name" value={currentUser.name} />
          <SummaryRow label="Email" value={currentUser.email} />
          <SummaryRow
            label="Planning Priority"
            value={formatOptionLabel(currentUser.planningPriority)}
          />
          <SummaryRow
            label="Created"
            value={formatDateTime(currentUser.createdAt)}
          />
          <SummaryRow
            label="Updated"
            value={formatDateTime(currentUser.updatedAt)}
          />
        </div>
      </section>
    </div>
  );
}
