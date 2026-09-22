import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// In local development, proxy to local FastAPI server on port 8000.
// In Vercel / production, route to the Vercel Python serverless function under /api.
const BACKEND_DESTINATION =
  process.env.BACKEND_URL || (isDev ? "http://127.0.0.1:8000" : "/api");

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
];

function getDestination(route: string): string {
  return `${BACKEND_DESTINATION}${route}`;
}

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Prioritize API requests for /api-keys before Next.js resolves the /api-keys page
      beforeFiles: [
        {
          source: "/api-keys",
          has: [{ type: "header", key: "content-type" }],
          destination: getDestination("/api-keys"),
        },
        {
          source: "/api-keys",
          has: [{ type: "header", key: "accept", value: ".*application/json.*" }],
          destination: getDestination("/api-keys"),
        },
      ],
      afterFiles: [
        {
          source: "/documentation.html",
          destination: "/docs",
        },
        ...BACKEND_ROUTES.map((route) => ({
          source: route,
          destination: getDestination(route),
        })),
        ...(isDev
          ? [
              {
                source: "/api/:path*",
                destination: `${BACKEND_DESTINATION}/api/:path*`,
              },
            ]
          : []),
      ],
    };
  },
};

export default nextConfig;
