import { Router } from 'express'
import { protect, authorizeRole } from '../middleware/authMiddleware'
import { getProfile, updateProfile } from '../controllers/student/profileController'
import { getResults } from '../controllers/student/resultController'
import { getAttendance } from '../controllers/student/attendanceController'
import { getNotices } from '../controllers/student/noticeController'
import { getTimetable } from '../controllers/student/timetableController'
import { getEvents } from '../controllers/student/eventController'

const router = Router()

// All student routes are protected — student role only
router.use(protect)
router.use(authorizeRole('student'))

// GET    /api/student/profile
// PATCH  /api/student/profile
router.get('/profile', getProfile)
router.patch('/profile', updateProfile)

// GET /api/student/results?examType=half_yearly&session=2024-25
router.get('/results', getResults)

// GET /api/student/attendance?month=3&year=2025
router.get('/attendance', getAttendance)

// GET /api/student/notices
router.get('/notices', getNotices)

// GET /api/student/timetable
router.get('/timetable', getTimetable)

// GET /api/student/events
router.get('/events', getEvents)

export default router
