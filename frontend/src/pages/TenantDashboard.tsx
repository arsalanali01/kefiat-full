import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

type RequestStatus =
  | "in_queue"
  | "viewed"
  | "maintenance_requested"
  | "implementing_actions"
  | "completed";

type RequestPriority = "low" | "normal" | "high" | "emergency";

type PreferredTimeWindow =
  | "morning"
  | "afternoon"
  | "evening"
  | "anytime"
  | null;

type UpdatedByRole = "tenant" | "manager" | "system";

type TenantRequest = {
  id: number;
  unit: string;
  category: string;
  description: string;
  phone: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  priority: RequestPriority;
  preferredWindow1?: string | null;
  preferredWindow2?: string | null;
  accessInstructions?: string | null;
  lastUpdatedByRole: UpdatedByRole;

  inQueueAt: string | null;
  viewedAt: string | null;
  maintenanceRequestedAt: string | null;
  implementingActionsAt: string | null;
  completedAt: string | null;
};

const windowOptions = [
  { value: "08:00-10:00", label: "8:00 – 10:00 AM" },
  { value: "09:00-11:00", label: "9:00 – 11:00 AM" },
  { value: "10:00-12:00", label: "10:00 AM – 12:00 PM" },
  { value: "11:00-13:00", label: "11:00 AM – 1:00 PM" },
  { value: "12:00-14:00", label: "12:00 – 2:00 PM" },
  { value: "13:00-15:00", label: "1:00 – 3:00 PM" },
  { value: "14:00-16:00", label: "2:00 – 4:00 PM" },
  { value: "15:00-17:00", label: "3:00 – 5:00 PM" },
];

const statusLabels: Record<RequestStatus, string> = {
  in_queue: "In Queue",
  viewed: "Viewed",
  maintenance_requested: "Maintenance Requested",
  implementing_actions: "Implementing Actions",
  completed: "Completed",
};

const statusColor: Record<RequestStatus, string> = {
  in_queue: "#4b5563",
  viewed: "#0ea5e9",
  maintenance_requested: "#f97316",
  implementing_actions: "#eab308",
  completed: "#16a34a",
};

const statusPipeline: RequestStatus[] = [
  "in_queue",
  "viewed",
  "maintenance_requested",
  "implementing_actions",
  "completed",
];

const priorityLabels: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  emergency: "Emergency",
};

const priorityColor: Record<RequestPriority, string> = {
  low: "#6b7280",
  normal: "#0ea5e9",
  high: "#f97316",
  emergency: "#ef4444",
};

const timeWindowLabels: Record<Exclude<PreferredTimeWindow, null>, string> = {
  morning: "Morning (8–12)",
  afternoon: "Afternoon (12–4)",
  evening: "Evening (4–8)",
  anytime: "Anytime",
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000",
});

const TenantDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const [requestView, setRequestView] = useState<"active" | "completed">(
    "active"
  );

  // Modal for "Mark as resolved"
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRequestId, setModalRequestId] = useState<number | null>(null);

  const openResolveModal = (id: number) => {
    setModalRequestId(id);
    setModalOpen(true);
  };

  const closeResolveModal = () => {
    setModalOpen(false);
    setModalRequestId(null);
  };

  const confirmResolve = async () => {
    if (!token || !modalRequestId) return;

    try {
      const res = await api.patch<TenantRequest>(
        `/requests/${modalRequestId}/close`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRequests((prev) =>
        prev.map((r) => (r.id === modalRequestId ? { ...r, ...res.data } : r))
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to close request.");
    } finally {
      closeResolveModal();
    }
  };

  const getStatusIndex = (status: RequestStatus) =>
    statusPipeline.indexOf(status);

  const formatUpdatedBy = (role: UpdatedByRole) => {
    if (role === "tenant") return "You";
    if (role === "manager") return "Maintenance";
    return "System";
  };

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });

  const formatTimeOnly = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const formatDuration = (start: string, end: string): string | null => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return null;
    const diffMs = e - s;
    const totalMinutes = Math.round(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes - hours * 60;

    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  };

  const activeRequests = requests.filter((r) => r.status !== "completed");
  const completedRequests = requests.filter((r) => r.status === "completed");
  const currentList =
    requestView === "active" ? activeRequests : completedRequests;

  // Load + auto-refresh tenant requests
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchRequests = async () => {
      try {
        const res = await api.get<TenantRequest[]>("/requests/mine", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          setRequests(res.data);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load your requests.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRequests();
    const intervalId = setInterval(fetchRequests, 15000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [token]);

  const [form, setForm] = useState({
    unit: "",
    category: "HVAC",
    description: "",
    phone: "",
    priority: "normal" as RequestPriority,
    preferredWindow1: "08:00-10:00",
    preferredWindow2: "",
    accessInstructions: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setError(null);
    setSubmitMessage(null);

    try {
      const res = await api.post<TenantRequest>(
        "/requests",
        {
          unit: form.unit,
          category: form.category,
          description: form.description,
          phone: form.phone,
          priority: form.priority,
          preferredWindow1: form.preferredWindow1,
          preferredWindow2: form.preferredWindow2 || undefined,
          accessInstructions: form.accessInstructions || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRequests((prev) => [res.data, ...prev]);
      setForm({
        unit: "",
        category: "HVAC",
        description: "",
        phone: "",
        priority: "normal",
        preferredWindow1: "08:00-10:00",
        preferredWindow2: "",
        accessInstructions: "",
      });
      setSubmitMessage(
        "Request submitted. We’ll update you as it moves through each step."
      );
      setRequestView("active");
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-left">
          <div className="app-logo-circle">K</div>
          <div>
            <h1 className="app-topbar-title">Tenant Portal</h1>
            <p className="app-topbar-subtitle">
              Submit issues and track your maintenance in real time.
            </p>
          </div>
        </div>
        <div>
          <div className="app-topbar-user">
            <div>{user?.name}</div>
            <div>{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{ marginTop: 6 }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="page-content">
        <div className="layout-two-column">
          {/* LEFT: form */}
          <section className="card">
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>
              Submit a Maintenance Request
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }} className="field-group">
                  <label className="field-label">Apartment / Unit Number</label>
                  <input
                    type="text"
                    name="unit"
                    className="input"
                    value={form.unit}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div style={{ flex: 1 }} className="field-group">
                  <label className="field-label">Issue Category</label>
                  <select
                    name="category"
                    className="select"
                    value={form.category}
                    onChange={handleChange}
                  >
                    <option>HVAC</option>
                    <option>AC</option>
                    <option>Water leak</option>
                    <option>Laundry/Dryer</option>
                    <option>Kitchen</option>
                    <option>Power Outage</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }} className="field-group">
                  <label className="field-label">
                    Priority{" "}
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>
                      (Emergency = active leak, fire, gas smell, total outage)
                    </span>
                  </label>
                  <select
                    name="priority"
                    className="select"
                    value={form.priority}
                    onChange={handleChange}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                <div style={{ flex: 1 }} className="field-group">
                  <label className="field-label">
                    Preferred Visit Windows{" "}
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>
                      (Choose one required and an optional backup; each is a
                      2-hour window between 8 AM and 5 PM)
                    </span>
                  </label>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                          display: "inline-block",
                          marginBottom: 2,
                        }}
                      >
                        Primary window (required)
                      </span>
                      <select
                        name="preferredWindow1"
                        className="select"
                        value={form.preferredWindow1}
                        onChange={handleChange}
                        required
                      >
                        {windowOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                          display: "inline-block",
                          marginBottom: 2,
                        }}
                      >
                        Backup window (optional)
                      </span>
                      <select
                        name="preferredWindow2"
                        className="select"
                        value={form.preferredWindow2}
                        onChange={handleChange}
                      >
                        <option value="">No backup</option>
                        {windowOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Description of the Issue</label>
                <textarea
                  name="description"
                  className="textarea"
                  value={form.description}
                  onChange={handleChange}
                  required
                  rows={4}
                  placeholder="Describe what’s happening so maintenance can help faster."
                />
              </div>

              <div className="field-group">
                <label className="field-label">
                  Best Phone Number to Contact
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="input"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  placeholder="e.g. (555) 123-4567"
                />
              </div>

              <div className="field-group">
                <label className="field-label">
                  Access Instructions (optional)
                </label>
                <textarea
                  name="accessInstructions"
                  className="textarea"
                  value={form.accessInstructions}
                  onChange={handleChange}
                  rows={3}
                  placeholder="OK to enter if I’m not home, call before coming, etc."
                />
              </div>

              {error && <div className="text-error">{error}</div>}
              {submitMessage && !error && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "#a5b4fc",
                  }}
                >
                  {submitMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ marginTop: 8 }}
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </section>

          {/* RIGHT: request cards */}
          <section>
            <h2 style={{ marginBottom: 8, fontSize: 18 }}>
              Track Your Requests
            </h2>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className={
                  requestView === "active"
                    ? "btn btn-primary"
                    : "btn btn-secondary"
                }
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => setRequestView("active")}
              >
                Active Requests
              </button>
              <button
                type="button"
                className={
                  requestView === "completed"
                    ? "btn btn-primary"
                    : "btn btn-secondary"
                }
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => setRequestView("completed")}
              >
                Previous Requests
              </button>
            </div>

            {loading ? (
              <p className="text-muted">Loading your requests...</p>
            ) : currentList.length === 0 ? (
              <p className="text-muted">
                {requestView === "active"
                  ? "You don’t have any active requests right now."
                  : "You don’t have any completed requests yet."}
              </p>
            ) : (
              <div className="request-cards">
                {currentList.map((r) => {
                  const currentIndex = getStatusIndex(r.status);

                  const times: {
                    status: RequestStatus;
                    time: string | null;
                  }[] = [
                    { status: "in_queue", time: r.inQueueAt || r.createdAt },
                    { status: "viewed", time: r.viewedAt },
                    {
                      status: "maintenance_requested",
                      time: r.maintenanceRequestedAt,
                    },
                    {
                      status: "implementing_actions",
                      time: r.implementingActionsAt,
                    },
                    { status: "completed", time: r.completedAt },
                  ];

                  return (
                    <article key={r.id} className="card request-card">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 8,
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <h3 className="request-card-title">
                            {r.category} – Unit {r.unit}
                          </h3>
                          <p className="request-card-meta">
                            Submitted: {formatDateTime(r.createdAt)}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            className="status-pill"
                            style={{ backgroundColor: statusColor[r.status] }}
                          >
                            {statusLabels[r.status]}
                          </span>
                          <div
                            style={{
                              marginTop: 6,
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              border: "1px solid rgba(148,163,184,0.7)",
                              color: priorityColor[r.priority],
                            }}
                          >
                            {priorityLabels[r.priority]}
                          </div>
                        </div>
                      </div>

                      <p className="request-card-text">{r.description}</p>

                      <p className="request-card-footer">Contact: {r.phone}</p>

                      {/* Preferred visit windows */}
                      {(r.preferredWindow1 || r.preferredWindow2) && (
                        <p className="request-card-footer">
                          Preferred windows:{" "}
                          {r.preferredWindow1 && (
                            <span>{r.preferredWindow1}</span>
                          )}
                          {r.preferredWindow1 && r.preferredWindow2 && (
                            <span>; </span>
                          )}
                          {r.preferredWindow2 && (
                            <span>{r.preferredWindow2}</span>
                          )}
                        </p>
                      )}

                      {r.accessInstructions && (
                        <p className="request-card-footer">
                          Access: {r.accessInstructions}
                        </p>
                      )}

                      {/* TIMELINE */}
                      <div className="request-timeline">
                        {/* bar */}
                        <div className="request-timeline-bar-row">
                          {statusPipeline.map((step, idx) => (
                            <div key={step} className="request-timeline-step">
                              {idx <= currentIndex && (
                                <div className="request-timeline-step-fill" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* labels */}
                        <div className="request-timeline-label-row">
                          {statusPipeline.map((step) => (
                            <div key={step} className="request-timeline-label">
                              {statusLabels[step]}
                            </div>
                          ))}
                        </div>

                        {/* times under each label */}
                        <div
                          style={{
                            marginTop: 4,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 4,
                          }}
                        >
                          {statusPipeline.map((step, index) => {
                            const timeEntry = times.find(
                              (t) => t.status === step
                            );
                            const timeVal = timeEntry?.time || null;
                            const timeStr = timeVal
                              ? formatTimeOnly(timeVal)
                              : null;

                            let delta: string | null = null;
                            if (index > 0 && timeVal && times[index - 1].time) {
                              delta = formatDuration(
                                times[index - 1].time as string,
                                timeVal
                              );
                            }

                            return (
                              <div
                                key={step}
                                style={{
                                  flex: 1,
                                  textAlign: "center",
                                  fontSize: 11,
                                  lineHeight: 1.2,
                                }}
                              >
                                <div
                                  style={{
                                    color: timeStr ? "#e5e7eb" : "#9ca3af",
                                  }}
                                >
                                  {timeStr || "Pending"}
                                </div>
                                {delta && (
                                  <div
                                    style={{
                                      marginTop: 2,
                                      fontSize: 10,
                                      color: "#9ca3af",
                                    }}
                                  >
                                    +{delta}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <p
                          className="request-card-footer"
                          style={{ marginTop: 6 }}
                        >
                          Last updated: {formatDateTime(r.updatedAt)} • Updated
                          by {formatUpdatedBy(r.lastUpdatedByRole)}
                        </p>
                      </div>

                      {r.status !== "completed" && (
                        <div
                          style={{
                            marginTop: 10,
                            display: "flex",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                            onClick={() => openResolveModal(r.id)}
                          >
                            Mark as resolved
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Resolve confirmation modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 className="modal-title">Resolve Request?</h3>
            <p className="modal-text">
              Mark this request as resolved? This will complete it for
              maintenance.
            </p>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeResolveModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmResolve}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantDashboard;
