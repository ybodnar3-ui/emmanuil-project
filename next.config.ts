import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow multipart avatar uploads up to ~6MB (just above MAX_AVATAR_BYTES in
      // src/server/storage.ts) so large submissions surface our own size error
      // instead of the framework's default 1MB body-parser error.
      bodySizeLimit: "6mb",
    },
  },
};

export default withNextIntl(nextConfig);
