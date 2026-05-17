import { Router } from 'express'
import { protect, authorizeRole } from '../../middleware/authMiddleware'
import {
  createSession,
  getAllSessions,
  getSessionById,
  updateSessionStatus,
  addTermToSession,
  toggleAdmissionStatus,
  rolloverSession,
} from '../../controllers/admin/academics/academicSessionController'
import {
  createEvent,
  getEventsBySession,
  deleteEvent,
} from '../../controllers/admin/academics/calendarController'
import {
  upsertClassTimetable,
  getAdminClassTimetable,
} from '../../controllers/admin/academics/timetableController'

const router = Router()

router.use(protect, authorizeRole('admin'))

router.post('/sessions', createSession)
router.get('/sessions', getAllSessions)
router.get('/sessions/:id', getSessionById)
router.patch('/sessions/:id/status', updateSessionStatus)
router.post('/sessions/:id/terms', addTermToSession)
router.patch('/sessions/:id/admissions', toggleAdmissionStatus)
router.post('/sessions/rollover', rolloverSession)

router.post('/calendar/events', createEvent)
router.get('/calendar/events/session/:sessionId', getEventsBySession)
router.delete('/calendar/events/:id', deleteEvent)
router.post('/timetable', upsertClassTimetable)
router.get('/timetable/:classId', getAdminClassTimetable)

export default router
