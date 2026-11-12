import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { directoryMiddleware } from "./server/dev-middleware";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const name of ["DATABASE_URL", "POSTGRES_URL"]) {
    if (!process.env[name] && env[name]) process.env[name] = env[name];
  }
  return {
    plugins: [
      react(),
      {
        name: "directory-api",
        configureServer(server) {
          server.middlewares.use(directoryMiddleware);
        },
        configurePreviewServer(server) {
          server.middlewares.use(directoryMiddleware);
        },
      },
    ],
  };
});
