// src/controllers/student/attendanceController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import { AuthRequest } from '../../middleware/authMiddleware'

// ── GET /api/student/attendance ──────────────────────────
// Query: ?month=3&year=2025
export const getAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query

    // 🛡️ FIX: Use 'currentClass' and 'currentSection' in select()
    const student = await Student.findOne({
      admissionNumber: req.user!.admissionNumber,
      isActive: true,
    })
      .select('firstName lastName currentClass currentSection attendance admissionNumber')
      .lean()

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    let attendance = student.attendance as any[]

    if (month && year) {
      attendance = attendance.filter(
        (a) => a.month === parseInt(month as string) && a.year === parseInt(year as string)
      )
    } else if (year) {
      attendance = attendance.filter((a) => a.year === parseInt(year as string))
    }

    // Sort newest first
    attendance.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year
      return b.month - a.month
    })

    const totalDays = attendance.reduce((sum, m) => sum + (m.totalDays || 0), 0)
    const presentDays = attendance.reduce((sum, m) => sum + (m.presentDays || 0), 0)
    const absentDays = attendance.reduce((sum, m) => sum + (m.absentDays || 0), 0)
    const overallPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          class: student.currentClass,
          section: student.currentSection,
        },
        summary: { totalDays, presentDays, absentDays, overallPercentage },
        attendance,
      },
    })
  } catch (error: any) {
    console.error('getAttendance error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}