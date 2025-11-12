import { auth } from '../firebase/config';
import { EmailConfig, EmailServiceId, TemplateKey } from '../models/data';

/**
 * Determines the correct base URL for the email admin service by checking various environments.
 * @returns {string} The resolved base URL.
 */
function getBaseUrl(): string {
    // 1. AI Studio (most explicit check based on user feedback)
    if (typeof globalThis !== 'undefined' && (globalThis as any).ENV?.VITE_EMAIL_ADMIN_BASE) {
        console.log("Using VITE_EMAIL_ADMIN_BASE from globalThis.ENV object.");
        return (globalThis as any).ENV.VITE_EMAIL_ADMIN_BASE;
    }
    // 2. Vite build environment
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_EMAIL_ADMIN_BASE) {
        console.log("Using VITE_EMAIL_ADMIN_BASE from import.meta.env.");
        return (import.meta as any).env.VITE_EMAIL_ADMIN_BASE;
    }
    // 3. Node.js environment
    if (typeof process !== 'undefined' && process.env?.VITE_EMAIL_ADMIN_BASE) {
        console.log("Using VITE_EMAIL_ADMIN_BASE from process.env.");
        return process.env.VITE_EMAIL_ADMIN_BASE;
    }
    // 4. Fallback to hardcoded URL
    console.log("Using hardcoded fallback URL for email admin service.");
    return "https://europe-central2-mintleaf-74d27.cloudfunctions.net/admin";
}

const BASE_URL = getBaseUrl();

// Temporary log to test the final resolved value in AI Studio
console.log("Final Email Admin Service BASE_URL:", BASE_URL);


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
        mode: 'cors',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch email config.');
        } catch (jsonError) {
            // If the error response itself is not JSON (e.g., HTML error page)
            throw new Error(`Failed to fetch email config. Status: ${response.status}. The server did not return a valid JSON error.`);
        }
    }
    return response.json();
};

export const updateEmailConfig = async (serviceId: EmailServiceId, config: Partial<EmailConfig>): Promise<{ message: string }> => {
    const token = await getAuthToken();
    const response = await fetch(`${BASE_URL}/email-config/${serviceId}`, {
        method: 'PUT',
        mode: 'cors',
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
        mode: 'cors',
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
