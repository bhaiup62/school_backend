// src/controllers/student/timetableController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import { Timetable } from '../../models/principal/Timetable'
import { AuthRequest } from '../../middleware/authMiddleware'

// ── GET /api/student/timetable ───────────────────────────
export const getTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 🛡️ FIX: Properly select the new Enterprise Schema fields
    const student = await Student.findOne({
      admissionNumber: req.user!.admissionNumber,
      isActive: true,
    }).select('currentClass currentSection')

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // Try to find timetable from database
    const timetable = await Timetable.findOne({
      class: student.currentClass,
      section: student.currentSection,
      isActive: true,
    }).sort({ effectiveFrom: -1 })

    if (timetable) {
      // Return formatted timetable from DB
      const formattedTimetable = timetable.schedule.map((day: any) => ({
        day: day.day,
        periods: day.periods.map((p: any) => ({
          periodNumber: p.periodNumber,
          subject: p.subject,
          teacher: p.teacherName,
          startTime: p.startTime,
          endTime: p.endTime,
          room: p.room,
          isBreak: p.isBreak,
        })),
      }))

      res.status(200).json({ success: true, data: formattedTimetable, fallback: false })
      return
    }

    // Fallback to hardcoded timetable if no DB timetable exists
    const defaultTimetable = [
      { day: 'Monday',    periods: ['English', 'Mathematics', 'Science', 'Hindi', 'Social Studies', 'Computer', 'Sports'] },
      { day: 'Tuesday',   periods: ['Mathematics', 'English', 'Hindi', 'Science', 'GK', 'Art', 'Library'] },
      { day: 'Wednesday', periods: ['Science', 'Social Studies', 'English', 'Mathematics', 'Sanskrit', 'Music', 'Sports'] },
      { day: 'Thursday',  periods: ['Hindi', 'Mathematics', 'English', 'Science', 'Computer', 'Social Studies', 'Art'] },
      { day: 'Friday',    periods: ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi', 'GK', 'Sports'] },
      { day: 'Saturday',  periods: ['English', 'Hindi', 'Mathematics', 'Art', 'Computer', 'Library', '—'] },
    ]

    res.status(200).json({ success: true, data: defaultTimetable, fallback: true })
  } catch (error: any) {
    console.error('getTimetable error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}