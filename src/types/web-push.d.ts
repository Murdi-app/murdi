// تعريف حزمة web-push.
//
// الحزمة تُشحن بجافاسكربت بلا تعريفات أنواع، و TypeScript يرفض البناء عند
// أي `import('web-push')` مهما كان القالب الذي تضعه عليه — لأن العطل في
// حلّ المسار نفسه لا في نوع القيمة. جرّبتُ الوصف المحلي داخل الدالة فسقط
// البناء مرة ثانية، والرسالة نفسها تقول الحل: ملفُّ تعريفٍ للوحدة.
//
// وهذا الملف يصف ما نستعمله فقط — دالتان — بلا تثبيت حزمة تعريفات إضافية.

declare module 'web-push' {
  export interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
  }

  export interface PushSubscriptionLike {
    endpoint: string;
    keys: PushSubscriptionKeys;
  }

  export interface SendOptions {
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
    headers?: Record<string, string>;
  }

  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;

  export function sendNotification(
    subscription: PushSubscriptionLike,
    payload?: string | Buffer | null,
    options?: SendOptions
  ): Promise<SendResult>;

  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };
  export default webpush;
}
