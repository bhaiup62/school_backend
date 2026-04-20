// src/routes/parentRoutes.ts

import { Router } from 'express'
import { protect, authorizeRole } from '../middleware/authMiddleware'
import { getParentProfile } from '../controllers/parent/profileController'
import {
  getChildren,
  getChildProfile,
  getChildResults,
  getChildAttendance,
  getChildTimetable,
} from '../controllers/parent/childrenController'
import { getNotices } from '../controllers/parent/noticesController'
import { getUpcomingEvents } from '../controllers/parent/eventsController'
import {
  submitComplaint,
  getMyComplaints,
  getComplaintDetail,
  addComplaintComment,
} from '../controllers/parent/complaintsController'

const router = Router()

// All parent routes — protected, parent role only
router.use(protect)
router.use(authorizeRole('parent'))

// GET /api/parent/profile
router.get('/profile', getParentProfile)

// GET /api/parent/children  → list all children
router.get('/children', getChildren)

// GET /api/parent/children/:admissionNumber/profile
router.get('/children/:admissionNumber/profile', getChildProfile)

// GET /api/parent/children/:admissionNumber/results
router.get('/children/:admissionNumber/results', getChildResults)

// GET /api/parent/children/:admissionNumber/attendance
router.get('/children/:admissionNumber/attendance', getChildAttendance)

// GET /api/parent/children/:admissionNumber/timetable
router.get('/children/:admissionNumber/timetable', getChildTimetable)

// GET /api/parent/notices
router.get('/notices', getNotices)

// GET /api/parent/events
router.get('/events', getUpcomingEvents)

// ── Complaints (submit to principal) ─────────────────────
router.post('/complaints',                         submitComplaint)
router.get ('/complaints',                         getMyComplaints)
router.get ('/complaints/:ticketNumber',           getComplaintDetail)
router.post('/complaints/:ticketNumber/comments',  addComplaintComment)

export default router
