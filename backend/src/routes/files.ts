




import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
// FIX: Add url and fileURLToPath to define __dirname in ES modules
import { fileURLToPath } from 'url';
import { protect } from '../middleware/auth';
import { ApiError } from '../utils/errors';
import { hasUnitAccess } from '../middleware/auth';
import { db } from '../services/db'; // Mock DB

// FIX: Define __dirname for ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// --- Configuration for Multer (File Uploads) ---
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
// In a CommonJS environment (which this project is configured for), __dirname is globally available.
const UPLOAD_PATH = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: express.Request, file: multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_PATH);
  },
  filename: (req: express.Request, file: multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Rename file with a UUID to prevent filename conflicts and directory traversal attacks
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req: express.Request, file: multer.File, cb: multer.FileFilterCallback) => {
    // Validate MIME type
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Invalid file type. Only PDF, PNG, JPG, and DOCX are allowed.') as any);
    }
  },
});

/**
 * POST /api/files/upload
 * Upload a file. Requires authentication.
 */
// FIX: Cast middleware to 'any' to resolve type overload errors.
router.post('/upload', protect as any, upload.single('document'), async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'No file uploaded.'));
  }
  
  // Here you would save file metadata to your database
  // const { unitId } = req.body;
  // if (!hasUnitAccess(req.user, unitId)) { ... }
  
  console.log('File uploaded:', req.file);
  // Example: await db.file.create({ ... });

  res.status(201).json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    path: req.file.path,
  });
});

/**
 * GET /api/files/download/:fileId
 * Securely download a file.
 */
// FIX: Cast middleware to 'any' to resolve type overload errors.
router.get('/download/:fileId', protect as any, async (req, res, next) => {
    try {
        const fileId = req.params.fileId;
        
        // 1. Fetch file metadata from the database
        const fileMetadata = await db.file.findUnique({ where: { id: fileId } });
        
        if (!fileMetadata) {
            return next(new ApiError(404, 'File not found.'));
        }
        
        // 2. Check if the user has permission to access this file's unit
        if (!hasUnitAccess(req.user, fileMetadata.unitId)) {
            return next(new ApiError(403, 'Forbidden: You do not have access to this file.'));
        }

        const filePath = path.join(UPLOAD_PATH, fileMetadata.storedFilename);
        
        // 3. Check if file exists on disk
        if (!fs.existsSync(filePath)) {
            return next(new ApiError(404, 'File not found on server.'));
        }
        
        // 4. Serve the file for download
        // Content-Disposition: 'attachment' prompts the browser to download the file
        // instead of trying to display it. This prevents potential XSS attacks from SVG or HTML files.
        res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.originalFilename}"`);
        res.setHeader('Content-Type', fileMetadata.mimeType);
        
        res.download(filePath, fileMetadata.originalFilename);

    } catch (error) {
        next(error);
    }
});

export default router;