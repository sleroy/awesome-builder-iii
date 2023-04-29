/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  ...(process.env.NODE_ENV === "development"
    ? {
        define: {
          global: {},
        },
      }
    : {}),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      ...(process.env.NODE_ENV !== "development"
        ? {
            "./runtimeConfig": "./runtimeConfig.browser", //fix production build
          }
        : {}),
    },
  },
});
