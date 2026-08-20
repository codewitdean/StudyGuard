import { useEffect, useState } from "react";
import {
  getCurrentStudent,
  loginStudent,
  registerStudent,
} from "./api/authApi.js";
import AvailabilityManagement from "./components/AvailabilityManagement.jsx";
import CourseManagement from "./components/CourseManagement.jsx";
import CourseworkManagement from "./components/CourseworkManagement.jsx";
import DashboardView, {
  getDashboardWorkloadStatusClassName,
  getDashboardWorkloadStatusLabel,
} from "./components/Dashboard.jsx";
import ProfileManagement from "./components/ProfileManagement.jsx";
import ProgressManagement from "./components/ProgressManagement.jsx";
import RecommendationManagement from "./components/RecommendationManagement.jsx";
import StudyPlanManagement from "./components/StudyPlanManagement.jsx";
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  storeAuthToken,
} from "./utils/authStorage.js";

const navItems = [
  "Dashboard",
  "Courses",
  "Coursework",
  "Availability",
  "Study Plan",
  "Recommendations",
  "Progress",
  "Profile",
];

const implementedNavItems = [
  "Dashboard",
  "Courses",
  "Coursework",
  "Availability",
  "Study Plan",
  "Recommendations",
  "Progress",
  "Profile",
];

const previewStats = [
  { label: "Courses", value: "0" },
  { label: "Open tasks", value: "0" },
  { label: "Study blocks", value: "0" },
];

const initialFormData = {
  name: "",
  email: "",
  password: "",
};

function getInitials(name) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "SG";
}

function getViewTitle(activeView, firstName) {
  if (activeView === "Dashboard") {
    return "Welcome back, " + firstName;
  }

  if (activeView === "Courses") {
    return "Manage Courses";
  }

  if (activeView === "Coursework") {
    return "Manage Coursework";
  }

  if (activeView === "Availability") {
    return "Manage Availability";
  }

  if (activeView === "Study Plan") {
    return "Generate Study Plan";
  }

  if (activeView === "Recommendations") {
    return "Review Recommendations";
  }

  if (activeView === "Progress") {
    return "Track Progress";
  }

  if (activeView === "Profile") {
    return "Profile Preferences";
  }

  return activeView;
}

function formatFieldName(field) {
  return field.replace("body.", "");
}

function AuthModeButton({ active, children, onClick }) {
  return (
    <button
      className={
        "h-10 rounded-md px-3 text-sm font-semibold transition " +
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

function TextInput({ id, label, ...props }) {
  return (
    <label
      className="grid gap-2 text-sm font-medium text-slate-700"
      htmlFor={id}
    >
      <span>{label}</span>
      <input
        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        id={id}
        {...props}
      />
    </label>
  );
}

function AuthPanel({
  authMode,
  fieldErrors,
  formData,
  formError,
  isSubmitting,
  onChange,
  onModeChange,
  onSubmit,
  statusMessage,
}) {
  const isRegistering = authMode === "register";

  return (
    <section className="self-center rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        <AuthModeButton
          active={authMode === "login"}
          onClick={() => onModeChange("login")}
        >
          Log In
        </AuthModeButton>
        <AuthModeButton
          active={authMode === "register"}
          onClick={() => onModeChange("register")}
        >
          Register
        </AuthModeButton>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        {isRegistering ? (
          <TextInput
            autoComplete="name"
            id="name"
            label="Name"
            name="name"
            onChange={onChange}
            placeholder="Maya Chen"
            required
            type="text"
            value={formData.name}
          />
        ) : null}

        <TextInput
          autoComplete="email"
          id="email"
          label="Email"
          name="email"
          onChange={onChange}
          placeholder="maya@example.com"
          required
          type="email"
          value={formData.email}
        />

        <TextInput
          autoComplete={isRegistering ? "new-password" : "current-password"}
          id="password"
          label="Password"
          minLength={isRegistering ? 8 : 1}
          name="password"
          onChange={onChange}
          placeholder="correct-password"
          required
          type="password"
          value={formData.password}
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

        {statusMessage ? (
          <div
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {statusMessage}
          </div>
        ) : null}

        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? "Working..."
            : isRegistering
              ? "Create Account"
              : "Log In"}
        </button>
      </form>
    </section>
  );
}

function SignedOutScreen(props) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <section className="flex flex-col justify-center gap-8 py-8">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-700">
              Private Student Workspace
            </p>
            <h1 className="mt-2 text-4xl font-semibold">StudyGuard</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
              Track academic work from an account that belongs only to the
              signed-in student.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {previewStats.map((item) => (
              <div
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                key={item.label}
              >
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold">Session Status</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {props.isChecking ? "Checking saved session." : "Signed out."}
                </p>
              </div>
              <span className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
                {props.isChecking ? "Checking" : "Ready"}
              </span>
            </div>
          </div>
        </section>

        <AuthPanel {...props} />
      </div>
    </main>
  );
}

function SignedInScreen({
  activeView,
  authToken,
  currentUser,
  isChecking,
  onAuthExpired,
  onProfileUpdated,
  onRefreshCurrentUser,
  onSignOut,
  onViewChange,
  statusMessage,
}) {
  const firstName = currentUser.name.split(" ")[0];
  const [dashboardWorkloadStatus, setDashboardWorkloadStatus] =
    useState("unknown");

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row lg:px-8">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:w-64">
          <h1 className="text-xl font-semibold">StudyGuard</h1>

          <div className="mt-5 border-y border-slate-200 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-emerald-700 text-sm font-bold text-white">
                {getInitials(currentUser.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {currentUser.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {currentUser.email}
                </p>
              </div>
            </div>
          </div>

          <nav className="mt-5 grid gap-1" aria-label="Primary navigation">
            {navItems.map((item) => {
              const isImplemented = implementedNavItems.includes(item);
              const isActive = activeView === item;

              return (
                <button
                  className={
                    "rounded-md px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:text-slate-300 " +
                    (isActive
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950")
                  }
                  disabled={!isImplemented}
                  key={item}
                  onClick={() => onViewChange(item)}
                  type="button"
                >
                  {item}
                </button>
              );
            })}
          </nav>

          <button
            className="mt-5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            onClick={onSignOut}
            type="button"
          >
            Sign Out
          </button>
        </aside>

        <section className="flex-1">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-emerald-700">
                {activeView}
              </p>
              <h2 className="mt-1 text-3xl font-semibold">
                {getViewTitle(activeView, firstName)}
              </h2>
            </div>
            <div
              className={getDashboardWorkloadStatusClassName(
                dashboardWorkloadStatus,
              )}
            >
              {getDashboardWorkloadStatusLabel(dashboardWorkloadStatus)}
            </div>
          </div>

          {activeView === "Courses" ? (
            <CourseManagement
              authToken={authToken}
              onAuthExpired={onAuthExpired}
            />
          ) : activeView === "Coursework" ? (
            <CourseworkManagement
              authToken={authToken}
              onAuthExpired={onAuthExpired}
            />
          ) : activeView === "Availability" ? (
            <AvailabilityManagement
              authToken={authToken}
              onAuthExpired={onAuthExpired}
            />
          ) : activeView === "Study Plan" ? (
            <StudyPlanManagement
              authToken={authToken}
              onAuthExpired={onAuthExpired}
            />
          ) : activeView === "Recommendations" ? (
            <RecommendationManagement
              authToken={authToken}
              onAuthExpired={onAuthExpired}
            />
          ) : activeView === "Progress" ? (
            <ProgressManagement
              authToken={authToken}
              onAuthExpired={onAuthExpired}
            />
          ) : activeView === "Profile" ? (
            <ProfileManagement
              authToken={authToken}
              currentUser={currentUser}
              onAuthExpired={onAuthExpired}
              onProfileUpdated={onProfileUpdated}
            />
          ) : (
            <DashboardView
              authToken={authToken}
              currentUser={currentUser}
              isChecking={isChecking}
              onAuthExpired={onAuthExpired}
              onRefreshCurrentUser={onRefreshCurrentUser}
              onViewChange={onViewChange}
              onWorkloadStatusChange={setDashboardWorkloadStatus}
              statusMessage={statusMessage}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function App() {
  const [activeView, setActiveView] = useState("Dashboard");
  const [authMode, setAuthMode] = useState("login");
  const [authToken, setAuthToken] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [fieldErrors, setFieldErrors] = useState([]);
  const [formData, setFormData] = useState(initialFormData);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionStatus, setSessionStatus] = useState("checking");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const storedToken = getStoredAuthToken();

    if (!storedToken) {
      setSessionStatus("signedOut");
      return;
    }

    let isCurrent = true;

    async function restoreSession() {
      try {
        const data = await getCurrentStudent(storedToken);

        if (!isCurrent) {
          return;
        }

        setAuthToken(storedToken);
        setCurrentUser(data.user);
        setSessionStatus("signedIn");
      } catch {
        clearStoredAuthToken();

        if (!isCurrent) {
          return;
        }

        setAuthToken("");
        setCurrentUser(null);
        setSessionStatus("signedOut");
        setStatusMessage("Session expired. Please log in again.");
      }
    }

    restoreSession();

    return () => {
      isCurrent = false;
    };
  }, []);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  function handleAuthModeChange(nextMode) {
    setAuthMode(nextMode);
    setFieldErrors([]);
    setFormError("");
    setStatusMessage("");
    setFormData((currentFormData) => ({
      ...currentFormData,
      name: "",
      password: "",
    }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    setFieldErrors([]);
    setFormError("");
    setStatusMessage("");
    setIsSubmitting(true);

    const isRegistering = authMode === "register";
    const payload = isRegistering
      ? formData
      : {
          email: formData.email,
          password: formData.password,
        };

    try {
      const data = isRegistering
        ? await registerStudent(payload)
        : await loginStudent(payload);

      storeAuthToken(data.token);
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setSessionStatus("signedIn");
      setStatusMessage(isRegistering ? "Account created." : "Signed in.");
      setActiveView("Dashboard");
      setFormData({
        ...initialFormData,
        email: data.user.email,
      });
    } catch (error) {
      setFormError(error.message);
      setFieldErrors(error.details ?? []);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshCurrentUser() {
    const activeToken = authToken || getStoredAuthToken();

    if (!activeToken) {
      handleSignOut("Session expired. Please log in again.");
      return;
    }

    setSessionStatus("checking");
    setStatusMessage("");

    try {
      const data = await getCurrentStudent(activeToken);
      setCurrentUser(data.user);
      setSessionStatus("signedIn");
      setStatusMessage("Profile refreshed.");
    } catch {
      handleSignOut("Session expired. Please log in again.");
    }
  }

  function handleSignOut(message = "Signed out.") {
    clearStoredAuthToken();
    setAuthToken("");
    setCurrentUser(null);
    setFieldErrors([]);
    setFormError("");
    setSessionStatus("signedOut");
    setStatusMessage(message);
    setAuthMode("login");
    setActiveView("Dashboard");
  }

  function handleAuthExpired() {
    handleSignOut("Session expired. Please log in again.");
  }

  if (currentUser) {
    return (
      <SignedInScreen
        activeView={activeView}
        authToken={authToken}
        currentUser={currentUser}
        isChecking={sessionStatus === "checking"}
        onAuthExpired={handleAuthExpired}
        onProfileUpdated={setCurrentUser}
        onRefreshCurrentUser={handleRefreshCurrentUser}
        onSignOut={() => handleSignOut()}
        onViewChange={setActiveView}
        statusMessage={statusMessage}
      />
    );
  }

  return (
    <SignedOutScreen
      authMode={authMode}
      fieldErrors={fieldErrors}
      formData={formData}
      formError={formError}
      isChecking={sessionStatus === "checking"}
      isSubmitting={isSubmitting}
      onChange={handleFormChange}
      onModeChange={handleAuthModeChange}
      onSubmit={handleAuthSubmit}
      statusMessage={statusMessage}
    />
  );
}

export default App;
