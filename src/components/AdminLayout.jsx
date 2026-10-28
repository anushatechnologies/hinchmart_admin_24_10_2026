import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useToast } from "./ToastContext";
import "../styles/layout.css";

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const toast = useToast();

  const [sessionExpired, setSessionExpired] = useState(false);

  // Listen for 403 Forbidden and 401 Session Expired events from API interceptor
  useEffect(() => {
    const handleForbidden = (e) => {
      const msg = e?.detail?.message || "Access Denied: You do not have permissions for this action.";
      toast?.error(msg);
    };
    const handleSessionExpired = (e) => {
      const msg = e?.detail?.message || "Admin session has expired. Please log in again.";
      setSessionExpired(true);
      toast?.warning(msg);
    };
    window.addEventListener("auth:forbidden", handleForbidden);
    window.addEventListener("auth:session_expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:forbidden", handleForbidden);
      window.removeEventListener("auth:session_expired", handleSessionExpired);
    };
  }, [toast]);

  // Close mobile drawer automatically when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Handle ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <div className={`admin-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="main-area">
        <Topbar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          onToggleMobileMenu={() => setMobileOpen(!mobileOpen)}
        />

        {sessionExpired && (
          <div
            style={{
              background: "#fef2f2",
              borderBottom: "1px solid #fecaca",
              padding: "10px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#991b1b",
              fontSize: "0.875rem",
              fontWeight: 500,
              zIndex: 90,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>⚠️</span>
              <span>
                <strong>Admin session token has expired:</strong> The server returned 401 Unauthorized. Page refresh will not fix this; please re-login.
              </span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem("hinchmart_admin_token");
                localStorage.removeItem("hinchmart_admin_user");
                localStorage.removeItem("adminToken");
                localStorage.removeItem("accessToken");
                localStorage.removeItem("authToken");
                localStorage.removeItem("firebaseToken");
                localStorage.removeItem("adminUser");
                localStorage.removeItem("userRole");
                window.location.href = "/login";
              }}
              style={{
                background: "#dc2626",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Log In Again
            </button>
          </div>
        )}

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

