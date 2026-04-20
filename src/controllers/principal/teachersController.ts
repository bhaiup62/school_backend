// src/controllers/principal/teachersController.ts
// Teacher viewing & assignment endpoints for Principal

import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Teacher from '../../models/teacher/Teacher'
import Student from '../../models/student/Student'

// ═══════════════════════════════════════════════════════════
// GET /api/principal/teachers
// List all teachers
// ═══════════════════════════════════════════════════════════
export const getAllTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subject, isClassTeacher, search, page = 1, limit = 50 } = req.query as any

    const filter: Record<string, any> = { isActive: true }

    if (subject) filter.subjects = new RegExp(subject, 'i')
    if (isClassTeacher !== undefined) filter.isClassTeacher = isClassTeacher === 'true'

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { teacherId: searchRegex },
        { subjects: searchRegex },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const teachers = await Teacher.find(filter)
      .select('firstName lastName teacherId subjects phone email isClassTeacher currentClassTeacherOf qualification joiningDate')
      .sort({ teacherId: 1 })
      .skip(skip)
      .limit(parseInt(limit))

    const total = await Teacher.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: teachers.map(t => ({
        ...t.toObject(),
        fullName: `${t.firstName} ${t.lastName}`,
        subject: t.subjects?.join(', ') || '',
        assignedClass: t.currentClassTeacherOf?.class || '',
        assignedSection: t.currentClassTeacherOf?.section || '',
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err: any) {
    console.error('getAllTeachers error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/teachers/:teacherId
// Get detailed teacher profile
// ═══════════════════════════════════════════════════════════
export const getTeacherDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await Teacher.findOne({
      teacherId: req.params.teacherId.toUpperCase(),
      isActive: true,
    })

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    // Count students if class teacher
    let studentCount = 0
    if (teacher.isClassTeacher && teacher.currentClassTeacherOf?.class && teacher.currentClassTeacherOf?.section) {
      studentCount = await Student.countDocuments({
        currentClass: teacher.currentClassTeacherOf.class,
        currentSection: teacher.currentClassTeacherOf.section,
        isActive: true,
      })
    }

    res.status(200).json({
      success: true,
      data: {
        ...teacher.toObject(),
        fullName: `${teacher.firstName} ${teacher.lastName}`,
        subject: teacher.subjects?.join(', ') || '',
        assignedClass: teacher.currentClassTeacherOf?.class || '',
        assignedSection: teacher.currentClassTeacherOf?.section || '',
        studentCount,
      },
    })
  } catch (err: any) {
    console.error('getTeacherDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/teachers/class/:class/:section
// Get teachers for a specific class-section
// ═══════════════════════════════════════════════════════════
export const getClassTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classTeachers = await Teacher.find({
      isActive: true,
      isClassTeacher: true,
    })
      .select('firstName lastName teacherId currentClassTeacherOf phone email')
      .sort({ 'currentClassTeacherOf.class': 1, 'currentClassTeacherOf.section': 1 })

    // Get student count for each class
    const result = await Promise.all(
      classTeachers.map(async t => {
        const cls = t.currentClassTeacherOf?.class || ''
        const sec = t.currentClassTeacherOf?.section || ''
        const studentCount = cls && sec ? await Student.countDocuments({
          currentClass: cls,
          currentSection: sec,
          isActive: true,
        }) : 0
        return {
          teacherId: t.teacherId,
          name: `${t.firstName} ${t.lastName}`,
          phone: t.phone,
          email: t.email,
          assignedClass: cls,
          assignedSection: sec,
          studentCount,
        }
      })
    )

    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (err: any) {
    console.error('getClassTeachers error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/principal/teachers/:teacherId/assign-class
// Assign a teacher as class teacher
// ═══════════════════════════════════════════════════════════
export const assignClassTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section } = req.body

    if (!cls || !section) {
      res.status(400).json({
        success: false,
        message: 'Class and section are required.',
      })
      return
    }

    const teacher = await Teacher.findOne({
      teacherId: req.params.teacherId.toUpperCase(),
      isActive: true,
    })

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    // Check if another teacher is already assigned to this class-section
    const existingClassTeacher = await Teacher.findOne({
      'currentClassTeacherOf.class': cls,
      'currentClassTeacherOf.section': section.toUpperCase(),
      isClassTeacher: true,
      isActive: true,
      _id: { $ne: teacher._id },
    })

    if (existingClassTeacher) {
      res.status(400).json({
        success: false,
        message: `Class ${cls}-${section} already has a class teacher: ${existingClassTeacher.firstName} ${existingClassTeacher.lastName}`,
      })
      return
    }

    // Update teacher
    teacher.isClassTeacher = true
    teacher.currentClassTeacherOf = { class: cls, section: section.toUpperCase() }
    await teacher.save()

    res.status(200).json({
      success: true,
      message: `${teacher.firstName} ${teacher.lastName} assigned as class teacher for Class ${cls}-${section}`,
      data: {
        teacherId: teacher.teacherId,
        name: `${teacher.firstName} ${teacher.lastName}`,
        assignedClass: teacher.currentClassTeacherOf.class,
        assignedSection: teacher.currentClassTeacherOf.section,
      },
    })
  } catch (err: any) {
    console.error('assignClassTeacher error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// POST /api/principal/teachers/:teacherId/remove-class
// Remove class teacher assignment
// ═══════════════════════════════════════════════════════════
export const removeClassTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await Teacher.findOne({
      teacherId: req.params.teacherId.toUpperCase(),
      isActive: true,
    })

    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    if (!teacher.isClassTeacher) {
      res.status(400).json({
        success: false,
        message: 'This teacher is not a class teacher.',
      })
      return
    }

    const previousClass = `${teacher.currentClassTeacherOf?.class || ''}-${teacher.currentClassTeacherOf?.section || ''}`

    teacher.isClassTeacher = false
    teacher.currentClassTeacherOf = null
    await teacher.save()

    res.status(200).json({
      success: true,
      message: `${teacher.firstName} ${teacher.lastName} removed as class teacher from Class ${previousClass}`,
    })
  } catch (err: any) {
    console.error('removeClassTeacher error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/teachers/subject/:subject
// Get teachers by subject
// ═══════════════════════════════════════════════════════════
export const getTeachersBySubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subject } = req.params

    const teachers = await Teacher.find({
      isActive: true,
      subjects: new RegExp(subject, 'i'),
    })
      .select('firstName lastName teacherId subjects phone email isClassTeacher currentClassTeacherOf')
      .sort({ teacherId: 1 })

    res.status(200).json({
      success: true,
      data: teachers.map(t => ({
        teacherId: t.teacherId,
        name: `${t.firstName} ${t.lastName}`,
        subjects: t.subjects,
        phone: t.phone,
        email: t.email,
        isClassTeacher: t.isClassTeacher,
        assignedClass: t.currentClassTeacherOf?.class || '',
        assignedSection: t.currentClassTeacherOf?.section || '',
      })),
    })
  } catch (err: any) {
    console.error('getTeachersBySubject error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ═══════════════════════════════════════════════════════════
// GET /api/principal/teachers/unassigned-classes
// Get classes without class teachers
// ═══════════════════════════════════════════════════════════
export const getUnassignedClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get assigned class-sections
    const assignedClassTeachers = await Teacher.find({
      isActive: true,
      isClassTeacher: true,
      currentClassTeacherOf: { $ne: null },
    }).select('currentClassTeacherOf')

    const assignedSet = new Set(
      assignedClassTeachers
        .filter(t => t.currentClassTeacherOf)
        .map(t => `${t.currentClassTeacherOf!.class}-${t.currentClassTeacherOf!.section}`)
    )

    // Get class-sections that have students but no teacher
    const classSectionsWithStudents = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: { class: '$currentClass', section: '$currentSection' }, count: { $sum: 1 } } },
    ])

    const unassigned = classSectionsWithStudents
      .filter(cs => !assignedSet.has(`${cs._id.class}-${cs._id.section}`))
      .map(cs => ({
        class: cs._id.class,
        section: cs._id.section,
        studentCount: cs.count,
      }))
      .sort((a, b) => parseInt(a.class) - parseInt(b.class) || a.section.localeCompare(b.section))

    res.status(200).json({
      success: true,
      data: unassigned,
    })
  } catch (err: any) {
    console.error('getUnassignedClasses error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}