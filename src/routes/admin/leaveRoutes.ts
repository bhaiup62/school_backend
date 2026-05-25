import { Router } from 'express'
import { protect, authorizeRole as authorizeRoles } from '../../middleware/authMiddleware'
import {
  getAllLeaveRequests,
  updateLeaveStatus,
  getStaffOnLeaveToday,
  getLeaveBalances,
} from '../../controllers/admin/leave/leaveController'

const router = Router()

router.use(protect, authorizeRoles('admin', 'principal'))

router.get('/requests', getAllLeaveRequests)
router.patch('/requests/:id/status', updateLeaveStatus)
router.get('/today', getStaffOnLeaveToday)
router.get('/balances', getLeaveBalances)

export default router
