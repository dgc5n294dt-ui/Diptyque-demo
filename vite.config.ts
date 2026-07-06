import type { IncomingMessage, ServerResponse } from "node:http";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload, null, 2));
}

function qaApiPlugin(): Plugin {
  return {
    name: "diptyque-qa-api",
    configureServer(server) {
      server.middlewares.use("/api/ask", async (request: IncomingMessage, response: ServerResponse) => {
        try {
          const { handleAskRequest } = await import("./server/ask.js");
          await handleAskRequest(request, response);
        } catch (error) {
          writeJson(response, 500, {
            error: "failed_to_handle_ask_request",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
}

export default defineConfig({
  base: "/Diptyque-demo/",
  plugins: [react(), qaApiPlugin()],
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
});