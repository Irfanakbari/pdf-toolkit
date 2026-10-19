import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/pdf-tools",
  assetPrefix: "/pdf-tools",
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
