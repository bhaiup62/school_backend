// src/controllers/principal/dashboardController.ts
// Dashboard & Analytics endpoints for Principal

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Student from '../../models/student/Student'
import Teacher from '../../models/teacher/Teacher'
import Parent from '../../models/parent/Parent'
import Receptionist from '../../models/receptionist/Receptionist'
import Principal from '../../models/principal/Principal'

// Helper to get principal profile
const getPrincipal = async (admissionNumber: string) => {
  return Principal.findOne({ principalId: admissionNumber, isActive: true })
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/profile
// ═══════════════════════════════════════════════════════════
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const principal = await getPrincipal(req.user!.admissionNumber)
    if (!principal) {
      res.status(404).json({ success: false, message: 'Principal not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        principalId:    principal.principalId,
        firstName:      principal.firstName,
        lastName:       principal.lastName,
        fullName:       principal.fullName,
        phone:          principal.phone,
        email:          principal.email,
        address:        principal.address,
        city:           principal.city,
        pincode:        principal.pincode,
        qualification:  principal.qualification,
        experience:     principal.experience,
        specialization: principal.specialization,
        joiningDate:    principal.joiningDate,
        isActive:       principal.isActive,
      },
    })
  } catch (err: any) {
    console.error('getProfile error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/dashboard/stats
// School-wide statistics
// ═══════════════════════════════════════════════════════════
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Count all entities
    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalReceptionists,
    ] = await Promise.all([
      Student.countDocuments({ isActive: true }),
      Teacher.countDocuments({ isActive: true }),
      Parent.countDocuments({ isActive: true }),
      Receptionist.countDocuments({ isActive: true }),
    ])

    // Students by class
    const studentsByClass = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$class', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])

    // Students by gender
    const studentsByGender = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
    ])

    // Today's attendance summary (aggregate from all classes)
    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()
    const todayDate = today.toISOString().split('T')[0]

    // Get today's attendance across all students
    const attendanceToday = await Student.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$attendance' },
      { $match: { 'attendance.month': currentMonth, 'attendance.year': currentYear } },
      { $unwind: '$attendance.records' },
      {
        $match: {
          $expr: {
            $eq: [
              { $dateToString: { format: '%Y-%m-%d', date: '$attendance.records.date' } },
              todayDate,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$attendance.records.status',
          count: { $sum: 1 },
        },
      },
    ])

    const presentToday = attendanceToday.find(a => a._id === 'present')?.count || 0
    const absentToday = attendanceToday.find(a => a._id === 'absent')?.count || 0
    const totalMarked = presentToday + absentToday

    // Class teachers count
    const classTeachersCount = await Teacher.countDocuments({
      isActive: true,
      isClassTeacher: true,
    })

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalTeachers,
          totalParents,
          totalReceptionists,
          classTeachersCount,
        },
        studentsByClass: studentsByClass.map(s => ({
          class: s._id,
          count: s.count,
        })),
        studentsByGender: studentsByGender.map(s => ({
          gender: s._id,
          count: s.count,
        })),
        todayAttendance: {
          present: presentToday,
          absent: absentToday,
          totalMarked,
          percentage: totalMarked > 0 ? Math.round((presentToday / totalMarked) * 100) : 0,
        },
      },
    })
  } catch (err: any) {
    console.error('getDashboardStats error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/dashboard/class-summary
// Summary of each class with section breakdown
// ═══════════════════════════════════════════════════════════
export const getClassSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classSummary = await Student.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: { class: '$class', section: '$section' },
          count: { $sum: 1 },
          maleCount: {
            $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] },
          },
          femaleCount: {
            $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] },
          },
        },
      },
      {
        $group: {
          _id: '$_id.class',
          sections: {
            $push: {
              section: '$_id.section',
              count: '$count',
              male: '$maleCount',
              female: '$femaleCount',
            },
          },
          totalStudents: { $sum: '$count' },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Get class teachers for each class
    const classTeachers = await Teacher.find({
      isActive: true,
      isClassTeacher: true,
    }).select('firstName lastName currentClassTeacherOf')

    const classTeacherMap: Record<string, string> = {}
    classTeachers.forEach(t => {
      if (t.currentClassTeacherOf) {
        const key = `${t.currentClassTeacherOf.class}-${t.currentClassTeacherOf.section}`
        classTeacherMap[key] = `${t.firstName} ${t.lastName}`
      }
    })

    const result = classSummary.map(c => ({
      class: c._id,
      totalStudents: c.totalStudents,
      sections: c.sections.map((s: any) => ({
        ...s,
        classTeacher: classTeacherMap[`${c._id}-${s.section}`] || 'Not Assigned',
      })),
    }))

    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('getClassSummary error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/dashboard/recent-activity
// Recent activities across the school
// ═══════════════════════════════════════════════════════════
export const getRecentActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get recently added students (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentStudents = await Student.find({
      isActive: true,
      createdAt: { $gte: sevenDaysAgo },
    })
      .select('firstName lastName admissionNumber class section createdAt')
      .sort({ createdAt: -1 })
      .limit(10)

    // Get recently added teachers
    const recentTeachers = await Teacher.find({
      isActive: true,
      createdAt: { $gte: sevenDaysAgo },
    })
      .select('firstName lastName teacherId subjects createdAt')
      .sort({ createdAt: -1 })
      .limit(5)

    res.status(200).json({
      success: true,
      data: {
        recentStudents: recentStudents.map(s => ({
          id: s.admissionNumber,
          name: `${s.firstName} ${s.lastName}`,
          class: `${s.currentClass}-${s.currentSection}`,
          addedOn: s.createdAt,
        })),
        recentTeachers: recentTeachers.map(t => ({
          id: t.teacherId,
          name: `${t.firstName} ${t.lastName}`,
          subject: t.subjects?.join(', ') || '',
          addedOn: t.createdAt,
        })),
      },
    })
  } catch (err: any) {
    console.error('getRecentActivity error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
