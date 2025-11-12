import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
// FIX: Aliased 'firebase-admin' to 'fbAdmin' to avoid naming conflict with the exported 'admin' function at the end of the file.
import * as fbAdmin from "firebase-admin";
import * as express from "express";
import * as cors from "cors";
import { Resend } from 'resend';

// Initialization
try {
    fbAdmin.initializeApp();
} catch (e) {
    logger.info("Firebase app already initialized.");
}

const db = fbAdmin.firestore();
const app = express();
// FIX: Cast middleware to 'any' to resolve 'No overload matches this call' error due to type conflicts.
app.use(cors({ origin: true }) as any);
// FIX: Cast middleware to 'any' to resolve 'No overload matches this call' error.
app.use(express.json() as any);

// --- UTILS ---
const mustache = (template: string, data: Record<string, any>): string => {
  if (!template) return "";
  let rendered = template;
  for (const key in data) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    rendered = rendered.replace(regex, String(data[key] ?? ''));
  }
  return rendered;
};

// --- MIDDLEWARE ---
// FIX: Use 'any' for req and res to bypass type errors on properties like .headers and .status.
const authGuard = (allowedRoles: string[]) => async (req: any, res: any, next: express.NextFunction) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send({ error: 'Unauthorized: No token provided' });
    }
    try {
        const decodedToken = await fbAdmin.auth().verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        const userRole = userDoc.exists ? userDoc.data()?.role : '';
        
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).send({ error: 'Forbidden: Insufficient permissions' });
        }
        (req as any).user = { ...decodedToken, role: userRole };
        next();
    } catch (error) {
        logger.error("Token verification failed:", error);
        return res.status(401).send({ error: 'Unauthorized: Invalid token' });
    }
};

const getFeatureFlag = async (flag: string): Promise<boolean> => {
    const doc = await db.collection('appFlags').doc('email').get();
    return doc.exists && doc.data()?.[flag] === true;
};

const logAudit = (userId: string, serviceId: string, details: string, diff: any) => {
    db.collection('emailAudits').add({
        userId,
        serviceId,
        details,
        diff,
        timestamp: fbAdmin.firestore.FieldValue.serverTimestamp(),
    }).catch(err => logger.error("Failed to write audit log:", err));
};


// --- ROUTES ---

// GET /email-config/:serviceId
app.get('/email-config/:serviceId', authGuard(['Admin']), async (req, res) => {
    try {
        const { serviceId } = req.params;
        const configDoc = await db.collection('emailConfigs').doc(serviceId).get();
        const writeEnabled = await getFeatureFlag('writeEnabled');

        const docData = configDoc.data() || {};
        
        const config = {
            enabled: docData.enabled ?? false,
            fromAddress: docData.fromAddress ?? "",
            replyTo: docData.replyTo || "",
            bcc: docData.bcc || [],
            subjectTemplates: (docData.subjectTemplates && typeof docData.subjectTemplates === 'object' && docData.subjectTemplates !== null)
                ? docData.subjectTemplates
                : {},
            bodyTemplates: (docData.bodyTemplates && typeof docData.bodyTemplates === 'object' && docData.bodyTemplates !== null)
                ? docData.bodyTemplates
                : {},
        };

        res.status(200).json({ config, writeEnabled });
    } catch (error) {
        logger.error("GET /email-config failed:", error);
        res.status(500).send({ error: 'Internal Server error.' });
    }
});

// PUT /email-config/:serviceId
app.put('/email-config/:serviceId', authGuard(['Admin']), async (req, res) => {
    try {
        const user = (req as any).user;
        const writeEnabled = await getFeatureFlag('writeEnabled');
        if (!writeEnabled) {
            return res.status(403).send({ message: 'Forbidden: Write operations are disabled by feature flag.' });
        }
        
        const { serviceId } = req.params;
        const newConfig = req.body;
        
        const configRef = db.collection('emailConfigs').doc(serviceId);
        const oldConfigDoc = await configRef.get();
        const oldConfig = oldConfigDoc.data();

        await configRef.set(newConfig, { merge: true });

        logAudit(user.uid, serviceId, `Updated configuration for ${serviceId}`, { before: oldConfig, after: newConfig });
        
        res.status(200).json({ message: 'Configuration updated successfully.' });
    } catch (error) {
        logger.error("PUT /email-config failed:", error);
        res.status(500).send({ message: 'Internal server error.' });
    }
});

// POST /email-test
app.post('/email-test', authGuard(['Admin']), async (req, res) => {
    try {
        const { serviceId, templateKey, to, samplePayload } = req.body;

        const configDoc = await db.collection('emailConfigs').doc(serviceId).get();
        if (!configDoc.exists) {
            return res.status(404).send({ message: 'Configuration for this service not found.' });
        }
        const config = configDoc.data()!;

        const subjectTemplate = config.subjectTemplates[templateKey] || '';
        const bodyTemplate = config.bodyTemplates[templateKey] || '';

        const compiledSubject = mustache(subjectTemplate, samplePayload);
        const compiledHtml = mustache(bodyTemplate, samplePayload);
        
        const writeEnabled = await getFeatureFlag('writeEnabled');
        const isDryRun = !writeEnabled;

        if (!isDryRun) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const { data, error } = await resend.emails.send({
                from: config.fromAddress || process.env.RESEND_FROM_DEFAULT,
                to: to,
                subject: compiledSubject,
                html: compiledHtml,
                // FIX: Corrected property name from 'reply_to' to 'replyTo'.
                replyTo: config.replyTo || undefined,
                bcc: config.bcc || undefined,
            });

            if (error) {
                logger.error("Resend API error:", error);
                return res.status(500).json({ message: 'Failed to send test email.', error: error.message });
            }
        }
        
        res.status(200).json({
            message: isDryRun ? 'Test email simulated (dry run).' : 'Test email sent successfully.',
            dryRun: isDryRun,
            compiled: { subject: compiledSubject, html: compiledHtml },
        });

    } catch (error) {
        logger.error("POST /email-test failed:", error);
        res.status(500).send({ message: 'Internal server error.' });
    }
});

// Health check for Resend API key and default FROM address
// FIX: Use 'any' for req and res to bypass type errors.
export const resendHealth = onRequest({ secrets: ["RESEND_API_KEY", "RESEND_FROM_DEFAULT"] }, async (req: any, res: any) => {
    logger.info("Health check requested");
    const { to } = req.query;
    if (!to || typeof to !== 'string') {
        res.status(400).send("Please provide a 'to' query parameter, e.g., ?to=test@example.com");
        return;
    }

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_DEFAULT!,
            to: to,
            subject: 'MintLeaf Health Check',
            html: '<strong>This is a test email from the MintLeaf backend.</strong>',
        });

        if (error) {
            logger.error("Resend health check failed:", error);
            res.status(500).json(error);
        } else {
            res.status(200).json(data);
        }
    } catch (e) {
        logger.error("Exception during health check:", e);
        res.status(500).send("An unexpected error occurred.");
    }
});

// FIX: Cast Express app to 'any' to resolve type mismatch with onRequest handler.
export const admin = onRequest({ maxInstances: 10, secrets: ["RESEND_API_KEY", "RESEND_FROM_DEFAULT"] }, app as any);