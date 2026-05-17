import { Router } from 'express'
import { protect, authorizeRole } from '../../middleware/authMiddleware'

import {
  createStaffMember,
  getStaffMembers,
  updateStaff,
  deactivateStaff,
} from '../../controllers/admin/staff/staffController';
const router = Router()

router.use(protect, authorizeRole('admin'))
router.get('/', getStaffMembers);

router.post('/', createStaffMember)
router.patch('/:id', updateStaff)
router.patch('/:id/deactivate', deactivateStaff)

export default router
