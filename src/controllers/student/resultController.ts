// src/controllers/student/resultController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import { AuthRequest } from '../../middleware/authMiddleware'

// ── GET /api/student/results ─────────────────────────────
// Query: ?examType=half_yearly&session=2024-25
export const getResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examType, session } = req.query

    // 🛡️ FIX: Use currentClass, currentSection, currentSession in select()
    const student = await Student.findOne({
      admissionNumber: req.user!.admissionNumber,
      isActive: true,
    })
      .select('firstName lastName currentClass currentSection rollNumber currentSession results admissionNumber')
      .lean()

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    let results = student.results as any[]

    if (examType) results = results.filter((r) => r.examType === examType)
    if (session) results = results.filter((r) => r.session === session)

    // Sort newest declared exams first
    results.sort((a, b) => {
      if (a.declaredOn && b.declaredOn) {
        return new Date(b.declaredOn).getTime() - new Date(a.declaredOn).getTime()
      }
      return 0
    })

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          class: student.currentClass,
          section: student.currentSection,
          rollNumber: student.rollNumber,
          session: student.currentSession,
        },
        results,
        total: results.length,
      },
    })
  } catch (error: any) {
    console.error('getResults error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}