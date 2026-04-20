// src/routes/receptionistRoutes.ts

import { Router } from 'express'
import { protect, authorizeRole } from '../middleware/authMiddleware'
import { getProfile, updateProfile } from '../controllers/receptionist/profileController'
import {
  getAllStudents,
  getStudentDetail,
  registerStudent,
  updateStudentContact,
} from '../controllers/receptionist/studentController'
import {
  getAllParents,
  getParentDetail,
  registerParent,
  updateParentContact,
  linkChildToParent,
} from '../controllers/receptionist/parentController'
import { getAttendanceReport } from '../controllers/receptionist/attendanceController'
import { getDashboardStats } from '../controllers/receptionist/dashboardController'
import {
  generateBonafideCertificate,
  generateCharacterCertificate,
  submitCertificateRequest,
  getCertificateRequests,
} from '../controllers/receptionist/certificateController'
import { submitLeaveRequest, getMyLeaveRequests } from '../controllers/receptionist/leaveRequestController'

const router = Router()

// All receptionist routes require auth + receptionist role
router.use(protect, authorizeRole('receptionist'))

// ── Profile ──────────────────────────────────────────────
router.get  ('/profile', getProfile)
router.patch('/profile', updateProfile)

// ── Dashboard Stats ──────────────────────────────────────
router.get('/stats', getDashboardStats)

// ── Students ─────────────────────────────────────────────
router.get   ('/students',                      getAllStudents)
router.get   ('/students/:admissionNumber',     getStudentDetail)
router.post  ('/students',                      registerStudent)
router.patch ('/students/:admissionNumber',     updateStudentContact)

// ── Parents ──────────────────────────────────────────────
router.get   ('/parents',                       getAllParents)
router.get   ('/parents/:parentId',             getParentDetail)
router.post  ('/parents',                       registerParent)
router.patch ('/parents/:parentId',             updateParentContact)
router.post  ('/parents/:parentId/link-child',  linkChildToParent)

// ── Attendance (Read-Only) ───────────────────────────────
router.get('/attendance', getAttendanceReport)

// ── Certificates (Generate directly) ─────────────────────
router.post('/certificates/bonafide',  generateBonafideCertificate)
router.post('/certificates/character', generateCharacterCertificate)

// ── Certificate Requests (Submit for Principal approval) ─
router.post('/certificate-requests',  submitCertificateRequest)
router.get ('/certificate-requests',  getCertificateRequests)

// ── Leave Requests ───────────────────────────────────────
router.post('/leave-requests',  submitLeaveRequest)
router.get ('/leave-requests',  getMyLeaveRequests)

export default router
