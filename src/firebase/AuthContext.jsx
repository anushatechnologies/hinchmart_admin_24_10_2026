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
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timer: Never leave app stuck on full-screen loading spinner
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    const unsubscribe = onAuthStateChangedListener(async (currentUser) => {
      clearTimeout(safetyTimer);
      if (currentUser) {
        setUser(currentUser);
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);
          if (typeof window !== "undefined") {
            localStorage.setItem("firebaseToken", idToken);
          }
        } catch {
          // Token retrieval failure
        }
      } else {
        // Firebase has confirmed no active session exists: purge stale session
        setUser(null);
        setToken(null);
        if (typeof window !== "undefined") {
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

    const handleSessionExpired = async () => {
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined") {
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
      clearTimeout(safetyTimer);
      unsubscribe();
      window.removeEventListener("auth:session_expired", handleSessionExpired);
    };
  }, []);

  const handleLogin = async (email, password, rememberMe = false) => {
    const res = await loginWithEmailPassword(email, password, rememberMe);
    setUser(res.user);
    setToken(res.token);
    return res;
  };

  const handleRegister = async (data) => {
    const res = await registerWithEmailPassword(data);
    setUser(res.user);
    setToken(res.token);
    return res;
  };

  const handleGoogleLogin = async () => {
    const res = await loginWithGoogle();
    setUser(res.user);
    setToken(res.token);
    return res;
  };

  const handleResetPassword = async (email) => {
    return await resetAdminPassword(email);
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setToken(null);
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

