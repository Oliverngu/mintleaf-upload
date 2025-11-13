import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as fbAdmin from "firebase-admin";
import express, { Request as ExpressRequest, Response, NextFunction, Router } from "express";
import cors from "cors";
import { Resend } from 'resend';

// Custom Request interface to include the user property
type Request = ExpressRequest & {
  user?: {
    id: string;
    role: string;
    unitIds: string[];
  };
};

// Initialization
try {
  fbAdmin.initializeApp();
} catch (e) {
  // Firebase app already initialized
}
const db = fbAdmin.firestore();
const app = express();
const router = Router();

// --- Core Middleware ---
app.use(cors({ origin: true }));
app.use(express.json());

// --- Utils ---
const mustache = (template: string, data: Record<string, any>): string => {
  if (!template) return "";
  let rendered = template;
  for (const key in data) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    rendered = rendered.replace(regex, String(data[key] ?? ''));
  }
  return rendered;
};

// --- Auth Middleware ---
const authGuard = (allowedRoles: string[]) => async (req: Request, res: Response, next: NextFunction) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        logger.warn('Auth guard failed: No token provided.');
        return res.status(401).send({ error: 'Unauthorized: No token provided' });
    }
    try {
        const decodedToken = await fbAdmin.auth().verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        const userRole = userDoc.exists ? userDoc.data()?.role : '';
        
        if (!userRole || !allowedRoles.includes(userRole)) {
            logger.warn(`Auth guard failed: User ${decodedToken.uid} with role '${userRole}' is not in allowed roles [${allowedRoles.join(', ')}].`);
            return res.status(403).send({ error: 'Forbidden: Insufficient permissions' });
        }
        
        req.user = { 
            id: decodedToken.uid,
            role: userRole,
            unitIds: userDoc.data()?.unitIds || [],
        };
        next();
    } catch (error) {
        logger.error("Auth guard failed: Token verification error.", error);
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

// --- Routes ---
router.get("/", (req: Request, res: Response) => {
    logger.info("Health check request received at router root.");
    res.status(200).send("Admin function is alive!");
});

router.get('/email-config/:serviceId', authGuard(['Admin']), async (req: Request, res: Response) => {
    try {
        const { serviceId } = req.params;
        const configDoc = await db.collection('emailConfigs').doc(serviceId).get();
        const writeEnabled = await getFeatureFlag('writeEnabled');
        
        if (!configDoc.exists) {
            return res.status(404).json({ error: 'Config not found' });
        }
        
        const docData = configDoc.data() || {};
        const config = {
            id: configDoc.id,
            enabled: docData.enabled ?? false,
            fromAddress: docData.fromAddress ?? "",
            replyTo: docData.replyTo || "",
            bcc: docData.bcc || [],
            subjectTemplates: docData.subjectTemplates || {},
            bodyTemplates: docData.bodyTemplates || {},
        };

        res.status(200).json({ config, writeEnabled });
    } catch (error) {
        logger.error(`GET /email-config/${req.params.serviceId} failed:`, error);
        res.status(500).send({ error: 'Internal Server Error.' });
    }
});

router.put('/email-config/:serviceId', authGuard(['Admin']), async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).send({ message: 'Authentication error.' });
    
    const writeEnabled = await getFeatureFlag('writeEnabled');
    if (!writeEnabled) {
        return res.status(403).send({ message: 'Forbidden: Write operations are disabled.' });
    }
    
    try {
        const { serviceId } = req.params;
        const newConfig = req.body;
        
        const configRef = db.collection('emailConfigs').doc(serviceId);
        const oldConfigDoc = await configRef.get();
        const oldConfig = oldConfigDoc.data();

        await configRef.set(newConfig, { merge: true });

        logAudit(req.user.id, serviceId, `Updated configuration for ${serviceId}`, { before: oldConfig, after: newConfig });
        
        res.status(200).json({ message: 'Configuration updated successfully.' });
    } catch (error) {
        logger.error(`PUT /email-config/${req.params.serviceId} failed:`, error);
        res.status(500).send({ message: 'Internal server error.' });
    }
});

router.post('/email-test', authGuard(['Admin']), async (req: Request, res: Response) => {
    try {
        const { serviceId, templateKey, to, samplePayload } = req.body;
        logger.info(`Processing /email-test for service: ${serviceId}, template: ${templateKey}`);

        const configDoc = await db.collection('emailConfigs').doc(serviceId).get();
        if (!configDoc.exists) {
            return res.status(404).send({ message: 'Configuration for this service not found.' });
        }
        const config = configDoc.data()!;

        const subjectTemplate = config.subjectTemplates?.[templateKey] || '';
        const bodyTemplate = config.bodyTemplates?.[templateKey] || '';

        const compiledSubject = mustache(subjectTemplate, samplePayload);
        const compiledHtml = mustache(bodyTemplate, samplePayload);
        
        const writeEnabled = await getFeatureFlag('writeEnabled');
        const isDryRun = !writeEnabled;
        
        if (!isDryRun) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const { data, error } = await resend.emails.send({
                from: config.fromAddress || process.env.RESEND_FROM_DEFAULT!,
                to: to,
                subject: compiledSubject,
                html: compiledHtml,
                replyTo: config.replyTo || undefined,
                bcc: config.bcc || undefined,
            });

            if (error) {
                logger.error("Resend API error:", error);
                return res.status(500).json({ message: 'Failed to send test email.', error: error.message });
            }
             logger.info("Resend API success:", data);
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

// Use the router for all routes
app.use('/', router);

// Main function export
export const admin = onRequest({ maxInstances: 10, secrets: ["RESEND_API_KEY", "RESEND_FROM_DEFAULT"] }, app);

// Separate health check function (can be removed if not needed, but good for simple verification)
export const resendHealth = onRequest({ secrets: ["RESEND_API_KEY", "RESEND_FROM_DEFAULT"] }, async (req, res) => {
    const { to } = req.query;
    if (!to || typeof to !== 'string') {
        res.status(400).send("Provide a 'to' query parameter.");
        return;
    }
    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_DEFAULT!,
            to: to,
            subject: 'MintLeaf Health Check',
            html: '<strong>This is a test email.</strong>',
        });
        if (error) {
            res.status(500).json(error);
        } else {
            res.status(200).json(data);
        }
    } catch (e) {
        res.status(500).send("An unexpected error occurred.");
    }
});
