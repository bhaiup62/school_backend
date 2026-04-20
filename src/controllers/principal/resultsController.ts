// src/controllers/principal/resultsController.ts
// Exam results viewing & approval for Principal

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'

// ═══════════════════════════════════════════════════════════
// GET /api/principal/results/class/:class/section/:section
// Get exam results for a specific class-section
// ═══════════════════════════════════════════════════════════
export const getClassResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section } = req.params
    const { examType = 'half_yearly', session } = req.query as any

    const students = await Student.find({
      currentClass: cls,
      currentSection: section.toUpperCase(),
      isActive: true,
    }).select('firstName lastName admissionNumber rollNumber currentClass currentSection results')

    const results = students.map(student => {
      let examResult = (student.results || []).find((r: any) => r.examType === examType)

      // If session specified, filter by session
      if (session && examResult) {
        examResult = examResult.session === session ? examResult : undefined
      }

      return {
        admissionNumber: student.admissionNumber,
        name: `${student.firstName} ${student.lastName}`,
        rollNumber: student.rollNumber,
        result: examResult
          ? {
              totalMarks: examResult.totalMarks,
              totalObtained: examResult.totalObtained,
              percentage: examResult.percentage,
              rank: examResult.rank,
              result: examResult.result,
              subjects: examResult.subjects,
            }
          : null,
      }
    })

    // Calculate class statistics
    const studentsWithResults = results.filter(r => r.result !== null)
    const passCount = studentsWithResults.filter(r => r.result?.result === 'pass').length
    const failCount = studentsWithResults.filter(r => r.result?.result === 'fail').length
    const avgPercentage =
      studentsWithResults.length > 0
        ? Math.round(
            studentsWithResults.reduce((sum, r) => sum + (r.result?.percentage || 0), 0) /
              studentsWithResults.length
          )
        : 0

    res.status(200).json({
      success: true,
      data: {
        class: cls,
        section: section.toUpperCase(),
        examType,
        summary: {
          totalStudents: students.length,
          resultsEntered: studentsWithResults.length,
          passCount,
          failCount,
          avgPercentage,
          passPercentage:
            studentsWithResults.length > 0
              ? Math.round((passCount / studentsWithResults.length) * 100)
              : 0,
        },
        students: results.sort((a, b) => parseInt(a.rollNumber) - parseInt(b.rollNumber)),
      },
    })
  } catch (err: any) {
    console.error('getClassResults error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/results/analysis
// School-wide result analysis
// ═══════════════════════════════════════════════════════════
export const getResultAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examType = 'half_yearly' } = req.query as any

    // Get all students with results
    const students = await Student.find({ isActive: true }).select('currentClass currentSection results')

    // Analyze by class
    const classAnalysis: Record<
      string,
      { total: number; pass: number; fail: number; totalPercentage: number }
    > = {}

    students.forEach(student => {
      const examResult = (student.results || []).find((r: any) => r.examType === examType)
      if (!student.currentClass || !examResult) return

      const key = student.currentClass
      if (!classAnalysis[key]) {
        classAnalysis[key] = { total: 0, pass: 0, fail: 0, totalPercentage: 0 }
      }
      classAnalysis[key].total++
      if (examResult.result === 'pass') classAnalysis[key].pass++
      else classAnalysis[key].fail++
      classAnalysis[key].totalPercentage += examResult.percentage || 0
    })

    const byClass = Object.entries(classAnalysis)
      .map(([cls, data]) => ({
        class: cls,
        totalStudents: data.total,
        passCount: data.pass,
        failCount: data.fail,
        passPercentage: data.total > 0 ? Math.round((data.pass / data.total) * 100) : 0,
        avgPercentage: data.total > 0 ? Math.round(data.totalPercentage / data.total) : 0,
      }))
      .sort((a, b) => parseInt(a.class) - parseInt(b.class))

    // Subject-wise analysis (aggregate all subjects)
    const subjectAnalysis: Record<string, { total: number; marksObtained: number; maxMarks: number }> =
      {}

    students.forEach(student => {
      const examResult = (student.results || []).find((r: any) => r.examType === examType)
      if (!examResult || !Array.isArray(examResult.subjects)) return

      examResult.subjects.forEach((sub: any) => {
        if (!sub || !sub.subject) return
        if (!subjectAnalysis[sub.subject]) {
          subjectAnalysis[sub.subject] = { total: 0, marksObtained: 0, maxMarks: 0 }
        }
        subjectAnalysis[sub.subject].total++
        subjectAnalysis[sub.subject].marksObtained += sub.marksObtained || 0
        subjectAnalysis[sub.subject].maxMarks += sub.maxMarks || 0
      })
    })

    const bySubject = Object.entries(subjectAnalysis)
      .map(([subject, data]) => ({
        subject,
        totalStudents: data.total,
        avgMarks: data.total > 0 ? Math.round(data.marksObtained / data.total) : 0,
        maxMarks: data.total > 0 ? Math.round(data.maxMarks / data.total) : 0,
        avgPercentage:
          data.maxMarks > 0 ? Math.round((data.marksObtained / data.maxMarks) * 100) : 0,
      }))
      .sort((a, b) => b.avgPercentage - a.avgPercentage)

    // School-wide summary
    const totalExamined = Object.values(classAnalysis).reduce((sum, d) => sum + d.total, 0)
    const totalPassed = Object.values(classAnalysis).reduce((sum, d) => sum + d.pass, 0)

    res.status(200).json({
      success: true,
      data: {
        examType,
        schoolSummary: {
          totalExamined,
          totalPassed,
          totalFailed: totalExamined - totalPassed,
          passPercentage: totalExamined > 0 ? Math.round((totalPassed / totalExamined) * 100) : 0,
        },
        byClass,
        bySubject,
      },
    })
  } catch (err: any) {
    console.error('ANALYSIS CRASH:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/results/toppers
// Get toppers across all classes
// ═══════════════════════════════════════════════════════════
export const getAllToppers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examType = 'half_yearly', topN = 3 } = req.query as any

    const students = await Student.find({ isActive: true }).select(
      'firstName lastName admissionNumber currentClass currentSection results'
    )

    // Group by class and find toppers
    const classToppersMap: Record<string, any[]> = {}

    students.forEach(student => {
      const examResult = (student.results || []).find((r: any) => r.examType === examType)

      if (examResult) {
        const classKey = student.currentClass
        if (!classToppersMap[classKey]) {
          classToppersMap[classKey] = []
        }
        classToppersMap[classKey].push({
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName}`,
          section: student.currentSection,
          percentage: examResult.percentage,
          totalObtained: examResult.totalObtained,
          totalMarks: examResult.totalMarks,
        })
      }
    })

    // Sort and limit per class
    const toppers = Object.entries(classToppersMap)
      .map(([cls, studentsList]) => ({
        class: cls,
        toppers: studentsList.sort((a, b) => b.percentage - a.percentage).slice(0, parseInt(topN)),
      }))
      .sort((a, b) => parseInt(a.class) - parseInt(b.class))

    // School toppers (across all classes)
    const allStudentsWithResults = students
      .map(student => {
        const examResult = (student.results || []).find((r: any) => r.examType === examType)
        return examResult
          ? {
              admissionNumber: student.admissionNumber,
              name: `${student.firstName} ${student.lastName}`,
              class: student.currentClass,
              section: student.currentSection,
              percentage: examResult.percentage,
            }
          : null
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.percentage - a.percentage)
      .slice(0, 10)

    res.status(200).json({
      success: true,
      data: {
        examType,
        schoolToppers: allStudentsWithResults,
        classWise: toppers,
      },
    })
  } catch (err: any) {
    console.error('getAllToppers error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/results/failed-students
// Get list of failed students
// ═══════════════════════════════════════════════════════════
export const getFailedStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examType = 'half_yearly' } = req.query as any

    const students = await Student.find({ isActive: true }).select(
      'firstName lastName admissionNumber currentClass currentSection phone parents results'
    )

    const failedStudents = students
      .map(student => {
        const examResult = (student.results || []).find((r: any) => r.examType === examType)
        if (examResult && examResult.result === 'fail') {
          return {
            admissionNumber: student.admissionNumber,
            name: `${student.firstName} ${student.lastName}`,
            class: student.currentClass,
            section: student.currentSection,
            percentage: examResult.percentage,
            totalObtained: examResult.totalObtained,
            totalMarks: examResult.totalMarks,
            phone: student.phone,
            parentPhone: (student as any).parents?.phone || '',
          }
        }
        return null
      })
      .filter(Boolean)
      .sort((a: any, b: any) => parseInt(a.class) - parseInt(b.class))

    res.status(200).json({
      success: true,
      data: {
        examType,
        count: failedStudents.length,
        students: failedStudents,
      },
    })
  } catch (err: any) {
    console.error('getFailedStudents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
