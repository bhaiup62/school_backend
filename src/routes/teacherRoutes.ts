// src/routes/teacherRoutes.ts

import { Router } from 'express'
import { protect, authorizeRole } from '../middleware/authMiddleware'
import { getProfile, updateProfile } from '../controllers/teacher/profileController'
import { getMyStudents, getStudentDetail, addRemark, getRemarks } from '../controllers/teacher/studentsController'
import { markAttendance, markBulkAttendance, getAttendanceReport } from '../controllers/teacher/attendanceController'
import { enterResult, getStudentResults } from '../controllers/teacher/resultsController'
import { postNotice, getNotices, deleteNotice } from '../controllers/teacher/noticesController'
import { submitLeaveRequest, getMyLeaveRequests } from '../controllers/teacher/leavesController'
import { submitComplaint, getMyComplaints, getComplaintDetail, addComplaintComment } from '../controllers/teacher/complaintsController'
import { getUpcomingEvents } from '../controllers/teacher/eventsController'

const router = Router()

// All teacher routes require auth + teacher role
router.use(protect, authorizeRole('teacher'))

// ── Profile ──────────────────────────────────────────────
router.get  ('/profile', getProfile)
router.patch('/profile', updateProfile)

// ── Students ─────────────────────────────────────────────
router.get('/students',             getMyStudents)       // ?class=9&section=A
router.get('/students/:admissionNumber',        getStudentDetail)

// ── Attendance ───────────────────────────────────────────
router.post('/attendance',      markAttendance)          // single student
router.post('/attendance/bulk', markBulkAttendance)      // whole class
router.get ('/attendance-report', getAttendanceReport)   // ?class=9&section=A&month=3&year=2025

// ── Results ──────────────────────────────────────────────
router.post('/results',                          enterResult)
router.get ('/results/:admissionNumber',         getStudentResults)

// ── Remarks (class teacher only) ─────────────────────────

router.patch('/students/:admissionNumber/remark', addRemark)
router.get('/students/:admissionNumber/remarks', getRemarks) // <--- Add this missing line!

// ── Notices ──────────────────────────────────────────────
router.post  ('/notices',     postNotice)
router.get   ('/notices',     getNotices)
router.delete('/notices/:id', deleteNotice)

// ── Events (read-only) ───────────────────────────────────
router.get('/events', getUpcomingEvents)

// ── Leave Requests ───────────────────────────────────────
router.post('/leave-request',  submitLeaveRequest)
router.get ('/leave-requests', getMyLeaveRequests)

// ── Complaints (submit to principal) ─────────────────────
router.post('/complaints',                         submitComplaint)
router.get ('/complaints',                         getMyComplaints)
router.get ('/complaints/:ticketNumber',           getComplaintDetail)
router.post('/complaints/:ticketNumber/comments',  addComplaintComment)

export default router
