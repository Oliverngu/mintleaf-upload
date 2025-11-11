// src/core/config/emailConfig.ts
interface EmailProviderConfig {
  provider: "mock" | "resend" | "sendgrid";
  apiKey?: string;
  fromDefault?: string;
}

export const emailProviderConfig: EmailProviderConfig = {
  provider: "resend",
  apiKey: process.env.RESEND_API_KEY,
  fromDefault: "noreply@mintleaf.app",
  // In the future, this could be:
  // apiKey: process.env.RESEND_API_KEY,
};
