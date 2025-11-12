import { auth, db } from '../firebase/config';
import { EmailConfig, EmailServiceId, TemplateKey } from '../models/data';

// This is the trigger URL for the `admin` function.
// Dynamically construct the URL based on the Firebase project config.
// const projectConfig = (db.app.options as any);
// const BASE_URL = `https://${projectConfig.locationId}-${projectConfig.projectId}.cloudfunctions.net/admin`;

declare const ENV: any; // Allow access to AI Studio's global ENV

// Sequentially check for the environment variable in Vite, Node.js, AI Studio, and then use a fallback.
const base =
  // FIX: Cast import.meta to any to resolve TypeScript error when accessing 'env'.
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_EMAIL_ADMIN_BASE) ||
  (typeof process !== 'undefined' && process.env?.VITE_EMAIL_ADMIN_BASE) ||
  (typeof ENV !== 'undefined' && ENV?.VITE_EMAIL_ADMIN_BASE) ||
  "https://europe-central2-mintleaf-74d27.cloudfunctions.net/admin";

// Temporary log to test if the value is being read correctly in AI Studio
console.log("EMAIL ADMIN BASE:", base);

const BASE_URL = base;


const getAuthToken = async (): Promise<string> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Authentication token not available.');
    return currentUser.getIdToken();
};

interface GetConfigResponse {
    config: EmailConfig;
    writeEnabled: boolean;
}

export const getEmailConfig = async (serviceId: EmailServiceId): Promise<GetConfigResponse> => {
    const token = await getAuthToken();
    const response = await fetch(`${BASE_URL}/email-config/${serviceId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch email config.');
    }
    return response.json();
};

export const updateEmailConfig = async (serviceId: EmailServiceId, config: Partial<EmailConfig>): Promise<{ message: string }> => {
    const token = await getAuthToken();
    const response = await fetch(`${BASE_URL}/email-config/${serviceId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to update email config.');
    return data;
};

interface TestEmailPayload {
    serviceId: EmailServiceId;
    templateKey: TemplateKey;
    to: string;
    samplePayload: Record<string, any>;
}

interface TestEmailResponse {
    message: string;
    dryRun: boolean;
    compiled: {
        subject: string;
        html: string;
    };
}

export const sendTestEmail = async (payload: TestEmailPayload): Promise<TestEmailResponse> => {
    const token = await getAuthToken();
    const response = await fetch(`${BASE_URL}/email-test`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to send test email.');
    return data;
};
