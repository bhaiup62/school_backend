import { Router } from 'express'
import { protect, authorizeRole as authorizeRoles } from '../../middleware/authMiddleware'
import {
  createExam,
  getActiveExams,
  updateExamStatus,
} from '../../controllers/admin/exam/examController'
import {
  upsertClassSchedule,
  getClassSchedule,
} from '../../controllers/admin/exam/examScheduleController'
import {
  getMarksEntrySheet,
  bulkSaveMarks,
} from '../../controllers/admin/exam/examMarkController'

const router = Router()

router.use(protect, authorizeRoles('admin', 'principal'))

router.post('/', createExam)
router.get('/', getActiveExams)
router.patch('/:examId/status', updateExamStatus)
router.post('/schedule', upsertClassSchedule)
router.get('/schedule/:examId/:classId', getClassSchedule)
router.get('/marks', getMarksEntrySheet)
router.post('/marks', bulkSaveMarks)

export default router
