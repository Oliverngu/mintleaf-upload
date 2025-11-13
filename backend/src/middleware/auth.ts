

// FIX: Use RequestHandler type to ensure correct type inference for req, res, and next.
// Changed to regular import to fix type resolution issues.
import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/errors';
import { User } from '../types/express.d'; // Using our defined user type

// The role from the JWT can be 'Demo User', but the backend user role will be 'Guest'
type JwtRole = User['role'] | 'Demo User';

interface JwtPayload {
  id: string;
  role: JwtRole;
  unitIds: string[];
}

/**
 * Middleware to verify JWT token and attach user to the request object.
 * This should be used on all protected routes.
 */
// FIX: Use RequestHandler type to ensure correct type inference for req, res, and next.
export const protect: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Unauthorized: No token provided'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = {
      id: decoded.id,
      role: (decoded.role === "Demo User" ? "Guest" : decoded.role) as User['role'],
      unitIds: decoded.unitIds,
    };
    next();
  } catch (error) {
    return next(new ApiError(401, 'Unauthorized: Invalid token'));
  }
};

/**
 * Middleware factory to authorize requests based on user roles.
 * @param allowedRoles - An array of roles that are allowed to access the route.
 * @example router.post('/', protect, authorize('Admin', 'Unit Admin'), createShift);
 */
// FIX: Return a RequestHandler to ensure correct type inference.
export const authorize = (...allowedRoles: User['role'][]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden: You do not have permission to perform this action'));
    }
    next();
  };
};

/**
 * Higher-order function to ensure a user has access to a specific unit.
 * Should be used within controllers/services after `protect` middleware.
 * Global Admins always have access.
 * @param user - The authenticated user from req.user.
 * @param unitId - The ID of the unit being accessed.
 */
export const hasUnitAccess = (user: Express.Request['user'], unitId: string): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  return user.unitIds.includes(unitId);
};