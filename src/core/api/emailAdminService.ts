import { auth } from '../firebase/config';
import { EmailConfig, EmailServiceId, TemplateKey } from '../models/data';

// This URL is for the deployed Firebase Cloud Function for the admin backend.
const BASE_URL = "https://admin-7n7vr5ep5a-lm.a.run.app";

// For debugging purposes, it's useful to log the final URL being used.
console.log("Using Email Admin Service BASE_URL:", BASE_URL);


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
        let errorMessage = `Failed to fetch email config. Status: ${response.status}.`;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (e) { /* Ignore JSON parsing error on invalid JSON */ }
        }
        throw new Error(errorMessage);
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
    if (!response.ok) throw new Error(data.error || data.message || 'Failed to update email config.');
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
    
    if (!response.ok) {
        let errorMessage = `Failed to send test email. Server responded with status ${response.status}.`;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
             try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (jsonError) {
                // The response claimed to be JSON but wasn't, stick with the status message.
            }
        }
        throw new Error(errorMessage);
    }

    return response.json();
};