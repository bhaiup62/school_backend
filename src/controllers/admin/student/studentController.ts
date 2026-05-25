import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import Student from '../../../models/student/Student'
import User from '../../../models/shared/User'

export const getAllStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: classFilter, section, session, isActive, search } = req.query as {
      class?: string
      section?: string
      session?: string
      isActive?: string
      search?: string
    }

    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1)
    const limit = Math.max(parseInt((req.query.limit as string) || '50', 10), 1)
    const skip = (page - 1) * limit

    const filter: Record<string, any> = {}

    if (classFilter) filter.currentClass = classFilter
    if (section) filter.currentSection = section
    if (session) filter.currentSession = session
    if (typeof isActive === 'string') {
      if (isActive.toLowerCase() === 'true') filter.isActive = true
      if (isActive.toLowerCase() === 'false') filter.isActive = false
    }

    if (search) {
      const regex = new RegExp(search, 'i')
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { admissionNumber: regex },
      ]
    }

    const [students, total] = await Promise.all([
      Student.find(filter).sort({ rollNumber: 1 }).skip(skip).limit(limit),
      Student.countDocuments(filter),
    ])

    res.status(200).json({
      success: true,
      data: students,
      pagination: {
        total,
        page,
        limit,
      },
      message: 'Students fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getAllStudents error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching students.' })
  }
}

export const getStudentProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const student = await Student.findById(id)
      .populate('user')
      .populate('applicationId')

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: student,
      message: 'Student profile fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getStudentProfile error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching student profile.' })
  }
}

export const updateStudentProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { firstName, lastName, bloodGroup, parents, transport, medicalRecord } = req.body as {
      firstName?: string
      lastName?: string
      bloodGroup?: string
      parents?: Record<string, any>
      transport?: Record<string, any>
      medicalRecord?: Record<string, any>
    }

    const existingStudent = await Student.findById(id)
    if (!existingStudent) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    const updatePayload: Record<string, any> = {}

    if (firstName !== undefined) updatePayload.firstName = firstName
    if (lastName !== undefined) updatePayload.lastName = lastName
    if (bloodGroup !== undefined) updatePayload.bloodGroup = bloodGroup

    if (parents) {
      updatePayload.parents = {
        ...(existingStudent as any).parents,
        ...parents,
      }
    }

    if (transport) {
      updatePayload.transport = {
        ...(existingStudent as any).transport,
        ...transport,
      }
    }

    if (medicalRecord) {
      updatePayload.medicalRecord = {
        ...(existingStudent as any).medicalRecord,
        ...medicalRecord,
      }
    }

    const updatedStudent = await Student.findByIdAndUpdate(id, updatePayload, {
      new: true,
      runValidators: true,
    })

    res.status(200).json({
      success: true,
      data: updatedStudent,
      message: 'Student profile updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateStudentProfile error:', error)
    res.status(500).json({ success: false, message: 'Server error updating student profile.' })
  }
}

export const deactivateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const student = await Student.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    )

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    await User.findByIdAndUpdate(student.user, { isActive: false })

    res.status(200).json({
      success: true,
      data: student,
      message: 'Student deactivated successfully.',
    })
  } catch (error: unknown) {
    console.error('deactivateStudent error:', error)
    res.status(500).json({ success: false, message: 'Server error deactivating student.' })
  }
}
export const bulkPromoteStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentIds, targetClass, targetSection, targetSession } = req.body

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !targetClass || !targetSection || !targetSession) {
      res.status(400).json({ success: false, message: 'Missing required promotion fields.' })
      return
    }

    const students = await Student.find({ _id: { $in: studentIds } })

    for (const student of students) {
      // 1. Archive current state into history
      student.academicHistory.push({
        session: student.currentSession,
        class: student.currentClass,
        section: student.currentSection,
        rollNumber: student.rollNumber,
        isPassed: true
      })

      // 2. Update to new academic year
      student.currentClass = targetClass
      student.currentSection = targetSection
      student.currentSession = targetSession
      student.rollNumber = '' // Reset roll number so Admin can assign new ones later

      await student.save()
    }

    res.status(200).json({
      success: true,
      message: `${students.length} students successfully promoted to ${targetClass}-${targetSection}!`
    })
  } catch (error: unknown) {
    console.error('bulkPromote error:', error)
    res.status(500).json({ success: false, message: 'Server error during bulk promotion.' })
  }
}