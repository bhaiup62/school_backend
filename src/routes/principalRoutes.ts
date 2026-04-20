// src/routes/principalRoutes.ts
// All routes for the Principal role

import { Router } from 'express'
import { protect, authorizeRole } from '../middleware/authMiddleware'

// Import all controllers
import * as dashboard from '../controllers/principal/dashboardController'
import * as students from '../controllers/principal/studentsController'
import * as teachers from '../controllers/principal/teachersController'
import * as attendance from '../controllers/principal/attendanceController'
import * as results from '../controllers/principal/resultsController'
import * as notices from '../controllers/principal/noticesController'
import * as approvals from '../controllers/principal/approvalsController'
import * as reports from '../controllers/principal/reportsController'
import * as discipline from '../controllers/principal/disciplineController'
import * as curriculum from '../controllers/principal/curriculumController'
import * as complaints from '../controllers/principal/complaintsController'
import * as events from '../controllers/principal/eventsController'
import * as finance from '../controllers/principal/financeController'
import * as parents from '../controllers/principal/parentsController'

const router = Router()

// All routes require principal role
router.use(protect, authorizeRole('principal'))

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════
router.get('/profile', dashboard.getProfile)
router.get('/dashboard/stats', dashboard.getDashboardStats)
router.get('/dashboard/class-summary', dashboard.getClassSummary)
router.get('/dashboard/recent-activity', dashboard.getRecentActivity)

// ═══════════════════════════════════════════════════════════
// STUDENTS (View Only)
// ═══════════════════════════════════════════════════════════
router.get('/students', students.getAllStudents)
router.get('/students/toppers', students.getToppers)
router.get('/students/low-attendance', students.getLowAttendanceStudents)
router.get('/students/class/:class', students.getClassStudents)
router.get('/students/:admissionNumber', students.getStudentDetail)
router.get('/students/:admissionNumber/attendance', students.getStudentAttendance)
router.get('/students/:admissionNumber/results', students.getStudentResults)

// ═══════════════════════════════════════════════════════════
// PARENTS (View Only)
// ═══════════════════════════════════════════════════════════
router.get('/parents', parents.getAllParents)
router.get('/parents/:parentId', parents.getParentDetail)

// ═══════════════════════════════════════════════════════════
// TEACHERS
// ═══════════════════════════════════════════════════════════
router.get('/teachers', teachers.getAllTeachers)
router.get('/teachers/unassigned-classes', teachers.getUnassignedClasses)
router.get('/teachers/subject/:subject', teachers.getTeachersBySubject)
router.get('/teachers/class/:class/:section', teachers.getClassTeachers)
router.get('/teachers/:teacherId', teachers.getTeacherDetail)
router.post('/teachers/:teacherId/assign-class', teachers.assignClassTeacher)
router.post('/teachers/:teacherId/remove-class', teachers.removeClassTeacher)

// ═══════════════════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════════════════
router.get('/attendance/today', attendance.getTodayAttendance)
router.get('/attendance/absent-today', attendance.getAbsentToday)
router.get('/attendance/class/:class/:section', attendance.getClassAttendance)
router.get('/attendance/monthly-report', attendance.getMonthlyReport)

// ═══════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════
router.get('/results/analysis', results.getResultAnalysis)
router.get('/results/toppers', results.getAllToppers)
router.get('/results/failed-students', results.getFailedStudents)
router.get('/results/class/:class/:section', results.getClassResults)

// ═══════════════════════════════════════════════════════════
// NOTICES
// ═══════════════════════════════════════════════════════════
router.get('/notices', notices.getAllNotices)
router.get('/notices/pending', notices.getPendingNotices)
router.get('/notices/:noticeId', notices.getNoticeDetail)
router.post('/notices', notices.createNotice)
router.put('/notices/:noticeId', notices.updateNotice)
router.delete('/notices/:noticeId', notices.deleteNotice)
router.patch('/notices/:noticeId/approve', notices.approveNotice)
router.patch('/notices/:noticeId/reject', notices.rejectNotice)
router.patch('/notices/:noticeId/restore', notices.restoreNotice)

// ═══════════════════════════════════════════════════════════
// APPROVALS (Certificates & Leaves)
// ═══════════════════════════════════════════════════════════
router.get('/approvals/summary', approvals.getApprovalsSummary)
router.get('/approvals/certificates', approvals.getCertificateRequests)
router.patch('/approvals/certificates/:requestId/approve', approvals.approveCertificate)
router.patch('/approvals/certificates/:requestId/reject', approvals.rejectCertificate)
router.get('/approvals/leaves', approvals.getLeaveRequests)
router.patch('/approvals/leaves/:requestId/approve', approvals.approveLeave)
router.patch('/approvals/leaves/:requestId/reject', approvals.rejectLeave)

// ═══════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════
router.get('/reports/school-summary', reports.getSchoolSummaryReport)
router.get('/reports/students', reports.getStudentReport)
router.get('/reports/teachers', reports.getTeacherReport)
router.get('/reports/attendance', reports.getAttendanceReport)
router.get('/reports/results', reports.getResultsReport)

// ═══════════════════════════════════════════════════════════
// DISCIPLINE & BEHAVIOR MANAGEMENT
// ═══════════════════════════════════════════════════════════
router.get('/discipline', discipline.getAllRecords)
router.get('/discipline/summary', discipline.getDisciplineSummary)
router.get('/discipline/student/:admissionNumber', discipline.getStudentRecords)
router.get('/discipline/:id', discipline.getRecordDetail)
router.post('/discipline', discipline.createRecord)
router.put('/discipline/:id/review', discipline.reviewRecord)

// ═══════════════════════════════════════════════════════════
// CURRICULUM & SYLLABUS TRACKING
// ═══════════════════════════════════════════════════════════
// Master Curriculum (source of truth)
router.get('/curriculum/master', curriculum.getMasterCurriculums)
router.post('/curriculum/master', curriculum.createMasterCurriculum)

// Syllabus Progress (per-section tracking)
router.get('/curriculum', curriculum.getAllProgress)
router.get('/curriculum/summary', curriculum.getCurriculumSummary)
router.get('/curriculum/teacher/:teacherId', curriculum.getTeacherProgress)
router.get('/curriculum/:id', curriculum.getProgressDetail)
router.post('/curriculum', curriculum.createProgress)
router.put('/curriculum/:id/review', curriculum.reviewProgress)

// ═══════════════════════════════════════════════════════════
// COMPLAINTS & GRIEVANCE MANAGEMENT
// ═══════════════════════════════════════════════════════════
router.get('/complaints', complaints.getAllComplaints)
router.get('/complaints/summary', complaints.getComplaintsSummary)
router.get('/complaints/:id', complaints.getComplaintDetail)
router.put('/complaints/:id/update', complaints.updateComplaint)
router.put('/complaints/:id/resolve', complaints.resolveComplaint)
router.post('/complaints/:id/comment', complaints.addComment)

// ═══════════════════════════════════════════════════════════
// EVENTS & CALENDAR MANAGEMENT
// ═══════════════════════════════════════════════════════════
router.get('/events', events.getAllEvents)
router.get('/events/calendar', events.getCalendar)
router.get('/events/pending', events.getPendingEvents)
router.get('/events/:id', events.getEventDetail)
router.post('/events', events.createEvent)
router.post('/events/ptm', events.createPTM)
router.put('/events/:id', events.updateEvent)
router.put('/events/:id/approve', events.approveEvent)
router.put('/events/:id/reject', events.rejectEvent)
router.delete('/events/:id', events.cancelEvent)

// ═══════════════════════════════════════════════════════════
// FINANCE & DEFAULTER MANAGEMENT
// ═══════════════════════════════════════════════════════════
router.get('/finance/summary', finance.getFinanceSummary)
router.get('/finance/defaulters', finance.getDefaulters)
router.get('/finance/student/:admissionNumber', finance.getStudentFees)
router.get('/finance/collection-report', finance.getCollectionReport)
router.get('/finance/class-wise', finance.getClassWiseSummary)
router.put('/finance/:id/restrict', finance.toggleRestriction)
router.put('/finance/bulk-restrict', finance.bulkRestrict)

// ═══════════════════════════════════════════════════════════
// TIMETABLE MANAGEMENT
// ═══════════════════════════════════════════════════════════
import * as timetable from '../controllers/principal/timetableController'
router.get('/timetables', timetable.getAllTimetables)
router.get('/timetables/template', timetable.generateTemplate)
router.get('/timetables/teacher/:teacherId', timetable.getTeacherTimetable)
router.get('/timetables/:class/:section', timetable.getTimetable)
router.post('/timetables', timetable.createTimetable)
router.put('/timetables/:id', timetable.updateTimetable)
router.delete('/timetables/:id', timetable.deleteTimetable)

// ═══════════════════════════════════════════════════════════
// AUDIT LOGS (View Only)
// ═══════════════════════════════════════════════════════════
import { AuditLog } from '../models/shared/AuditLog'
router.get('/audit-logs', async (req, res) => {
  try {
    const { 
      action, entityType, performedByRole, 
      startDate, endDate,
      page = 1, limit = 50 
    } = req.query

    const filter: Record<string, any> = {}
    if (action) filter.action = action
    if (entityType) filter.entityType = entityType
    if (performedByRole) filter.performedByRole = performedByRole
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate as string)
      if (endDate) filter.createdAt.$lte = new Date(endDate as string)
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      AuditLog.countDocuments(filter),
    ])

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' })
  }
})

export default router
