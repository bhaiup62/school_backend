import { Router } from 'express'
import { protect, authorizeRole } from '../../middleware/authMiddleware'
import {
  createSession,
  getSessions,
  toggleSessionStatus,
  createClass,
  getClasses,
  updateClass,
} from '../../controllers/admin/admissions/setupController'
import {
  createEnquiry,
  getEnquiries,
  updateEnquiryStatus,
  deleteEnquiry,
} from '../../controllers/admin/admissions/enquiryController'
import {
  createApplication,
  getApplications,
  getApplicationById,
  updateDocumentStatus,
  updatePayment,
} from '../../controllers/admin/admissions/applicationController'
import {
  scheduleTest,
  updateTestScore,
  getScheduledTests,
} from '../../controllers/admin/admissions/testController'
import {
  updateOfferStatus,
  confirmAdmission,
} from '../../controllers/admin/admissions/offerController'
import { getAdmissionPipeline } from '../../controllers/admin/admissionController'

const router = Router()

router.use(protect, authorizeRole('admin'))
router.get('/pipeline', getAdmissionPipeline)

// SETUP
router.post('/setup/sessions', createSession)
router.get('/setup/sessions', getSessions)
router.patch('/setup/sessions/:id/status', toggleSessionStatus)
router.post('/setup/classes', createClass)
router.get('/setup/classes', getClasses)
router.patch('/setup/classes/:id', updateClass)

// ENQUIRY
router.post('/enquiries', createEnquiry)
router.get('/enquiries', getEnquiries)
router.patch('/enquiries/:id/status', updateEnquiryStatus)
router.delete('/enquiries/:id', deleteEnquiry)

// APPLICATION
router.post('/applications', createApplication)
router.get('/applications', getApplications)
router.get('/applications/:id', getApplicationById)
router.patch('/applications/:id/documents', updateDocumentStatus)
router.patch('/applications/:id/payment', updatePayment)

// TEST
router.patch('/tests/:id/schedule', scheduleTest)
router.patch('/tests/:id/score', updateTestScore)
router.get('/tests', getScheduledTests)

// OFFER
router.patch('/offers/:id/status', updateOfferStatus)
router.post('/offers/:id/confirm', confirmAdmission)

export default router
