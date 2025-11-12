import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createShiftSchema, updateShiftSchema } from '../validators/shiftValidators';
import { createShift, updateShift } from '../services/shiftService';
import { ApiError } from '../utils/errors';
import { logAuditEvent } from '../services/auditService';
import { AuditAction } from '../services/auditService';

const router = express.Router();

// All shift routes are protected
// FIX: Cast middleware to 'any' to resolve type conflicts in Express router.
router.use(protect as any);

/**
 * POST /api/shifts
 * Create a new shift. Only Admins and Unit Admins can create shifts.
 */
router.post(
  '/',
  // FIX: Cast middleware to 'any' to resolve type conflicts in Express router.
  authorize('Admin', 'Unit Admin') as any,
  validate(createShiftSchema) as any,
  async (req, res, next) => {
    try {
      const newShift = await createShift(req.body, req.user!);
      
      await logAuditEvent({
        userId: req.user!.id,
        action: AuditAction.SHIFT_CREATE,
        details: `Created shift ID ${newShift.id} for user ${newShift.userId}`,
      });

      res.status(201).json(newShift);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/shifts/:id
 * Update an existing shift.
 */
router.put(
  '/:id',
  // FIX: Cast middleware to 'any' to resolve type conflicts in Express router.
  authorize('Admin', 'Unit Admin') as any,
  validate(updateShiftSchema) as any,
  async (req, res, next) => {
    try {
      const shiftId = req.params.id;
      const updatedShift = await updateShift(shiftId, req.body, req.user!);
      
      await logAuditEvent({
        userId: req.user!.id,
        action: AuditAction.SHIFT_EDIT,
        details: `Updated shift ID ${updatedShift.id}`,
      });

      res.status(200).json(updatedShift);
    } catch (error) {
      next(error);
    }
  }
);

export default router;