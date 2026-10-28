import React, { createContext, useContext, useEffect, useState } from "react";
import {
  registerWithEmailPassword,
  loginWithEmailPassword,
  loginWithGoogle,
  resetAdminPassword,
  logoutUser,
  getAuthToken,
  onAuthStateChangedListener,
} from "./authService";
import { AdminAuthService } from "../api/authService";
import { getActiveAccessToken, isTokenExpired } from "../api/axios";

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  isAuthenticated: false,
  login: async () => {},
  loginWithGoogle: async () => {},
  register: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  getIdToken: async () => null,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("hinchmart_admin_user") || localStorage.getItem("adminUser");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState(() => {
    if (typeof window !== "undefined") {
      const existing = getActiveAccessToken();
      return existing && !isTokenExpired(existing) ? existing : null;
    }
    return null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Safety timer: Never leave app stuck on full-screen loading spinner
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1500);

    // Initial session verification: If existing valid HinchMart JWT is present, verify with GET /api/auth/me
    const verifyInitialSession = async () => {
      const activeToken = getActiveAccessToken();
      if (activeToken && !isTokenExpired(activeToken)) {
        try {
          const adminProfile = await AdminAuthService.getCurrentAdmin();
          if (isMounted && adminProfile) {
            setUser((prev) => ({
              ...prev,
              ...adminProfile,
              name: adminProfile.name || prev?.name || "Admin",
              displayName: adminProfile.name || prev?.displayName || "Admin",
              email: adminProfile.email || prev?.email,
              role: adminProfile.role || prev?.role || "ADMIN",
            }));
            setToken(activeToken);
            setLoading(false);
          }
        } catch (meErr) {
          console.warn("Initial GET /api/auth/me check notice:", meErr?.message);
        }
      }
    };

    verifyInitialSession();

    // Firebase Auth State Listener
    const unsubscribe = onAuthStateChangedListener(async (currentUser) => {
      clearTimeout(safetyTimer);
      if (!isMounted) return;

      if (currentUser) {
        let activeToken = getActiveAccessToken();
        let adminData = null;

        // If active JWT is missing or expired, sync with backend to get fresh HinchMart JWT
        if (!activeToken || isTokenExpired(activeToken)) {
          try {
            const idToken = await currentUser.getIdToken(true);
            adminData = await AdminAuthService.syncAdminUser(
              idToken,
              currentUser.email,
              currentUser.displayName,
              currentUser.phoneNumber
            );
            activeToken = adminData?.accessToken || getActiveAccessToken();
          } catch (syncErr) {
            console.warn("AuthContext sync on auth change notice:", syncErr?.message);
          }
        }

        const sessionUser = {
          userId: adminData?.userId || null,
          firebaseUid: currentUser.uid,
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: adminData?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "Admin",
          name: adminData?.name || currentUser.displayName || currentUser.email?.split("@")[0] || "Admin",
          phone: currentUser.phoneNumber || adminData?.phone || "",
          role: adminData?.role || "ADMIN",
        };

        setUser(sessionUser);
        setToken(activeToken);
      } else {
        // Firebase confirmed no active session
        setUser(null);
        setToken(null);
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
      }

      setLoading(false);
    });

    // Handle session expired broadcast from Axios interceptor
    const handleSessionExpired = async () => {
      setUser(null);
      setToken(null);
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
        await logoutUser();
      } catch {}
    };

    window.addEventListener("auth:session_expired", handleSessionExpired);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
      window.removeEventListener("auth:session_expired", handleSessionExpired);
    };
  }, []);

  const handleLogin = async (email, password, rememberMe = false) => {
    const res = await loginWithEmailPassword(email, password, rememberMe);
    const profile = res.backendData || {
      email: res.user?.email || email,
      name: res.user?.displayName || email.split("@")[0],
      displayName: res.user?.displayName || email.split("@")[0],
      role: "ADMIN",
    };
    setUser(profile);
    setToken(res.token);
    return res;
  };

  const handleRegister = async (data) => {
    const res = await registerWithEmailPassword(data);
    const profile = res.backendData || {
      email: data.email,
      name: data.name,
      displayName: data.name,
      role: data.department || "ADMIN",
    };
    setUser(profile);
    setToken(res.token);
    return res;
  };

  const handleGoogleLogin = async () => {
    const res = await loginWithGoogle();
    const profile = res.backendData || {
      email: res.user?.email,
      name: res.user?.displayName || "Admin",
      displayName: res.user?.displayName || "Admin",
      role: res.role || "ADMIN",
    };
    setUser(profile);
    setToken(res.token);
    return res;
  };

  const handleResetPassword = async (email) => {
    return await resetAdminPassword(email);
  };

  const handleLogout = async () => {
    try {
      await AdminAuthService.logout();
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login: handleLogin,
    loginWithGoogle: handleGoogleLogin,
    register: handleRegister,
    logout: handleLogout,
    resetPassword: handleResetPassword,
    getIdToken: getAuthToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
