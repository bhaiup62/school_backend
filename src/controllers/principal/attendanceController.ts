// src/controllers/principal/attendanceController.ts
// Attendance oversight & reports for Principal

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'
import Teacher from '../../models/teacher/Teacher'

const parseQueryDate = (dateQuery: unknown): Date | null => {
  if (!dateQuery) return new Date()

  if (typeof dateQuery === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
    const [year, month, day] = dateQuery.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(dateQuery as string)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatLocalDate = (date: Date): string => {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localTime.toISOString().split('T')[0]
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/attendance/today
// Today's attendance summary across all classes
// ═══════════════════════════════════════════════════════════
export const getTodayAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date } = req.query as any
    const targetDate = parseQueryDate(date)
    if (!targetDate) {
      res.status(400).json({ success: false, message: 'Invalid date format.' })
      return
    }

    const currentMonth = targetDate.getMonth() + 1
    const currentYear = targetDate.getFullYear()
    const todayDate = formatLocalDate(targetDate)

    // Get today's attendance by class
    const attendanceByClass = await Student.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$attendance' },
      { $match: { 'attendance.month': currentMonth, 'attendance.year': currentYear } },
      { $unwind: '$attendance.records' },
      {
        $match: {
          $expr: {
            $eq: [
              { $dateToString: { format: '%Y-%m-%d', date: '$attendance.records.date', timezone: 'Asia/Kolkata' } },
              todayDate,
            ],
          },
        },
      },
      {
        $group: {
          _id: { class: '$currentClass', section: '$currentSection' },
          present: {
            $sum: { $cond: [{ $eq: ['$attendance.records.status', 'present'] }, 1, 0] },
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$attendance.records.status', 'absent'] }, 1, 0] },
          },
          late: {
            $sum: { $cond: [{ $eq: ['$attendance.records.status', 'late'] }, 1, 0] },
          },
        },
      },
      { $sort: { '_id.class': 1, '_id.section': 1 } },
    ])

    // Calculate totals
    let totalPresent = 0
    let totalAbsent = 0
    let totalLate = 0

    const byClass = attendanceByClass.map(a => {
      totalPresent += a.present
      totalAbsent += a.absent
      totalLate += a.late
      const total = a.present + a.absent + a.late
      return {
        class: a._id.class,
        section: a._id.section,
        present: a.present,
        absent: a.absent,
        late: a.late,
        total,
        percentage: total > 0 ? Math.round((a.present / total) * 100) : 0,
      }
    })

    const grandTotal = totalPresent + totalAbsent + totalLate

    // Get classes that haven't marked attendance yet
    const markedClasses = new Set(byClass.map(b => `${b.class}-${b.section}`))
    const allClassSections = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: { class: '$currentClass', section: '$currentSection' } } },
    ])

    const pendingClasses = allClassSections
      .filter(cs => !markedClasses.has(`${cs._id.class}-${cs._id.section}`))
      .map(cs => ({ class: cs._id.class, section: cs._id.section }))
      .sort((a, b) => parseInt(a.class) - parseInt(b.class) || a.section.localeCompare(b.section))

    res.status(200).json({
      success: true,
      data: {
        date: todayDate,
        summary: {
          totalPresent,
          totalAbsent,
          totalLate,
          totalMarked: grandTotal,
          percentage: grandTotal > 0 ? Math.round((totalPresent / grandTotal) * 100) : 0,
        },
        byClass,
        pendingClasses,
      },
    })
  } catch (err: any) {
    console.error('getTodayAttendance error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/attendance/class/:class/section/:section
// Get attendance for a specific class-section
// ═══════════════════════════════════════════════════════════
export const getClassAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section } = req.params
    const { date } = req.query as any
    const targetDate = parseQueryDate(date)
    if (!targetDate) {
      res.status(400).json({ success: false, message: 'Invalid date format.' })
      return
    }

    const targetMonth = targetDate.getMonth() + 1
    const targetYear = targetDate.getFullYear()
    const targetDateString = formatLocalDate(targetDate)

    const students = await Student.find({
      currentClass: cls,
      currentSection: section.toUpperCase(),
      isActive: true,
    }).select('firstName lastName admissionNumber rollNumber attendance')

    let dailyPresent = 0
    let dailyAbsent = 0
    let dailyLate = 0

    const result = students.map(student => {
      const monthAttendance = (student.attendance || []).find(
        (a: any) => a.month === targetMonth && a.year === targetYear
      )
      const dailyRecord = (monthAttendance?.records || []).find(
        (r: any) => formatLocalDate(new Date(r.date)) === targetDateString
      )
      const dailyStatus = dailyRecord ? dailyRecord.status : 'Not Marked'

      if (dailyStatus === 'present') dailyPresent++
      else if (dailyStatus === 'absent') dailyAbsent++
      else if (dailyStatus === 'late') dailyLate++

     return {
        admissionNumber: student.admissionNumber,
        name: `${student.firstName} ${student.lastName}`,
        rollNumber: student.rollNumber,
        totalDays: monthAttendance?.totalDays || 0,
        presentDays: monthAttendance?.presentDays || 0,
        absentDays: monthAttendance?.absentDays || 0,
        percentage: monthAttendance?.percentage || 0,
        dailyStatus,
        monthlyBreakdown: monthAttendance ? [monthAttendance] : [],
      }
    })

    // Calculate class summary
    const totalStudents = result.length
    const dailyPercentage = totalStudents > 0 ? Math.round((dailyPresent / totalStudents) * 100) : 0

    // Get class teacher
    const classTeacher = await Teacher.findOne({
      'currentClassTeacherOf.class': cls,
      'currentClassTeacherOf.section': section.toUpperCase(),
      isClassTeacher: true,
      isActive: true,
    }).select('firstName lastName teacherId')

    res.status(200).json({
      success: true,
      data: {
        class: cls,
        section: section.toUpperCase(),
        month: targetMonth,
        year: targetYear,
        classTeacher: classTeacher
          ? { id: classTeacher.teacherId, name: `${classTeacher.firstName} ${classTeacher.lastName}` }
          : null,
        summary: {
          totalStudents,
          dailyPresent,
          dailyAbsent,
          dailyLate,
          dailyPercentage,
        },
        students: result.sort((a, b) => parseInt(a.rollNumber) - parseInt(b.rollNumber)),
      },
    })
  } catch (err: any) {
    console.error('getClassAttendance error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/attendance/monthly-report
// Monthly attendance report for all classes
// ═══════════════════════════════════════════════════════════
export const getMonthlyReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query as any

    const currentDate = new Date()
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1
    const targetYear = year ? parseInt(year) : currentDate.getFullYear()

    const report = await Student.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$attendance' },
      { $match: { 'attendance.month': targetMonth, 'attendance.year': targetYear } },
      {
        $group: {
          _id: { class: '$currentClass', section: '$currentSection' },
          totalStudents: { $sum: 1 },
          avgPresent: { $avg: '$attendance.presentDays' },
          avgAbsent: { $avg: '$attendance.absentDays' },
          avgPercentage: { $avg: '$attendance.percentage' },
          totalDays: { $first: '$attendance.totalDays' },
        },
      },
      { $sort: { '_id.class': 1, '_id.section': 1 } },
    ])

    const formattedReport = report.map(r => ({
      class: r._id.class,
      section: r._id.section,
      totalStudents: r.totalStudents,
      totalDays: r.totalDays || 0,
      avgPresentDays: Math.round(r.avgPresent || 0),
      avgAbsentDays: Math.round(r.avgAbsent || 0),
      avgPercentage: Math.round(r.avgPercentage || 0),
    }))

    // School-wide summary
    const schoolSummary = {
      totalStudents: formattedReport.reduce((sum, r) => sum + r.totalStudents, 0),
      avgAttendance:
        formattedReport.length > 0
          ? Math.round(
              formattedReport.reduce((sum, r) => sum + r.avgPercentage, 0) / formattedReport.length
            )
          : 0,
    }

    res.status(200).json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        schoolSummary,
        classwiseReport: formattedReport,
      },
    })
  } catch (err: any) {
    console.error('getMonthlyReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/attendance/absent-today
// List all absent students today
// ═══════════════════════════════════════════════════════════
export const getAbsentToday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date } = req.query as any
    const targetDate = parseQueryDate(date)
    if (!targetDate) {
      res.status(400).json({ success: false, message: 'Invalid date format.' })
      return
    }

    const currentMonth = targetDate.getMonth() + 1
    const currentYear = targetDate.getFullYear()
    const todayDate = formatLocalDate(targetDate)

    const absentStudents = await Student.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$attendance' },
      { $match: { 'attendance.month': currentMonth, 'attendance.year': currentYear } },
      { $unwind: '$attendance.records' },
      {
        $match: {
          'attendance.records.status': 'absent',
          $expr: {
            $eq: [
              { $dateToString: { format: '%Y-%m-%d', date: '$attendance.records.date', timezone: 'Asia/Kolkata' } },
              todayDate,
            ],
          },
        },
      },
      {
        $project: {
          admissionNumber: 1,
          firstName: 1,
          lastName: 1,
          currentClass: 1,
          currentSection: 1,
          phone: 1,
          'parents.fatherName': 1,
          'parents.phone': 1,
        },
      },
      { $sort: { currentClass: 1, currentSection: 1 } },
    ])

    res.status(200).json({
      success: true,
      data: {
        date: todayDate,
        count: absentStudents.length,
        students: absentStudents.map(s => ({
          admissionNumber: s.admissionNumber,
          name: `${s.firstName} ${s.lastName}`,
          class: s.currentClass,
          section: s.currentSection,
          phone: s.phone,
          parentName: s.parents?.fatherName || 'N/A',
          parentPhone: s.parents?.phone || s.phone,
        })),
      },
    })
  } catch (err: any) {
    console.error('getAbsentToday error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
