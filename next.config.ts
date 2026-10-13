import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/admin/file-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    // استشارة الترسية تُخرج PDF أيضاً (١٣ أكتوبر): كان المسار الآلي يكتبها ثم يسقط عند الملف
    // «The input directory …/chromium/bin does not exist» — لأن الثنائي لم يُضمَّن إلا لمسارٍ واحد.
    "/api/cron/awards-pipeline": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/admin/awards/gap": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/admin/channel": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
