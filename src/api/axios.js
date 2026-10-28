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
 * Falls back to legacy keys for compatibility.
 */
export const getActiveAccessToken = () => {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("adminToken") ||
    localStorage.getItem("firebaseToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    null
  );
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
 * Resolves the token to use for outgoing API requests.
 * All admin requests require the standard Firebase Bearer token:
 * Authorization: Bearer <ADMIN_FIREBASE_ID_TOKEN>
 */
const resolveRequestToken = async () => {
  // 1. If currentUser is already loaded in Firebase auth instance, get fresh ID token
  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (typeof window !== "undefined" && idToken) {
        localStorage.setItem("firebaseToken", idToken);
      }
      return idToken;
    } catch (err) {
      console.warn("Failed to retrieve Firebase ID token:", err?.message);
    }
  }

  // 2. Wait briefly for Firebase Auth to rehydrate from IndexedDB
  const currentUser = await waitForFirebaseUser();
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      if (typeof window !== "undefined" && idToken) {
        localStorage.setItem("firebaseToken", idToken);
      }
      return idToken;
    } catch (err) {
      console.warn("Failed to retrieve Firebase ID token fallback:", err?.message);
    }
  }

  // 3. Last fallback: Check stored token in localStorage
  const storedToken = getActiveAccessToken();
  if (storedToken) return storedToken;

  return null;
};

// ==========================================
// Request Interceptor: Attach Bearer Token
// ==========================================
api.interceptors.request.use(
  async (config) => {
    // If data is FormData, remove manual Content-Type so browser sets boundary correctly
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

    // Skip attaching Authorization header for public /auth/sync if none exists yet
    const url = config.url || "";
    const isAuthSync = url.includes("/auth/sync");

    try {
      const token = await resolveRequestToken();
      if (token && config.headers) {
        if (typeof config.headers.set === "function") {
          config.headers.set("Authorization", `Bearer ${token}`);
        }
        config.headers.Authorization = `Bearer ${token}`;
        config.headers["Authorization"] = `Bearer ${token}`;
      } else if (!isAuthSync) {
        // If no token exists and not public sync, still allow proceeding; backend will return 401 if protected
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
      window.location.replace("/login");
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
    // HTTP 401: Unauthorized - Hybrid Token Exchange Silent Refresh
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
        // Step 1: Retrieve a fresh Firebase ID Token silently from the identity provider session
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

        // Step 2: Call POST /api/auth/sync with the new Firebase ID token
        const syncUrl = `${apiBaseUrl}/auth/sync`;
        let newAccessToken = freshFirebaseToken;
        try {
          const syncResponse = await axios.post(
            syncUrl,
            {
              firebaseIdToken: freshFirebaseToken,
              name: currentUser.displayName || undefined,
              email: currentUser.email || undefined,
              phone: currentUser.phoneNumber || undefined,
              role: "ADMIN",
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
          if (responseData?.accessToken) {
            newAccessToken = responseData.accessToken;
          }
        } catch (syncErr) {
          console.warn("Silent token sync notice:", syncErr?.message);
          if (syncErr.response?.status === 401 || syncErr.response?.status === 403) {
            throw syncErr;
          }
        }

        // Store new active token
        if (typeof window !== "undefined") {
          localStorage.setItem("adminToken", newAccessToken);
          localStorage.setItem("accessToken", newAccessToken);
          localStorage.setItem("authToken", newAccessToken);
          localStorage.setItem("firebaseToken", freshFirebaseToken);
        }

        processFailedQueue(null, newAccessToken);

        // Step 3: Retry original failed request with the new token
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
);;

export default api;
