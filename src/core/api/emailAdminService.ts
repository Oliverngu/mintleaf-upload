import { auth } from '../firebase/config';
import { EmailConfig, EmailServiceId, TemplateKey } from '../models/data';

const getBaseUrl = (): string => {
    // This is the stable URL for the gen2 cloud function.
    // The gcloud command might return a temporary or revision-specific URL.
    // Using this as a reliable default.
    const defaultUrl = "https://europe-central2-mintleaf-74d27.cloudfunctions.net/admin";

    // In a local dev environment (like Vite), process.env.VITE_EMAIL_ADMIN_BASE might be available.
    // In some production/staging environments, a global ENV object might be injected.
    const envVar = (globalThis as any).ENV?.VITE_EMAIL_ADMIN_BASE || process.env.VITE_EMAIL_ADMIN_BASE;

    if (envVar) {
        console.log("Using Email Admin Service BASE_URL from ENV:", envVar);
        return envVar;
    }
    
    return defaultUrl;
};

const BASE_URL = getBaseUrl();
// For debugging purposes, it's useful to log the final URL being used.
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
