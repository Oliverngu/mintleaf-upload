import express, { Express, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { loginLimiter } from './middleware/rateLimiter';
import { ApiError } from './utils/errors';

// Import routes
import shiftRoutes from './routes/shifts';
import fileRoutes from './routes/files';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// --- Core Middleware ---
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet());
// Enable CORS for all routes
app.use(cors());
// Body parsing middleware
// FIX: Cast middleware to 'any' to resolve 'No overload matches this call' error.
app.use(express.json() as any);
// FIX: Cast middleware to 'any' to resolve 'No overload matches this call' error.
app.use(express.urlencoded({ extended: true }) as any);

// --- Routes ---
// FIX: Use 'any' for req and res to bypass type errors on properties like .send.
app.get('/', (req: any, res: any) => {
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
// FIX: Use 'any' for req and res to prevent type errors.
app.use((req: any, res: any, next: NextFunction) => {
  next(new ApiError(404, 'Endpoint not found'));
});

// Global error handler
// FIX: Use 'any' for req and res to bypass type errors on properties like .status.
app.use((err: any, req: any, res: any, next: NextFunction) => {
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