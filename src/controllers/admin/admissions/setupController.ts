import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import AcademicSession from '../../../models/admin/AcademicSession'
import ClassMaster from '../../../models/admin/ClassMaster'

type ToggleField = 'isCurrentSession' | 'isAdmissionOpen'

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionName, startDate, endDate } = req.body

    const session = await AcademicSession.create({
      sessionName,
      startDate,
      endDate,
    })

    res.status(201).json({
      success: true,
      data: session,
      message: 'Academic session created successfully.',
    })
  } catch (error: unknown) {
    console.error('createSession error:', error)
    res.status(500).json({ success: false, message: 'Server error creating academic session.' })
  }
}

export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await AcademicSession.find().sort({ startDate: -1 })

    res.status(200).json({
      success: true,
      data: sessions,
      message: 'Academic sessions fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getSessions error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching academic sessions.' })
  }
}

export const toggleSessionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id || req.params.sessionId || req.body.sessionId
    const field = req.body.field as ToggleField

    if (!sessionId || !['isCurrentSession', 'isAdmissionOpen'].includes(field)) {
      res.status(400).json({
        success: false,
        message: 'sessionId and field (isCurrentSession | isAdmissionOpen) are required.',
      })
      return
    }

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    session[field] = !session[field]
    await session.save()

    res.status(200).json({
      success: true,
      data: session,
      message: `${field} updated successfully.`,
    })
  } catch (error: unknown) {
    console.error('toggleSessionStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error updating session status.' })
  }
}

export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { className, totalCapacity, minimumAgeCutoffDate, applicationFeeAmount } = req.body

    const classMaster = await ClassMaster.create({
      className,
      totalCapacity,
      availableSeats: totalCapacity,
      minimumAgeCutoffDate,
      applicationFeeAmount,
    })

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

export const getClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classes = await ClassMaster.find()

    res.status(200).json({
      success: true,
      data: classes,
      message: 'Classes fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getClasses error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching classes.' })
  }
}

export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.id || req.params.classId || req.body.classId
    const { totalCapacity, applicationFeeAmount } = req.body as {
      totalCapacity?: number
      applicationFeeAmount?: number
    }

    if (!classId) {
      res.status(400).json({ success: false, message: 'classId is required.' })
      return
    }

    const classMaster = await ClassMaster.findById(classId)
    if (!classMaster) {
      res.status(404).json({ success: false, message: 'Class not found.' })
      return
    }

    if (typeof totalCapacity === 'number') {
      const occupiedSeats = classMaster.totalCapacity - classMaster.availableSeats
      classMaster.totalCapacity = totalCapacity
      classMaster.availableSeats = Math.max(totalCapacity - occupiedSeats, 0)
    }

    if (typeof applicationFeeAmount === 'number') {
      classMaster.applicationFeeAmount = applicationFeeAmount
    }

    await classMaster.save()

    res.status(200).json({
      success: true,
      data: classMaster,
      message: 'Class updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateClass error:', error)
    res.status(500).json({ success: false, message: 'Server error updating class.' })
  }
}
