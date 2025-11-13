// This file extends the Express Request interface to include our custom 'user' property.
// This avoids TypeScript errors when we attach the authenticated user to the request object.

import * as multer from 'multer';

// Define the user role type for the backend, excluding 'Demo User' as it's mapped to 'Guest'.
type BackendUserRole = 'Admin' | 'Unit Admin' | 'Unit Leader' | 'User' | 'Guest';

declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        role: BackendUserRole;
        unitIds: string[];
      };
      file?: multer.File;
    }
  }
}

// Minimal User type for backend context
export interface User {
  id: string;
  name: string;
  fullName: string;
  email: string;
  role: BackendUserRole;
  unitIds?: string[];
  position?: string;
}
