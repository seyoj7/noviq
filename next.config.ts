import type { NextConfig } from "next";

// Backend API routes to proxy
const BACKEND_ROUTES = [
  "/health",
  "/services",
  "/auth/:path*",
  "/run-service",
  "/run",
  "/transactions/:path*",
  "/wallet",
  "/wallet/:path*",
  "/api-keys/:path*",
  "/docs",
  "/redoc",
  "/openapi.json",
];

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.VERCEL === "1") {
      return [
        {
          source: "/api-keys",
          has: [{ type: "header", key: "content-type" }],
          destination: "/api/api-keys",
        },
        {
          source: "/api-keys",
          has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
          destination: "/api/api-keys",
        },
        ...BACKEND_ROUTES.map((route) => ({
          source: route,
          destination: `/api${route}`,
        })),
      ];
    }

    const localBackend = process.env.BACKEND_URL || "http://127.0.0.1:8000";

    return [
      {
        source: "/api-keys",
        has: [{ type: "header", key: "content-type" }],
        destination: `${localBackend}/api-keys`,
      },
      {
        source: "/api-keys",
        has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
        destination: `${localBackend}/api-keys`,
      },
      ...BACKEND_ROUTES.map((route) => ({
        source: route,
        destination: `${localBackend}${route}`,
      })),
      {
        source: "/api/:path*",
        destination: `${localBackend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
