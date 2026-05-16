import { Router } from 'express'
import { protect, authorizeRole } from '../../middleware/authMiddleware'
import {
  createSubject,
  getSubjectsBySession,
  updateSubject,
  toggleSubjectStatus,
} from '../../controllers/admin/academics/subjectController'
import {
  createClass,
  getClassesBySession,
  getClassById,
  addSection,
  assignClassTeacher,
} from '../../controllers/admin/academics/classController'
import {
  assignSubjectToClass,
  getSubjectsForClass,
  getAcademicsTeachers,
  removeSubjectFromClass,
  updateSubjectMapping,
} from '../../controllers/admin/academics/classSubjectMappingController'

const router = Router()

router.use(protect, authorizeRole('admin'))

router.post('/subjects', createSubject)
router.get('/subjects/session/:sessionId', getSubjectsBySession)
router.patch('/subjects/:id', updateSubject)
router.patch('/subjects/:id/toggle', toggleSubjectStatus)

router.post('/classes', createClass)
router.get('/classes/session/:sessionId', getClassesBySession)
router.get('/classes/:id', getClassById)
router.post('/classes/:id/sections', addSection)
router.patch('/classes/:classId/sections/:sectionName/teacher', assignClassTeacher)
router.post('/classes/:classId/subjects', assignSubjectToClass)
router.get('/classes/:classId/subjects', getSubjectsForClass)
router.delete('/mappings/:mappingId', removeSubjectFromClass)
router.patch('/mappings/:mappingId', updateSubjectMapping)
router.get('/teachers/list', getAcademicsTeachers)

export default router
