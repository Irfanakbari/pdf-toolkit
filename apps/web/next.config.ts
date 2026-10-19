import type { NextConfig } from "next"

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://api:8000"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/pdf-tools",
  assetPrefix: "/pdf-tools",
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/backend/:path*",
          destination: `${apiProxyTarget}/:path*`,
        },
      ],
    }
  },
  async redirects() {
    return [
      {
        source: "/tools/rotate-pdf",
        destination: "/tools/organize",
        permanent: true,
      },
      {
        source: "/tools/delete-pages",
        destination: "/tools/organize",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
