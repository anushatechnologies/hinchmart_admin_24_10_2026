import api, { apiBaseUrl, purgeSessionAndRedirect } from "./axios";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

/**
 * AdminAuthService
 * Implements HinchMart's Two-Tier JWT Authentication Model:
 * 1. Firebase Auth for Identity Provider
 * 2. HinchMart HS256 JWT (accessToken) for Platform API Authorization
 * Endpoints:
 * - POST /api/auth/sync          -> Exchanges Firebase ID token for HinchMart JWT
 * - GET  /api/auth/me            -> Verifies session & retrieves current admin profile
 * - POST /api/auth/claim-admin   -> Explicit admin role claim / sync
 * - POST /api/auth/refresh-token -> Session refresh
 * - POST /api/auth/logout        -> Server-side logout & client purge
 */
export const AdminAuthService = {
  /**
   * Exchanges Firebase ID Token for internal HinchMart JWT (accessToken)
   * and validates admin privileges.
   * POST /api/auth/sync
   *
   * @param {string} firebaseIdToken
   * @param {string} email
   * @param {string} [name]
   * @param {string} [phone]
   */
  async syncAdminUser(firebaseIdToken, email, name, phone) {
    if (!firebaseIdToken) {
      throw new Error("Missing Firebase ID token for authentication sync.");
    }

    const payload = {
      firebaseIdToken,
      role: "ADMIN",
      email: email || undefined,
      name: name || undefined,
      phone: phone || undefined,
    };

    const response = await api.post("/auth/sync", payload, {
      headers: {
        Authorization: `Bearer ${firebaseIdToken}`,
      },
    });

    const body = response.data !== undefined ? response.data : response;
    const data = body?.data || body;

    if ((body?.success !== false) && data?.accessToken) {
      const { accessToken, role, email: userEmail, userId, name: userName, phone: userPhone, customerId } = data;

      // Authorization guard: verify admin privilege
      const normalizedRole = String(role || "").toUpperCase();
      if (normalizedRole && !normalizedRole.includes("ADMIN")) {
        throw new Error("Access Denied: This account is not registered as an Administrator.");
      }

      const adminUserSession = {
        userId: userId || customerId || null,
        customerId: customerId || userId || null,
        email: userEmail || email,
        name: userName || name || (userEmail || email)?.split("@")[0] || "Admin",
        displayName: userName || name || (userEmail || email)?.split("@")[0] || "Admin",
        phone: userPhone || phone || "",
        role: normalizedRole || "ADMIN",
        isProfileComplete: data.isProfileComplete ?? true,
      };

      if (typeof window !== "undefined") {
        // Primary HinchMart Admin Storage Keys
        localStorage.setItem("hinchmart_admin_token", accessToken);
        localStorage.setItem("hinchmart_admin_user", JSON.stringify(adminUserSession));

        // Backwards compatibility keys
        localStorage.setItem("adminToken", accessToken);
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("authToken", accessToken);
        localStorage.setItem("adminUser", JSON.stringify(adminUserSession));
        localStorage.setItem("userRole", normalizedRole || "ADMIN");
      }

      return data;
    }

    throw new Error(body?.message || "Authentication sync failed.");
  },

  /**
   * Verifies current session on app startup or page refresh (F5).
   * GET /api/auth/me
   * Headers: Authorization: Bearer <hinchmart_admin_token>
   */
  async getCurrentAdmin() {
    const response = await api.get("/auth/me");
    const body = response.data !== undefined ? response.data : response;
    const data = body?.data || body;

    if (data && typeof window !== "undefined") {
      const existingRaw = localStorage.getItem("hinchmart_admin_user");
      let existing = {};
      try {
        if (existingRaw) existing = JSON.parse(existingRaw);
      } catch {}

      const updatedUser = {
        ...existing,
        userId: data.userId || existing.userId || null,
        email: data.email || existing.email,
        name: data.name || existing.name || "Admin",
        displayName: data.name || existing.displayName || "Admin",
        phone: data.phone || existing.phone || "",
        role: data.role || existing.role || "ADMIN",
        isProfileComplete: data.isProfileComplete ?? true,
      };

      localStorage.setItem("hinchmart_admin_user", JSON.stringify(updatedUser));
      localStorage.setItem("adminUser", JSON.stringify(updatedUser));
      localStorage.setItem("userRole", updatedUser.role);
    }

    return data;
  },

  /**
   * Explicit Admin Role Elevation / Verification
   * POST /api/auth/claim-admin
   * Headers: Authorization: Bearer <hinchmart_admin_token>
   */
  async claimAdmin() {
    const response = await api.post("/auth/claim-admin");
    const body = response.data !== undefined ? response.data : response;
    return body?.data || body;
  },

  /**
   * Refreshes active admin session
   * POST /api/auth/refresh-token
   * @param {string} [token]
   */
  async refreshToken(token) {
    const payload = token ? { token } : {};
    const response = await api.post("/auth/refresh-token", payload);
    const body = response.data !== undefined ? response.data : response;
    return body?.data || body;
  },

  /**
   * Pre-login phone number existence check
   * GET /api/auth/check-phone?phone=...
   */
  async checkPhone(phone) {
    const response = await api.get("/auth/check-phone", { params: { phone } });
    const body = response.data !== undefined ? response.data : response;
    return body?.data || body;
  },

  /**
   * Admin Logout
   * POST /api/auth/logout
   * Clears all session storage, signs out from Firebase, and redirects to login.
   */
  async logout() {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Backend logout endpoint notice:", err?.message);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("hinchmart_admin_token");
        localStorage.removeItem("hinchmart_admin_user");
        localStorage.removeItem("adminToken");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("authToken");
        localStorage.removeItem("firebaseToken");
        localStorage.removeItem("adminUser");
        localStorage.removeItem("userRole");
      }

      try {
        await signOut(auth);
      } catch {}

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  },
};

export default AdminAuthService;
