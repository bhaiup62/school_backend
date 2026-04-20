// src/controllers/principal/studentsController.ts
// Student viewing & management endpoints for Principal

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'

// ═══════════════════════════════════════════════════════════
// GET /api/principal/students
// List all students with filters
// ═══════════════════════════════════════════════════════════
export const getAllStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      class: cls,
      section,
      search,
      gender,
      page = 1,
      limit = 50,
    } = req.query as any

    const filter: Record<string, any> = { isActive: true }

    if (cls) filter.currentClass = cls
    if (section) filter.currentSection = section.toUpperCase()
    if (gender) filter.gender = gender

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { admissionNumber: searchRegex },
        { 'parents.fatherName': searchRegex },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const students = await Student.find(filter)
      .select('firstName lastName admissionNumber currentClass currentSection rollNumber gender phone parents createdAt')
      .sort({ currentClass: 1, currentSection: 1, rollNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit))

    const total = await Student.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err: any) {
    console.error('getAllStudents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/students/:admissionNumber
// Get detailed student profile with all records
// ═══════════════════════════════════════════════════════════
export const getStudentDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber.toUpperCase(),
      isActive: true,
    })

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: student,
    })
  } catch (err: any) {
    console.error('getStudentDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/students/:admissionNumber/attendance
// Get student's complete attendance history
// ═══════════════════════════════════════════════════════════
export const getStudentAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber.toUpperCase(),
      isActive: true,
    }).select('firstName lastName admissionNumber currentClass currentSection attendance')

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // Calculate overall attendance
    const attendance = student.attendance || []
    let totalDays = 0
    let presentDays = 0

    attendance.forEach((month: any) => {
      totalDays += month.totalDays || 0
      presentDays += month.presentDays || 0
    })

    const overallPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

    res.status(200).json({
      success: true,
      data: {
        student: {
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          class: student.currentClass,
          section: student.currentSection,
        },
        attendance: student.attendance,
        summary: {
          totalDays,
          presentDays,
          absentDays: totalDays - presentDays,
          overallPercentage,
        },
      },
    })
  } catch (err: any) {
    console.error('getStudentAttendance error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/students/:admissionNumber/results
// Get student's complete exam results
// ═══════════════════════════════════════════════════════════
export const getStudentResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber.toUpperCase(),
      isActive: true,
    }).select('firstName lastName admissionNumber currentClass currentSection results')

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        student: {
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          class: student.currentClass,
          section: student.currentSection,
        },
        results: student.results || [],
      },
    })
  } catch (err: any) {
    console.error('getStudentResults error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/students/class/:class/section/:section
// Get all students in a specific class-section
// ═══════════════════════════════════════════════════════════
export const getClassStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section } = req.params

    const students = await Student.find({
      currentClass: cls,
      currentSection: section.toUpperCase(),
      isActive: true,
    })
      .select('firstName lastName admissionNumber currentClass currentSection rollNumber gender phone parents')
      .sort({ rollNumber: 1 })

    res.status(200).json({
      success: true,
      data: {
        class: cls,
        section: section.toUpperCase(),
        count: students.length,
        students,
      },
    })
  } catch (err: any) {
    console.error('getClassStudents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/students/toppers
// Get class-wise toppers based on last exam
// ═══════════════════════════════════════════════════════════
export const getToppers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examType = 'half_yearly', limit: topN = 3 } = req.query as any

    // Get students with their results
    const students = await Student.find({ isActive: true })
      .select('firstName lastName admissionNumber currentClass currentSection results')

    // Group by class and find toppers
    const classToppersMap: Record<string, any[]> = {}

    students.forEach(student => {
      const lastExam = (student.results || [])
        .filter((r: any) => r.examType === examType)
        .sort((a: any, b: any) => new Date(b.declaredOn).getTime() - new Date(a.declaredOn).getTime())[0]

      if (lastExam) {
        const classKey = student.currentClass
        if (!classToppersMap[classKey]) {
          classToppersMap[classKey] = []
        }
        classToppersMap[classKey].push({
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          section: student.currentSection,
          percentage: lastExam.percentage,
          rank: lastExam.rank,
        })
      }
    })

    // Sort and limit per class
    const toppers = Object.entries(classToppersMap).map(([cls, studentsList]) => ({
      class: cls,
      toppers: studentsList
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, parseInt(topN)),
    }))

    res.status(200).json({
      success: true,
      data: toppers.sort((a, b) => parseInt(a.class) - parseInt(b.class)),
    })
  } catch (err: any) {
    console.error('getToppers error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/students/low-attendance
// Students with attendance below threshold
// ═══════════════════════════════════════════════════════════
export const getLowAttendanceStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { threshold = 75 } = req.query as any

    const students = await Student.find({ isActive: true })
      .select('firstName lastName admissionNumber currentClass currentSection attendance')

    const lowAttendance = students
      .map(student => {
        const attendance = student.attendance || []
        let totalDays = 0
        let presentDays = 0

        attendance.forEach((month: any) => {
          totalDays += month.totalDays || 0
          presentDays += month.presentDays || 0
        })

        const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100

        return {
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          class: student.currentClass,
          section: student.currentSection,
          attendancePercentage: percentage,
          totalDays,
          presentDays,
          absentDays: totalDays - presentDays,
        }
      })
      .filter(s => s.attendancePercentage < parseInt(threshold))
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage)

    res.status(200).json({
      success: true,
      data: {
        threshold: parseInt(threshold),
        count: lowAttendance.length,
        students: lowAttendance,
      },
    })
  } catch (err: any) {
    console.error('getLowAttendanceStudents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}