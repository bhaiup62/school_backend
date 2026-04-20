// src/controllers/receptionist/attendanceController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import { AuthRequest } from './receptionistHelpers'

// GET /api/receptionist/attendance
export const getAttendanceReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section, month, year } = req.query as any

    if (!cls) {
      res.status(400).json({ success: false, message: 'class is required.' })
      return
    }

    // 🛡️ FIX: Use currentClass and currentSection to match the new Enterprise Schema
    const filter: Record<string, any> = { currentClass: cls, isActive: true }
    if (section) filter.currentSection = section.toUpperCase()

    const students = await Student.find(filter)
      .select('firstName lastName admissionNumber rollNumber attendance')
      .sort({ rollNumber: 1 })
      .lean()

    const report = students.map((s: any) => {
      let att = s.attendance || []
      if (month && year) att = att.filter((a: any) => a.month === parseInt(month) && a.year === parseInt(year))
      else if (year) att = att.filter((a: any) => a.year === parseInt(year))

      const totalDays = att.reduce((sum: number, m: any) => sum + (m.totalDays || 0), 0)
      const presentDays = att.reduce((sum: number, m: any) => sum + (m.presentDays || 0), 0)
      const absentDays = att.reduce((sum: number, m: any) => sum + (m.absentDays || 0), 0)
      const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

      return {
        admissionNumber: s.admissionNumber,
        fullName: `${s.firstName} ${s.lastName}`,
        rollNumber: s.rollNumber,
        totalDays,
        presentDays,
        absentDays,
        percentage: pct,
        lowAttendance: pct < 75 && totalDays > 0,
      }
    })

    res.status(200).json({ success: true, data: report, total: report.length })
  } catch (err: any) {
    console.error('getAttendanceReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}