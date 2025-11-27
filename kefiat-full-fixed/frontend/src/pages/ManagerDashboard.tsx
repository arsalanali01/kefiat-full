import React, { useEffect, useMemo, useState } from "react";
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

type ManagerRequest = {
  id: number;
  unit: string;
  category: string;
  description: string;
  phone: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  priority: RequestPriority;
  preferredTimeWindow: PreferredTimeWindow;
  accessInstructions?: string | null;
  lastUpdatedByRole: UpdatedByRole;
  tenant: {
    name: string;
    email: string;
  };
};

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

const statusOrder: RequestStatus[] = [
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

const ManagerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [requests, setRequests] = useState<ManagerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updatingPriorityId, setUpdatingPriorityId] = useState<number | null>(
    null
  );

  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>(
    "all"
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await api.get<ManagerRequest[]>("/requests", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRequests(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load maintenance requests.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleStatusChange = async (id: number, newStatus: RequestStatus) => {
    if (!token) return;
    setUpdatingId(id);
    setError(null);

    try {
      const res = await api.patch<ManagerRequest>(
        `/requests/${id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: res.data.status,
                updatedAt: res.data.updatedAt,
                lastUpdatedByRole: res.data.lastUpdatedByRole,
              }
            : r
        )
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePriorityChange = async (
    id: number,
    newPriority: RequestPriority
  ) => {
    if (!token) return;
    setUpdatingPriorityId(id);
    setError(null);

    try {
      const res = await api.patch<ManagerRequest>(
        `/requests/${id}/priority`,
        { priority: newPriority },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                priority: res.data.priority,
                updatedAt: res.data.updatedAt,
                lastUpdatedByRole: res.data.lastUpdatedByRole,
              }
            : r
        )
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to update priority.");
    } finally {
      setUpdatingPriorityId(null);
    }
  };

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });

  const formatUpdatedBy = (role: UpdatedByRole) => {
    if (role === "tenant") return "Tenant";
    if (role === "manager") return "Maintenance";
    return "System";
  };

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests.filter((r) => {
      // Status filtering:
      // "all" = all *open* (non-completed) requests
      if (statusFilter === "all") {
        if (r.status === "completed") return false;
      } else if (r.status !== statusFilter) {
        return false;
      }

      if (!term) return true;

      const haystack =
        `${r.unit} ${r.category} ${r.phone} ${r.tenant.name} ${r.tenant.email}`.toLowerCase();

      return haystack.includes(term);
    });
  }, [requests, statusFilter, search]);

  const totalOpen = requests.filter((r) => r.status !== "completed").length;
  const totalCompleted = requests.filter(
    (r) => r.status === "completed"
  ).length;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar-left">
          <div className="app-logo-circle">K</div>
          <div>
            <h1 className="app-topbar-title">Manager Dashboard</h1>
            <p className="app-topbar-subtitle">
              Live view of all maintenance requests in your property.
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
        {/* Summary cards */}
        <section className="card-grid">
          <div className="card">
            <p className="card-title">Active Requests</p>
            <p className="card-value">{totalOpen}</p>
          </div>
          <div className="card">
            <p className="card-title">Completed</p>
            <p className="card-value">{totalCompleted}</p>
          </div>
        </section>

        {/* Requests table with filters */}
        <section className="card">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>
              Live Maintenance Requests
            </h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {/* Status filter buttons */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {(["all", ...statusOrder] as const).map((s) => {
                  const label = s === "all" ? "All (Open)" : statusLabels[s];
                  const active = statusFilter === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={
                        active ? "btn btn-primary" : "btn btn-secondary"
                      }
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Search field */}
              <div>
                <input
                  type="text"
                  className="input"
                  placeholder="Search unit, tenant, phone, category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ minWidth: 220 }}
                />
              </div>
            </div>
          </div>

          {error && <div className="text-error">{error}</div>}

          {loading ? (
            <p className="text-muted">Loading requests...</p>
          ) : filteredRequests.length === 0 ? (
            <p className="text-muted">
              No requests match your current filters.
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Unit</th>
                    <th>Tenant</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Preferred Time</th>
                    <th>Description</th>
                    <th>Phone</th>
                    <th>Last Updated</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="table-row">
                      <td>{req.id}</td>
                      <td>{req.unit}</td>
                      <td>
                        <div>{req.tenant?.name}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>
                          {req.tenant?.email}
                        </div>
                      </td>
                      <td>{req.category}</td>
                      <td>
                        <div
                          style={{
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              border: "1px solid rgba(148,163,184,0.7)",
                              color: priorityColor[req.priority],
                            }}
                          >
                            {priorityLabels[req.priority]}
                          </span>
                        </div>
                        <select
                          value={req.priority}
                          disabled={updatingPriorityId === req.id}
                          onChange={(e) =>
                            handlePriorityChange(
                              req.id,
                              e.target.value as RequestPriority
                            )
                          }
                          className="select"
                          style={{ fontSize: 11 }}
                        >
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="emergency">Emergency</option>
                        </select>
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {req.preferredTimeWindow
                          ? timeWindowLabels[req.preferredTimeWindow]
                          : "—"}
                      </td>
                      <td>
                        <div>{req.description}</div>
                        {req.accessInstructions && (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: "#9ca3af",
                            }}
                          >
                            Access: {req.accessInstructions}
                          </div>
                        )}
                      </td>
                      <td>{req.phone}</td>
                      <td style={{ fontSize: 11 }}>
                        <div>{formatDateTime(req.updatedAt)}</div>
                        <div style={{ color: "#9ca3af" }}>
                          by {formatUpdatedBy(req.lastUpdatedByRole)}
                        </div>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <span
                            className="status-pill"
                            style={{ backgroundColor: statusColor[req.status] }}
                          >
                            {statusLabels[req.status]}
                          </span>
                          <select
                            value={req.status}
                            disabled={updatingId === req.id}
                            onChange={(e) =>
                              handleStatusChange(
                                req.id,
                                e.target.value as RequestStatus
                              )
                            }
                            className="select"
                            style={{ fontSize: 12 }}
                          >
                            {statusOrder.map((s) => (
                              <option key={s} value={s}>
                                {statusLabels[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ManagerDashboard;
