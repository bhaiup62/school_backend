import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import SchoolEvent from '../../../models/admin/SchoolEvent'

export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicSession } = req.body as { academicSession?: string }

    if (!academicSession) {
      res.status(400).json({ success: false, message: 'academicSession is required.' })
      return
    }

    const event = await SchoolEvent.create(req.body)

    res.status(201).json({
      success: true,
      data: event,
      message: 'School event created successfully.',
    })
  } catch (error: unknown) {
    console.error('createEvent error:', error)
    res.status(500).json({ success: false, message: 'Server error creating school event.' })
  }
}

export const getEventsBySession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params

    const events = await SchoolEvent.find({ academicSession: sessionId })
      .sort({ startDate: 1 })
      .populate('appliesToClasses', 'className')

    res.status(200).json({
      success: true,
      data: events,
      message: 'School events fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getEventsBySession error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching school events.' })
  }
}

export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const deletedEvent = await SchoolEvent.findByIdAndDelete(id)
    if (!deletedEvent) {
      res.status(404).json({ success: false, message: 'School event not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: deletedEvent,
      message: 'School event deleted successfully.',
    })
  } catch (error: unknown) {
    console.error('deleteEvent error:', error)
    res.status(500).json({ success: false, message: 'Server error deleting school event.' })
  }
}
