// src/controllers/parent/childrenController.ts

import { Response } from 'express'
import Parent from '../../models/parent/Parent'
import Student from '../../models/student/Student'
import { Timetable } from '../../models/principal/Timetable'
import { AuthRequest } from '../../middleware/authMiddleware'

// ── Helper: verify child belongs to this parent ──────────
const verifyChild = async (parentId: string, admissionNumber: string) => {
  const parent = await Parent.findOne({ parentId })
  if (!parent) return null
  if (!parent.children.includes(admissionNumber.toUpperCase())) return null
  return parent
}

// ── GET /api/parent/children ─────────────────────────────
export const getChildren = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.user!.admissionNumber,
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    if (!parent.children.length) {
      res.status(200).json({ success: true, data: [] })
      return
    }

    // FIX: Select the new 'current' fields from the updated Student schema
    const children = await Student.find({
      admissionNumber: { $in: parent.children },
      isActive: true,
    })
    .select('firstName lastName admissionNumber currentClass currentSection rollNumber currentSession photo')
    .lean()

    // FIX: Map the 'current' fields back to standard fields for the frontend
    const mappedChildren = children.map(child => ({
      ...child,
      class: child.currentClass,
      section: child.currentSection,
      session: child.currentSession,
    }))

    res.status(200).json({
      success: true,
      data: mappedChildren,
      total: mappedChildren.length,
    })
  } catch (err: any) {
    console.error('getChildren error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ── GET /api/parent/children/:admissionNumber/profile ────
export const getChildProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { admissionNumber } = req.params

    const parent = await verifyChild(req.user!.admissionNumber, admissionNumber)
    if (!parent) {
      res.status(403).json({ success: false, message: 'You are not authorized to view this student.' })
      return
    }

    const student = await Student.findOne({
      admissionNumber: admissionNumber.toUpperCase(),
      isActive: true,
    })
    .select('-results -attendance')
    .lean()

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // FIX: Map the 'current' fields for the profile view
    const mappedStudent = {
      ...student,
      class: student.currentClass,
      section: student.currentSection,
      session: student.currentSession,
    }

    res.status(200).json({ success: true, data: mappedStudent })
  } catch (err: any) {
    console.error('getChildProfile error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ── GET /api/parent/children/:admissionNumber/results ────
export const getChildResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { admissionNumber } = req.params
    const { examType, session } = req.query

    const parent = await verifyChild(req.user!.admissionNumber, admissionNumber)
    if (!parent) {
      res.status(403).json({ success: false, message: 'Not authorized.' })
      return
    }

    const student = await Student.findOne({
      admissionNumber: admissionNumber.toUpperCase(),
      isActive: true,
    }).select('firstName lastName currentClass currentSection rollNumber currentSession results admissionNumber')

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    let results = student.results as any[]
    if (examType) results = results.filter((r: any) => r.examType === examType)
    if (session) results = results.filter((r: any) => r.session === session)

    results.sort((a: any, b: any) => {
      if (a.declaredOn && b.declaredOn)
        return new Date(b.declaredOn).getTime() - new Date(a.declaredOn).getTime()
      return 0
    })

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          class: student.currentClass, // Mapped automatically here
          section: student.currentSection,
          rollNumber: student.rollNumber,
          session: student.currentSession,
        },
        results,
        total: results.length,
      },
    })
  } catch (err: any) {
    console.error('getChildResults error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ── GET /api/parent/children/:admissionNumber/attendance
export const getChildAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { admissionNumber } = req.params
    const { month, year } = req.query

    const parent = await verifyChild(req.user!.admissionNumber, admissionNumber)
    if (!parent) {
      res.status(403).json({ success: false, message: 'Not authorized.' })
      return
    }

    const student = await Student.findOne({
      admissionNumber: admissionNumber.toUpperCase(),
      isActive: true,
    }).select('firstName lastName currentClass currentSection attendance admissionNumber')

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    let attendance = student.attendance as any[]
    if (month && year) {
      attendance = attendance.filter(
        (a: any) => a.month === parseInt(month as string) && a.year === parseInt(year as string)
      )
    } else if (year) {
      attendance = attendance.filter((a: any) => a.year === parseInt(year as string))
    }

    attendance.sort((a: any, b: any) => {
      if (b.year !== a.year) return b.year - a.year
      return b.month - a.month
    })

    const totalDays = attendance.reduce((s: number, m: any) => s + (m.totalDays || 0), 0)
    const presentDays = attendance.reduce((s: number, m: any) => s + (m.presentDays || 0), 0)
    const absentDays = attendance.reduce((s: number, m: any) => s + (m.absentDays || 0), 0)
    const overallPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          class: student.currentClass, // Mapped automatically here
          section: student.currentSection,
        },
        summary: { totalDays, presentDays, absentDays, overallPercentage },
        attendance,
      },
    })
  } catch (err: any) {
    console.error('getChildAttendance error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ── GET /api/parent/children/:admissionNumber/timetable ──
export const getChildTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { admissionNumber } = req.params

    const parent = await verifyChild(req.user!.admissionNumber, admissionNumber)
    if (!parent) {
      res.status(403).json({ success: false, message: 'Not authorized.' })
      return
    }

    const child = await Student.findOne({
      admissionNumber: admissionNumber.toUpperCase(),
      isActive: true,
    }).select('currentClass currentSection')

    if (!child) {
      res.status(404).json({ success: false, message: 'Child not found.' })
      return
    }

    const timetable = await Timetable.findOne({
      class: child.currentClass,
      section: child.currentSection,
      isActive: true,
    }).sort({ effectiveFrom: -1 })

    if (timetable) {
      const formattedTimetable = timetable.schedule.map((day) => ({
        day: day.day,
        periods: day.periods.map((p) => ({
          periodNumber: p.periodNumber,
          subject: p.subject,
          teacher: p.teacherName,
          startTime: p.startTime,
          endTime: p.endTime,
          room: p.room,
          isBreak: p.isBreak,
        })),
      }))

      res.status(200).json({ success: true, data: formattedTimetable })
      return
    }

    const defaultTimetable = [
      {
        day: 'Monday',
        periods: ['English', 'Mathematics', 'Science', 'Hindi', 'Social Studies', 'Computer', 'Sports'],
      },
      { day: 'Tuesday', periods: ['Mathematics', 'English', 'Hindi', 'Science', 'GK', 'Art', 'Library'] },
      {
        day: 'Wednesday',
        periods: ['Science', 'Social Studies', 'English', 'Mathematics', 'Sanskrit', 'Music', 'Sports'],
      },
      { day: 'Thursday', periods: ['Hindi', 'Mathematics', 'English', 'Science', 'Computer', 'Social Studies', 'Art'] },
      { day: 'Friday', periods: ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi', 'GK', 'Sports'] },
      { day: 'Saturday', periods: ['English', 'Hindi', 'Mathematics', 'Art', 'Computer', 'Library', '—'] },
    ]

    res.status(200).json({ success: true, data: defaultTimetable, fallback: true })
  } catch (err: any) {
    console.error('getChildTimetable error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}