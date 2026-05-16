import { Response } from 'express'
import mongoose from 'mongoose'
import { AuthRequest } from '../../../middleware/authMiddleware'
import ClassMaster from '../../../models/admin/ClassMaster'

export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classMaster = await ClassMaster.create(req.body)

    res.status(201).json({
      success: true,
      data: classMaster,
      message: 'Class created successfully.',
    })
  } catch (error: unknown) {
    console.error('createClass error:', error)
    res.status(500).json({ success: false, message: 'Server error creating class.' })
  }
}

export const getClassesBySession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params

    const classes = await ClassMaster.find({ academicSession: sessionId })
      .populate('sections.classTeacher', 'firstName lastName teacherId')
      .sort({ className: 1 })

    res.status(200).json({
      success: true,
      data: classes,
      message: 'Classes fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getClassesBySession error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching classes.' })
  }
}

export const getClassById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const classMaster = await ClassMaster.findById(id).populate(
      'sections.classTeacher',
      'firstName lastName teacherId'
    )

    if (!classMaster) {
      res.status(404).json({ success: false, message: 'Class not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: classMaster,
      message: 'Class fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getClassById error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching class.' })
  }
}

export const addSection = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { sectionName, capacity, classTeacher } = req.body as {
      sectionName?: string
      capacity?: number
      classTeacher?: string
    }

    if (!sectionName || typeof capacity !== 'number') {
      res.status(400).json({ success: false, message: 'sectionName and capacity are required.' })
      return
    }

    if (classTeacher && !mongoose.Types.ObjectId.isValid(classTeacher)) {
      res.status(400).json({ success: false, message: 'Invalid classTeacher.' })
      return
    }

    const classMaster = await ClassMaster.findById(id)
    if (!classMaster) {
      res.status(404).json({ success: false, message: 'Class not found.' })
      return
    }

    // Check for duplicate section names
    const sectionExists = classMaster.sections.some(
      (s) => s.sectionName.toUpperCase() === sectionName.toUpperCase()
    )
    if (sectionExists) {
      res.status(400).json({ success: false, message: 'Section already exists in this class.' })
      return
    }

    const sectionToAdd = classTeacher
      ? {
          sectionName: sectionName.toUpperCase(),
          capacity,
          classTeacher: new mongoose.Types.ObjectId(classTeacher),
        }
      : { sectionName: sectionName.toUpperCase(), capacity }

    classMaster.sections.push(sectionToAdd)
    
    // CRITICAL FIX: Increment available seats manually since the hook only handles 'isNew'
    classMaster.availableSeats += capacity; 
    
    await classMaster.save()

    const populatedClass = await ClassMaster.findById(id).populate(
      'sections.classTeacher',
      'firstName lastName teacherId'
    )

    res.status(200).json({
      success: true,
      data: populatedClass,
      message: 'Section added successfully.',
    })
  } catch (error: unknown) {
    console.error('addSection error:', error)
    res.status(500).json({ success: false, message: 'Server error adding section.' })
  }
}

export const assignClassTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, sectionName } = req.params
    const { teacherId } = req.body as { teacherId?: string }

    if (!teacherId) {
      res.status(400).json({ success: false, message: 'teacherId is required.' })
      return
    }

    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      res.status(400).json({ success: false, message: 'Invalid teacherId.' })
      return
    }

    const classMaster = await ClassMaster.findById(classId)
    if (!classMaster) {
      res.status(404).json({ success: false, message: 'Class not found.' })
      return
    }

    const section = classMaster.sections.find((entry) => entry.sectionName === sectionName)
    if (!section) {
      res.status(404).json({ success: false, message: 'Section not found.' })
      return
    }

    section.classTeacher = new mongoose.Types.ObjectId(teacherId)
    await classMaster.save()

    const updatedClass = await ClassMaster.findById(classId).populate(
      'sections.classTeacher',
      'firstName lastName teacherId'
    )

    res.status(200).json({
      success: true,
      data: updatedClass,
      message: 'Class teacher assigned successfully.',
    })
  } catch (error: unknown) {
    console.error('assignClassTeacher error:', error)
    res.status(500).json({ success: false, message: 'Server error assigning class teacher.' })
  }
}
