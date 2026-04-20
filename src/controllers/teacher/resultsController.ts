import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'
import { sseManager } from '../../lib/sseManager'
import { canAccessClass, getTeacher } from './teacherHelpers'

// POST /api/teacher/results
export const enterResult = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const { admissionNumber, examName, examType, session, subjects, rank, declaredOn } = req.body
    if (!admissionNumber || !examName || !examType || !session || !Array.isArray(subjects)) {
      res.status(400).json({ success: false, message: 'admissionNumber, examName, examType, session and subjects[] are required.' })
      return
    }

    const validTypes = ['unit_test', 'half_yearly', 'annual', 'pre_board']
    if (!validTypes.includes(examType)) {
      res.status(400).json({ success: false, message: `examType must be one of: ${validTypes.join(', ')}` })
      return
    }

    const student = await Student.findOne({ admissionNumber: admissionNumber.toUpperCase(), isActive: true })
    if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return }

    // FIX 1: Pass currentSection to the security helper
    if (!canAccessClass(teacher, student.currentClass, student.currentSection)) {
      res.status(403).json({ success: false, message: 'You are not assigned to this class.' })
      return
    }

    const totalMarks = subjects.reduce((s: number, sub: any) => s + (sub.maxMarks || 0), 0)
    const totalObtained = subjects.reduce((s: number, sub: any) => s + (sub.marksObtained || 0), 0)
    const percentage = totalMarks > 0 ? Math.round((totalObtained / totalMarks) * 100) : 0
    const result = percentage >= 33 ? 'pass' : 'fail'

    const existingIdx = student.results.findIndex(
      (r: any) => r.examName === examName && r.session === session
    )

    const resultDoc = {
      examName,
      examType,
      session,
      class: student.currentClass,     // FIX 2: Required by Mongoose Schema
      section: student.currentSection, // FIX 2: Required by Mongoose Schema
      subjects,
      totalMarks,
      totalObtained,
      percentage,
      rank: rank || undefined,
      result,
      declaredOn: declaredOn ? new Date(declaredOn) : new Date(),
    }

    if (existingIdx >= 0) {
      student.results[existingIdx].set(resultDoc)
    } else {
      student.results.push(resultDoc)
    }
    await student.save()

    sseManager.broadcastResultUpdate(student.admissionNumber, {
      examName, examType, session, percentage, result, totalMarks, totalObtained, rank: rank || null, subjects, enteredBy: teacher.fullName,
    })

    res.status(200).json({
      success: true,
      message: existingIdx >= 0 ? 'Result updated successfully.' : 'Result entered successfully.',
      data: { admissionNumber: student.admissionNumber, examName, percentage, result },
    })
  } catch (err: any) {
    console.error('enterResult error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/teacher/results/:admissionNumber
export const getStudentResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const student = await Student.findOne({ admissionNumber: req.params.admissionNumber.toUpperCase(), isActive: true })
      .select('firstName lastName admissionNumber currentClass currentSection rollNumber currentSession results')
    if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return }

    // FIX 1: Pass currentSection to the security helper
    if (!canAccessClass(teacher, student.currentClass, student.currentSection)) {
      res.status(403).json({ success: false, message: 'Not assigned to this class.' }); return
    }

    res.status(200).json({ success: true, data: { student, results: student.results } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}