import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("manager@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      if (email === "manager@example.com") {
        navigate("/manager");
      } else {
        navigate("/tenant");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-title-row">
          <div className="app-logo-circle">K</div>
          <div>
            <h1 className="auth-title">Kefiat</h1>
            <p className="auth-subtitle">
              Simple, clear maintenance for tenants & managers.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <div className="text-error">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 10 }}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="auth-helper">
          <div>Test accounts:</div>
          <div>Manager – manager@example.com / password123</div>
          <div>Tenant – tenant@example.com / password123</div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
