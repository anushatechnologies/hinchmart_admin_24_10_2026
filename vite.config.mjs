import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const mainTarget = (env.VITE_API_BASE_URL || env.VITE_API_URL || "https://api.hinchmart.com")
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
  const expressTarget = env.VITE_EXPRESS_API_BASE_URL || env.EXPRESS_API_URL;

  const proxyConfig = {};

  if (expressTarget) {
    const cleanExpress = expressTarget.replace(/\/+$/, "").replace(/\/api$/, "");
    proxyConfig["/api/v1/admin/rider-"] = {
      target: cleanExpress,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, "/api"),
    };
    proxyConfig["/api/v1/dispatcher"] = {
      target: cleanExpress,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, "/api"),
    };
  }

  proxyConfig["/api"] = {
    target: mainTarget,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, "/api"),
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        proxyReq.removeHeader("origin");
        proxyReq.removeHeader("referer");
      });
    },
  };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      watch: {
        usePolling: true,
        interval: 1000,
        ignored: ["**/vite.config.js"],
      },
      proxy: proxyConfig,
    },
  };
});
