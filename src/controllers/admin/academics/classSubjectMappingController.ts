import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../../../middleware/authMiddleware'
import ClassSubjectMapping from '../../../models/admin/ClassSubjectMapping'

export const assignSubjectToClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params
    const { academicSession, subjectId, isMandatory, periodsPerWeek, teachers } = req.body as {
      academicSession?: string
      subjectId?: string
      isMandatory?: boolean
      periodsPerWeek?: number
      teachers?: string[]
    }

    if (!classId || !academicSession || !subjectId || typeof periodsPerWeek !== 'number') {
      res.status(400).json({
        success: false,
        message: 'classId, academicSession, subjectId, and periodsPerWeek are required.',
      })
      return
    }

    if (!Array.isArray(teachers)) {
      res.status(400).json({ success: false, message: 'teachers must be an array of ObjectIds.' })
      return
    }

    if (
      !mongoose.Types.ObjectId.isValid(classId) ||
      !mongoose.Types.ObjectId.isValid(academicSession) ||
      !mongoose.Types.ObjectId.isValid(subjectId)
    ) {
      res.status(400).json({ success: false, message: 'Invalid classId, academicSession, or subjectId.' })
      return
    }

    const hasInvalidTeacherId = teachers.some((teacherId) => !mongoose.Types.ObjectId.isValid(teacherId))
    if (hasInvalidTeacherId) {
      res.status(400).json({ success: false, message: 'teachers must contain valid ObjectIds.' })
      return
    }

    const mapping = await ClassSubjectMapping.create({
      classId: new mongoose.Types.ObjectId(classId),
      academicSession: new mongoose.Types.ObjectId(academicSession),
      subjectId: new mongoose.Types.ObjectId(subjectId),
      isMandatory,
      periodsPerWeek,
      teachers: teachers.map((teacherId) => new mongoose.Types.ObjectId(teacherId)),
    })

    res.status(201).json({
      success: true,
      data: mapping,
      message: 'Subject assigned to class successfully.',
    })
  } catch (error: unknown) {
    console.error('assignSubjectToClass error:', error)
    res.status(500).json({ success: false, message: 'Server error assigning subject to class.' })
  }
}

export const getSubjectsForClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params

    if (!classId) {
      res.status(400).json({ success: false, message: 'classId is required.' })
      return
    }

    const mappings = await ClassSubjectMapping.find({ classId })
      .populate('subjectId', 'subjectName subjectCode type')
      .populate('teachers', 'firstName lastName teacherId')

    res.status(200).json({
      success: true,
      data: mappings,
      message: 'Class subjects fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getSubjectsForClass error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching class subjects.' })
  }
}

export const removeSubjectFromClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mappingId } = req.params

    const deletedMapping = await ClassSubjectMapping.findByIdAndDelete(mappingId)
    if (!deletedMapping) {
      res.status(404).json({ success: false, message: 'Class-subject mapping not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: deletedMapping,
      message: 'Subject removed from class successfully.',
    })
  } catch (error: unknown) {
    console.error('removeSubjectFromClass error:', error)
    res.status(500).json({ success: false, message: 'Server error removing subject from class.' })
  }
}

export const getAcademicsTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const Teacher = mongoose.models.Teacher || mongoose.model('Teacher')
    // Fetch active teachers directly from the Teacher profile collection
    const teachers = await Teacher.find({ isActive: true })
      .select('firstName lastName teacherId')
      .sort({ firstName: 1 })

    res.status(200).json({ success: true, data: teachers })
  } catch (error: unknown) {
    console.error('getAcademicsTeachers error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching teachers.' })
  }
}
export const updateSubjectMapping = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mappingId } = req.params
    const { isMandatory, periodsPerWeek, teachers } = req.body

    // CRITICAL FIX: Strict validation on the teachers array to prevent CastErrors
    if (teachers !== undefined) {
      if (!Array.isArray(teachers)) {
        res.status(400).json({ success: false, message: 'teachers must be an array of ObjectIds.' })
        return
      }

      const hasInvalidTeacherId = teachers.some((teacherId) => !mongoose.Types.ObjectId.isValid(teacherId))
      if (hasInvalidTeacherId) {
        res.status(400).json({ success: false, message: 'teachers array contains invalid IDs.' })
        return
      }
    }

    // Map to actual ObjectIds if valid
    const teacherObjectIds = teachers ? teachers.map((id: string) => new mongoose.Types.ObjectId(id)) : undefined

    const updatePayload: any = { isMandatory, periodsPerWeek }
    if (teacherObjectIds) updatePayload.teachers = teacherObjectIds

    const updatedMapping = await mongoose.models.ClassSubjectMapping.findByIdAndUpdate(
      mappingId,
      updatePayload,
      { new: true }
    ).populate('teachers', 'firstName lastName teacherId') // Return populated data for UI sync

    if (!updatedMapping) {
      res.status(404).json({ success: false, message: 'Mapping not found.' })
      return
    }

    res.status(200).json({ success: true, data: updatedMapping, message: 'Updated successfully' })
  } catch (error: unknown) {
    console.error('updateSubjectMapping error:', error)
    res.status(500).json({ success: false, message: 'Server error updating mapping.' })
  }
}