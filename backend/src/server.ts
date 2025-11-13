


import express from 'express';
// FIX: Use type-only imports for express types to avoid conflicts.
// Changed to regular import to fix type resolution issues.
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ApiError } from './utils/errors';

// Import routes
import shiftRoutes from './routes/shifts';
import fileRoutes from './routes/files';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Core Middleware ---
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet());
// Enable CORS for all routes
app.use(cors());
// Body parsing middleware
// FIX: Correctly use express middleware without causing overload errors.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Routes ---
app.get('/', (req, res) => {
  res.send('MintLeaf Backend is running!');
});

// Apply rate limiting to login routes (example)
// app.use('/api/auth/login', loginLimiter);

// App routes
app.use('/api/shifts', shiftRoutes);
app.use('/api/files', fileRoutes);
// Add other routes here (e.g., users, requests, etc.)

// --- Error Handling ---
// Handle 404 Not Found
app.use((req, res, next) => {
  next(new ApiError(404, 'Endpoint not found'));
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      message: err.message,
      errors: err.errors,
    });
  }
  return res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});