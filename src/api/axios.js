import axios from "axios";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

const configuredBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://api.hinchmart.com";

// If an absolute URL is provided (e.g. https://api.hinchmart.com or http://localhost:8080),
// connect directly from the browser to avoid Node.js dev-proxy TLS renegotiation / ECONNRESET errors.
const isExplicitProxy =
  typeof configuredBaseUrl === "string" &&
  (configuredBaseUrl.startsWith("/") || configuredBaseUrl === "");

export const apiBaseUrl = isExplicitProxy
  ? configuredBaseUrl || "/api"
  : `${configuredBaseUrl.replace(/\/+$/, "").replace(/\/api$/, "")}/api`;

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 12000,
});

/**
 * Returns the active HinchMart backend JWT accessToken.
 * Priority: hinchmart_admin_token -> adminToken -> accessToken
 */
export const getActiveAccessToken = () => {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("hinchmart_admin_token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    null
  );
};

/**
 * Checks if a JWT token is expired or expiring within 60 seconds
 */
export const isTokenExpired = (token) => {
  if (!token || typeof token !== "string") return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000 - 60000;
  } catch {
    return true;
  }
};

let authRehydrationPromise = null;

/**
 * Waits briefly for Firebase Auth to finish rehydrating currentUser after page reload.
 */
const waitForFirebaseUser = () => {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (authRehydrationPromise) return authRehydrationPromise;

  authRehydrationPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      authRehydrationPromise = null;
      resolve(null);
    }, 1500);

    const unsubscribe = auth.onAuthStateChanged((user) => {
      clearTimeout(timeout);
      unsubscribe();
      authRehydrationPromise = null;
      resolve(user);
    });
  });

  return authRehydrationPromise;
};

/**
 * Resolves the HinchMart backend JWT accessToken for outgoing API requests.
 * Uses 2-Tier Auth:
 * Tier 1: Check existing valid HinchMart JWT accessToken.
 * Tier 2: If missing/expired, silently exchange fresh Firebase ID token via POST /api/auth/sync.
 */
const resolveRequestToken = async () => {
  // 1. Check existing HinchMart backend JWT
  const existingToken = getActiveAccessToken();
  if (existingToken && !isTokenExpired(existingToken)) {
    return existingToken;
  }

  // 2. Token missing or expired: Exchange fresh Firebase ID token for HinchMart JWT
  let currentUser = auth.currentUser;
  if (!currentUser) {
    currentUser = await waitForFirebaseUser();
  }

  if (currentUser) {
    try {
      const freshFirebaseToken = await currentUser.getIdToken(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("firebaseToken", freshFirebaseToken);
      }

      const syncUrl = `${apiBaseUrl}/auth/sync`;
      const syncResponse = await axios.post(
        syncUrl,
        {
          firebaseIdToken: freshFirebaseToken,
          role: "ADMIN",
          email: currentUser.email || undefined,
          name: currentUser.displayName || undefined,
          phone: currentUser.phoneNumber || undefined,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${freshFirebaseToken}`,
          },
          timeout: 15000,
        }
      );

      const responseData = syncResponse.data?.data || syncResponse.data;
      const newAccessToken = responseData?.accessToken || responseData?.token;

      if (newAccessToken && typeof window !== "undefined") {
        localStorage.setItem("hinchmart_admin_token", newAccessToken);
        localStorage.setItem("adminToken", newAccessToken);
        localStorage.setItem("accessToken", newAccessToken);
        if (responseData) {
          localStorage.setItem(
            "hinchmart_admin_user",
            JSON.stringify({
              userId: responseData.userId || null,
              email: responseData.email || currentUser.email,
              name: responseData.name || currentUser.displayName,
              role: responseData.role || "ADMIN",
            })
          );
        }
        return newAccessToken;
      }
    } catch (err) {
      console.warn("Silent token exchange on request notice:", err?.message);
    }
  }

  // 3. Fallback: Return existing token even if expired; backend will return 401 if invalid
  return existingToken || null;
};

// ==========================================
// Request Interceptor: Attach Bearer Token
// ==========================================
api.interceptors.request.use(
  async (config) => {
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      if (config.headers) {
        if (typeof config.headers.delete === "function") {
          config.headers.delete("Content-Type");
          config.headers.delete("content-type");
        }
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }
    } else if (config.data !== undefined && config.headers && !config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json";
    }

    const url = config.url || "";
    const isAuthSync = url.includes("/auth/sync");

    try {
      if (!isAuthSync) {
        const token = await resolveRequestToken();
        if (token && config.headers) {
          if (typeof config.headers.set === "function") {
            config.headers.set("Authorization", `Bearer ${token}`);
          }
          config.headers.Authorization = `Bearer ${token}`;
          config.headers["Authorization"] = `Bearer ${token}`;
        }
      }
    } catch (err) {
      console.warn("Failed to attach authorization header:", err);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================
// Response Interceptor: 401 Token Refresh & 403 Forbidden
// ==========================================
let isRefreshing = false;
let failedQueue = [];

const processFailedQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

let isRedirectingToLogin = false;
let lastSessionExpiredDispatch = 0;

export const purgeSessionAndRedirect = async (force = false) => {
  if (typeof window === "undefined") return;
  if (!force && window.location.pathname.includes("/login")) {
    return;
  }

  try {
    localStorage.removeItem("hinchmart_admin_token");
    localStorage.removeItem("hinchmart_admin_user");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("firebaseToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("userRole");
  } catch {}

  try {
    await signOut(auth);
  } catch {}

  const now = Date.now();
  if (now - lastSessionExpiredDispatch > 3000 && typeof window.dispatchEvent === "function") {
    lastSessionExpiredDispatch = now;
    window.dispatchEvent(
      new CustomEvent("auth:session_expired", {
        detail: {
          message: "Your admin session token has expired. Please log in again to renew your access.",
        },
      })
    );
  }

  if (!isRedirectingToLogin && !window.location.pathname.includes("/login")) {
    isRedirectingToLogin = true;
    setTimeout(() => {
      isRedirectingToLogin = false;
      window.location.replace("/login?expired=true");
    }, 300);
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    // ----------------------------------------------------
    // HTTP 403: Forbidden - Access Denied (Non-Admin / Unauthorized Role)
    // ----------------------------------------------------
    if (status === 403) {
      console.warn("403 Forbidden: Insufficient permissions for administrative endpoint:", originalRequest?.url);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("auth:forbidden", {
            detail: {
              url: originalRequest?.url,
              message: error.response?.data?.message || "Access denied: Insufficient permissions for this resource.",
            },
          })
        );
      }
      return Promise.reject(error);
    }

    // ----------------------------------------------------
    // HTTP 401: Unauthorized - Two-Tier Token Exchange Refresh
    // ----------------------------------------------------
    if (status === 401 && originalRequest && !originalRequest._retried) {
      const requestUrl = originalRequest.url || "";

      // If the failing request was itself /auth/sync or /auth/logout, fail directly without re-attempting
      if (requestUrl.includes("/auth/sync") || requestUrl.includes("/auth/logout")) {
        await purgeSessionAndRedirect();
        return Promise.reject(error);
      }

      // If already in the process of refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newAccessToken) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retried = true;
      isRefreshing = true;

      try {
        let currentUser = auth.currentUser;
        if (!currentUser) {
          currentUser = await waitForFirebaseUser();
        }

        if (!currentUser) {
          throw new Error("No active Firebase session found to re-exchange token.");
        }

        const freshFirebaseToken = await currentUser.getIdToken(true);
        if (!freshFirebaseToken) {
          throw new Error("Unable to obtain fresh Firebase ID token.");
        }

        // Exchange fresh Firebase ID token for HinchMart JWT accessToken
        const syncUrl = `${apiBaseUrl}/auth/sync`;
        const syncResponse = await axios.post(
          syncUrl,
          {
            firebaseIdToken: freshFirebaseToken,
            role: "ADMIN",
            email: currentUser.email || undefined,
            name: currentUser.displayName || undefined,
            phone: currentUser.phoneNumber || undefined,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${freshFirebaseToken}`,
            },
            timeout: 15000,
          }
        );

        const responseData = syncResponse.data?.data || syncResponse.data;
        const newAccessToken = responseData?.accessToken || responseData?.token;

        if (!newAccessToken) {
          throw new Error("Backend did not return an accessToken on /api/auth/sync.");
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("hinchmart_admin_token", newAccessToken);
          localStorage.setItem("adminToken", newAccessToken);
          localStorage.setItem("accessToken", newAccessToken);
          localStorage.setItem("authToken", newAccessToken);
          localStorage.setItem("firebaseToken", freshFirebaseToken);
          if (responseData) {
            localStorage.setItem(
              "hinchmart_admin_user",
              JSON.stringify({
                userId: responseData.userId || null,
                email: responseData.email || currentUser.email,
                name: responseData.name || currentUser.displayName,
                role: responseData.role || "ADMIN",
              })
            );
          }
        }

        processFailedQueue(null, newAccessToken);

        // Retry original failed request with the new HinchMart JWT accessToken
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        console.warn("Silent token exchange notice on 401:", refreshErr?.message);
        processFailedQueue(refreshErr, null);
        await purgeSessionAndRedirect(true);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
