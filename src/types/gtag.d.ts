// وسم جوجل للإعلانات مُحمَّل في <head> بالتخطيط الجذر (src/app/layout.tsx)،
// فـ`window.gtag` موجودةٌ في المتصفّح ولا يعرفها TypeScript. هذا تعريفها.
export {};

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js' | 'set',
      targetOrEvent: string | Date,
      params?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}
