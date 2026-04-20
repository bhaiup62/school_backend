// src/controllers/principal/reportsController.ts
// Reports and data export for Principal

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'
import Teacher from '../../models/teacher/Teacher'
import Parent from '../../models/parent/Parent'

// ═══════════════════════════════════════════════════════════
// GET /api/principal/reports/students
// Export student list with filters
// ═══════════════════════════════════════════════════════════
export const getStudentReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section, gender, format = 'json' } = req.query as any

    const filter: Record<string, any> = { isActive: true }
    if (cls) filter.currentClass = cls
    if (section) filter.currentSection = section.toUpperCase()
    if (gender) filter.gender = gender

    const students = await Student.find(filter)
      .select(
        'admissionNumber firstName lastName currentClass currentSection rollNumber gender dateOfBirth phone email address city parents admissionDate'
      )
      .sort({ currentClass: 1, currentSection: 1, rollNumber: 1 })

    const reportData = students.map((s, index) => ({
      sno: index + 1,
      admissionNumber: s.admissionNumber,
      name: `${s.firstName} ${s.lastName}`,
      class: s.currentClass,
      section: s.currentSection,
      rollNumber: s.rollNumber,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '',
      phone: s.phone,
      email: s.email,
      address: `${s.address || ''}, ${s.city || ''}`.trim(),
      fatherName: (s as any).parents?.fatherName || '',
      motherName: (s as any).parents?.motherName || '',
      parentPhone: (s as any).parents?.phone || '',
      admissionDate: s.admissionDate ? new Date(s.admissionDate).toLocaleDateString() : '',
    }))

    res.status(200).json({
      success: true,
      data: {
        filters: { class: cls, section, gender },
        totalCount: reportData.length,
        generatedAt: new Date().toISOString(),
        students: reportData,
      },
    })
  } catch (err: any) {
    console.error('getStudentReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/reports/teachers
// Export teacher list
// ═══════════════════════════════════════════════════════════
export const getTeacherReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subject, isClassTeacher } = req.query as any

    const filter: Record<string, any> = { isActive: true }
    if (subject) filter.subjects = new RegExp(subject, 'i')
    if (isClassTeacher !== undefined) filter.isClassTeacher = isClassTeacher === 'true'

    const teachers = await Teacher.find(filter)
      .select(
        'teacherId firstName lastName subjects phone email qualification experience isClassTeacher currentClassTeacherOf joiningDate'
      )
      .sort({ teacherId: 1 })

    const reportData = teachers.map((t, index) => ({
      sno: index + 1,
      teacherId: t.teacherId,
      name: `${t.firstName} ${t.lastName}`,
      subject: t.subjects?.join(', ') || '',
      phone: t.phone,
      email: t.email,
      qualification: t.qualification,
      experience: `${t.experience || 0} years`,
      isClassTeacher: t.isClassTeacher ? 'Yes' : 'No',
      assignedClass: t.isClassTeacher && t.currentClassTeacherOf ? `${t.currentClassTeacherOf.class}-${t.currentClassTeacherOf.section}` : '-',
      joiningDate: t.joiningDate ? new Date(t.joiningDate).toLocaleDateString() : '',
    }))

    res.status(200).json({
      success: true,
      data: {
        filters: { subject, isClassTeacher },
        totalCount: reportData.length,
        generatedAt: new Date().toISOString(),
        teachers: reportData,
      },
    })
  } catch (err: any) {
    console.error('getTeacherReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/reports/attendance
// Attendance report for specified period
// ═══════════════════════════════════════════════════════════
export const getAttendanceReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section, month, year } = req.query as any

    const currentDate = new Date()
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1
    const targetYear = year ? parseInt(year) : currentDate.getFullYear()

    const filter: Record<string, any> = { isActive: true }
    if (cls) filter.currentClass = cls
    if (section) filter.currentSection = section.toUpperCase()

    const students = await Student.find(filter).select(
      'admissionNumber firstName lastName currentClass currentSection rollNumber attendance'
    )

    const reportData = students.map((s, index) => {
      const monthAttendance = (s.attendance || []).find(
        (a: any) => a.month === targetMonth && a.year === targetYear
      )

      return {
        sno: index + 1,
        admissionNumber: s.admissionNumber,
        name: `${s.firstName} ${s.lastName}`,
        class: s.currentClass,
        section: s.currentSection,
        rollNumber: s.rollNumber,
        totalDays: monthAttendance?.totalDays || 0,
        presentDays: monthAttendance?.presentDays || 0,
        absentDays: monthAttendance?.absentDays || 0,
        percentage: monthAttendance?.percentage || 0,
      }
    })

    // Sort by class, section, roll number
    reportData.sort((a, b) => {
      if (a.class !== b.class) return parseInt(a.class) - parseInt(b.class)
      if (a.section !== b.section) return a.section.localeCompare(b.section)
      return parseInt(a.rollNumber) - parseInt(b.rollNumber)
    })

    // Calculate summary
    const summary = {
      totalStudents: reportData.length,
      avgAttendance:
        reportData.length > 0
          ? Math.round(reportData.reduce((sum, s) => sum + s.percentage, 0) / reportData.length)
          : 0,
      below75Count: reportData.filter(s => s.percentage < 75).length,
      above90Count: reportData.filter(s => s.percentage >= 90).length,
    }

    res.status(200).json({
      success: true,
      data: {
        period: { month: targetMonth, year: targetYear },
        filters: { class: cls, section },
        summary,
        generatedAt: new Date().toISOString(),
        students: reportData,
      },
    })
  } catch (err: any) {
    console.error('getAttendanceReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/reports/results
// Exam results report
// ═══════════════════════════════════════════════════════════
export const getResultsReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section, examType = 'half_yearly' } = req.query as any

    const filter: Record<string, any> = { isActive: true }
    if (cls) filter.currentClass = cls
    if (section) filter.currentSection = section.toUpperCase()

    const students = await Student.find(filter).select(
      'admissionNumber firstName lastName currentClass currentSection rollNumber results'
    )

    const reportData = students
      .map((s, index) => {
        const examResult = (s.results || []).find((r: any) => r.examType === examType)

        return {
          sno: index + 1,
          admissionNumber: s.admissionNumber,
          name: `${s.firstName} ${s.lastName}`,
          class: s.currentClass,
          section: s.currentSection,
          rollNumber: s.rollNumber,
          totalMarks: examResult?.totalMarks || 0,
          marksObtained: examResult?.totalObtained || 0,
          percentage: examResult?.percentage || 0,
          rank: examResult?.rank || '-',
          result: examResult?.result || 'N/A',
        }
      })
      .sort((a, b) => {
        if (a.class !== b.class) return parseInt(a.class) - parseInt(b.class)
        if (a.section !== b.section) return a.section.localeCompare(b.section)
        return b.percentage - a.percentage
      })

    // Calculate summary
    const studentsWithResults = reportData.filter(s => s.result !== 'N/A')
    const passCount = studentsWithResults.filter(s => s.result === 'pass').length
    const failCount = studentsWithResults.filter(s => s.result === 'fail').length

    const summary = {
      totalStudents: reportData.length,
      resultsEntered: studentsWithResults.length,
      passCount,
      failCount,
      passPercentage:
        studentsWithResults.length > 0
          ? Math.round((passCount / studentsWithResults.length) * 100)
          : 0,
      avgPercentage:
        studentsWithResults.length > 0
          ? Math.round(
              studentsWithResults.reduce((sum, s) => sum + s.percentage, 0) /
                studentsWithResults.length
            )
          : 0,
    }

    res.status(200).json({
      success: true,
      data: {
        examType,
        filters: { class: cls, section },
        summary,
        generatedAt: new Date().toISOString(),
        students: reportData,
      },
    })
  } catch (err: any) {
    console.error('getResultsReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/reports/school-summary
// Complete school summary report
// ═══════════════════════════════════════════════════════════
export const getSchoolSummaryReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Counts
    const [totalStudents, totalTeachers, totalParents, maleStudents, femaleStudents] =
      await Promise.all([
        Student.countDocuments({ isActive: true }),
        Teacher.countDocuments({ isActive: true }),
        Parent.countDocuments({ isActive: true }),
        Student.countDocuments({ isActive: true, gender: 'male' }),
        Student.countDocuments({ isActive: true, gender: 'female' }),
      ])

    // Students by class
    const studentsByClass = await Student.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$currentClass',
          total: { $sum: 1 },
          male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
          female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Teachers by subject
    const teachersBySubject = await Teacher.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$subjects' },
      { $group: { _id: '$subjects', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    // Class teachers count
    const classTeachersCount = await Teacher.countDocuments({
      isActive: true,
      isClassTeacher: true,
    })

    res.status(200).json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        overview: {
          totalStudents,
          totalTeachers,
          totalParents,
          classTeachersCount,
          studentGenderRatio: {
            male: maleStudents,
            female: femaleStudents,
            malePercentage: Math.round((maleStudents / totalStudents) * 100),
            femalePercentage: Math.round((femaleStudents / totalStudents) * 100),
          },
        },
        studentsByClass: studentsByClass.map(c => ({
          class: c._id,
          total: c.total,
          male: c.male,
          female: c.female,
        })),
        teachersBySubject: teachersBySubject.map(t => ({
          subject: t._id,
          count: t.count,
        })),
      },
    })
  } catch (err: any) {
    console.error('getSchoolSummaryReport error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
