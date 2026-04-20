import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'
import { sseManager } from '../../lib/sseManager'
import { canAccessClass, getTeacher } from './teacherHelpers'

// POST /api/teacher/attendance
// Body: { admissionNumber, date, status, remarks? }
export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const { admissionNumber, date, status, remarks } = req.body
    if (!admissionNumber || !date || !status) {
      res.status(400).json({ success: false, message: 'admissionNumber, date and status are required.' })
      return
    }

    const validStatuses = ['present', 'absent', 'late', 'holiday']
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` })
      return
    }

    const student = await Student.findOne({ admissionNumber: admissionNumber.toUpperCase(), isActive: true })
    if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return }

    if (!canAccessClass(teacher, student.currentClass, student.currentSection)) {
      res.status(403).json({ success: false, message: 'You are not assigned to this class/section.' })
      return
    }

    const [yearStr, monthStr, dayStr] = date.split('-')
    const attendanceDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr))
    const month = attendanceDate.getMonth() + 1
    const year = attendanceDate.getFullYear()

    // Find or create monthly attendance record
    let monthRecord = student.attendance.find((a: any) => a.month === month && a.year === year)

    if (!monthRecord) {
      student.attendance.push({
        month,
        year,
        records: [],
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        percentage: 0,
      })
      monthRecord = student.attendance[student.attendance.length - 1]
    }

    // Check if record for this date already exists — update it
    const existingRecord = monthRecord.records.find(
      (r: any) => new Date(r.date).toDateString() === attendanceDate.toDateString()
    )

    if (existingRecord) {
      existingRecord.status = status
      existingRecord.remarks = remarks || ''
    } else {
      monthRecord.records.push({ date: attendanceDate, status, remarks: remarks || '' })
    }

    // Recalculate monthly stats
    const records = monthRecord.records
    monthRecord.totalDays = records.filter((r: any) => r.status !== 'holiday').length
    monthRecord.presentDays = records.filter((r: any) => r.status === 'present' || r.status === 'late').length
    monthRecord.absentDays = records.filter((r: any) => r.status === 'absent').length
    monthRecord.percentage = monthRecord.totalDays > 0
      ? Math.round((monthRecord.presentDays / monthRecord.totalDays) * 100)
      : 0

    await student.save()

    sseManager.broadcastAttendanceUpdate(student.admissionNumber, {
      month,
      year,
      date: attendanceDate,
      status,
      remarks: remarks || '',
      summary: {
        totalDays: monthRecord.totalDays,
        presentDays: monthRecord.presentDays,
        absentDays: monthRecord.absentDays,
        percentage: monthRecord.percentage,
      },
      markedBy: teacher.fullName,
    })

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully.',
      data: { admissionNumber: student.admissionNumber, month, year, status, date: attendanceDate },
    })
  } catch (err: any) {
    console.error('markAttendance error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// POST /api/teacher/attendance/bulk
// Body: { class, section, date, records: [{ admissionNumber, status, remarks? }] }
export const markBulkAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const { class: cls, section, date, records } = req.body
    if (!cls || !section || !date || !Array.isArray(records) || !records.length) {
      res.status(400).json({ success: false, message: 'class, section, date and records[] are required.' })
      return
    }

    if (!canAccessClass(teacher, cls, section)) {
      res.status(403).json({ success: false, message: 'You are not assigned to this class/section.' })
      return
    }

    const [yearStr, monthStr, dayStr] = date.split('-')
    const attendanceDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr))
    const month = attendanceDate.getMonth() + 1
    const year = attendanceDate.getFullYear()
    const results: any[] = []

    for (const record of records) {
      const { admissionNumber, status, remarks } = record
      if (!admissionNumber || !status) continue

      const student = await Student.findOne({ admissionNumber: admissionNumber.toUpperCase(), isActive: true })
      if (!student) continue

      let monthRecord = student.attendance.find((a: any) => a.month === month && a.year === year)
      if (!monthRecord) {
        student.attendance.push({ month, year, records: [], totalDays: 0, presentDays: 0, absentDays: 0, percentage: 0 })
        monthRecord = student.attendance[student.attendance.length - 1]
      }

      const existing = monthRecord.records.find(
        (r: any) => new Date(r.date).toDateString() === attendanceDate.toDateString()
      )
      if (existing) {
        existing.status = status
        existing.remarks = remarks || ''
      } else {
        monthRecord.records.push({ date: attendanceDate, status, remarks: remarks || '' })
      }

      const recs = monthRecord.records
      monthRecord.totalDays = recs.filter((r: any) => r.status !== 'holiday').length
      monthRecord.presentDays = recs.filter((r: any) => r.status === 'present' || r.status === 'late').length
      monthRecord.absentDays = recs.filter((r: any) => r.status === 'absent').length
      monthRecord.percentage = monthRecord.totalDays > 0
        ? Math.round((monthRecord.presentDays / monthRecord.totalDays) * 100) : 0

      await student.save()

      sseManager.broadcastAttendanceUpdate(student.admissionNumber, {
        month, year, date: attendanceDate, status, remarks: remarks || '',
        summary: {
          totalDays: monthRecord.totalDays,
          presentDays: monthRecord.presentDays,
          absentDays: monthRecord.absentDays,
          percentage: monthRecord.percentage,
        },
        markedBy: teacher.fullName,
      })

      results.push({ admissionNumber: student.admissionNumber, status })
    }

    res.status(200).json({
      success: true,
      message: `Bulk attendance marked for ${results.length} students.`,
      data: results,
    })
  } catch (err: any) {
    console.error('markBulkAttendance error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/teacher/attendance-report?class=9&section=A&month=3&year=2025
export const getAttendanceReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) { res.status(404).json({ success: false, message: 'Teacher not found.' }); return }

    const { class: cls, section, month, year } = req.query as any
    if (!cls) { res.status(400).json({ success: false, message: 'class is required.' }); return }

    if (!canAccessClass(teacher, cls, section)) {
      res.status(403).json({ success: false, message: 'Not assigned to this class.' }); return
    }

    const filter: Record<string, any> = { currentClass: cls, isActive: true }
    if (section) filter.currentSection = section.toUpperCase()

    const students = await Student.find(filter)
      .select('firstName lastName admissionNumber rollNumber attendance')
      .sort({ rollNumber: 1 })

    const report = students.map((s: any) => {
      let att = s.attendance
      if (month && year) att = att.filter((a: any) => a.month === parseInt(month) && a.year === parseInt(year))
      else if (year) att = att.filter((a: any) => a.year === parseInt(year))

      const totalDays = att.reduce((sum: number, m: any) => sum + (m.totalDays || 0), 0)
      const presentDays = att.reduce((sum: number, m: any) => sum + (m.presentDays || 0), 0)
      const absentDays = att.reduce((sum: number, m: any) => sum + (m.absentDays || 0), 0)
      const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

      return {
        admissionNumber: s.admissionNumber,
        name: `${s.firstName} ${s.lastName}`,
        rollNumber: s.rollNumber,
        totalDays,
        presentDays,
        absentDays,
        percentage: pct,
        lowAttendance: pct < 75 && totalDays > 0,
        monthlyBreakdown: att,
      }
    })

    res.status(200).json({ success: true, data: report, total: report.length })
  } catch (err: any) {
    console.error('getAttendanceReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
