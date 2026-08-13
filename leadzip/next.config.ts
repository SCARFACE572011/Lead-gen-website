import type { NextConfig } from "next";

// Private app surfaces that must never be indexed. The (dashboard) layout
// is a client component and cannot export robots metadata, so the noindex
// directive is applied here as an X-Robots-Tag response header instead.
const NOINDEX_PATHS = [
  "/dashboard",
  "/search",
  "/saved",
  "/saved-searches",
  "/history",
  "/exports",
  "/settings",
  "/admin",
  "/invite",
  "/auth",
];

const nextConfig: NextConfig = {
  async headers() {
    return NOINDEX_PATHS.flatMap((path) => [
      {
        source: path,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: `${path}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ]);
  },
};

export default nextConfig;
