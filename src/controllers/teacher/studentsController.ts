import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'
import { sseManager } from '../../lib/sseManager'
import { canAccessClass, getTeacher } from './teacherHelpers'

// GET /api/teacher/students?class=9&section=A
export const getMyStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const { class: cls, section } = req.query as { class?: string; section?: string }

    if (!cls) {
      res.status(400).json({ success: false, message: 'class query param is required.' })
      return
    }

    if (!canAccessClass(teacher, cls, section)) {
      res.status(403).json({ success: false, message: 'You are not assigned to this class.' })
      return
    }

    const filter: Record<string, any> = { currentClass: cls, isActive: true }
    if (section) filter.currentSection = section.toUpperCase()

    const students = await Student.find(filter)
      .select('firstName lastName admissionNumber currentClass currentSection rollNumber currentSession gender phone email parents')
      .sort({ rollNumber: 1 })

    const formattedStudents = students.map(s => ({
      ...s.toObject(),
      class: s.currentClass,
      section: s.currentSection,
      session: s.currentSession,
    }))

    res.status(200).json({ success: true, data: formattedStudents, total: formattedStudents.length })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/teacher/students/:admissionNumber — full profile of one student
export const getStudentDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const student = await Student.findOne({ admissionNumber: req.params.admissionNumber.toUpperCase(), isActive: true })
    if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return }

   if (!canAccessClass(teacher, student.currentClass, student.currentSection)) {
      res.status(403).json({ success: false, message: 'You are not assigned to this class.' })
      return
    }

    const studentObj = student.toObject()
    res.status(200).json({
      success: true,
      data: {
        ...studentObj,
        class: studentObj.currentClass,
        section: studentObj.currentSection,
        session: studentObj.currentSession,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// PATCH /api/teacher/students/:admissionNumber/remark
// Body: { remark }

export const addRemark = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const { remark } = req.body
    if (!remark) { res.status(400).json({ success: false, message: 'Remark text is required.' }); return }

    const student = await Student.findOne({ admissionNumber: req.params.admissionNumber.toUpperCase(), isActive: true })
    if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return }

    // Security Check: Must be the specific class teacher for this student's class and section
    const ctInfo = teacher.currentClassTeacherOf
    if (!teacher.isClassTeacher || !ctInfo || ctInfo.class !== student.currentClass || ctInfo.section !== student.currentSection) {
      res.status(403).json({ success: false, message: 'Only the designated class teacher can add remarks for this student.' })
      return
    }

    const newRemark = {
      remark,
      addedBy: teacher.fullName,
      teacherId: teacher.teacherId,
      session: student.currentSession || '2024-25',
      date: new Date()
    }

    student.classTeacherRemarks.push(newRemark)
    await student.save()

    res.status(200).json({ success: true, message: 'Remark added successfully', data: newRemark })
  } catch (err: any) {
    console.error('addRemark error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/teacher/students/:admissionNumber/remarks
// Get previous class teacher remarks
// ═══════════════════════════════════════════════════════════
export const getRemarks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const student = await Student.findOne({ admissionNumber: req.params.admissionNumber.toUpperCase(), isActive: true })
    if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return }

    // Security Check: Ensure they at least have access to this student's class
    if (!canAccessClass(teacher, student.currentClass, student.currentSection)) {
      res.status(403).json({ success: false, message: 'You are not assigned to this class.' }); return
    }

    res.status(200).json({ success: true, data: { remarks: student.classTeacherRemarks || [] } })
  } catch (err: any) {
    console.error('getRemarks error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}