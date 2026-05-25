import { Router } from 'express'
import { protect, authorizeRole as authorizeRoles } from '../../middleware/authMiddleware'
import {
  getAllStudents,
  getStudentProfile,
  updateStudentProfile,
  deactivateStudent,
  bulkPromoteStudents,
} from '../../controllers/admin/student/studentController'

const router = Router()

router.use(protect, authorizeRoles('admin', 'principal'))

router.get('/', getAllStudents)
router.post('/promote', bulkPromoteStudents)
router.get('/:id', getStudentProfile)
router.patch('/:id', updateStudentProfile)
router.patch('/:id/status', deactivateStudent)

export default router
