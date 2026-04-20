import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import AcademicSession, { IAcademicSession, IAcademicTerm } from '../../../models/admin/AcademicSession'

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await AcademicSession.create(req.body)

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

export const getAllSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await AcademicSession.find().sort({ startDate: -1 })

    res.status(200).json({
      success: true,
      data: sessions,
      message: 'Academic sessions fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getAllSessions error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching academic sessions.' })
  }
}

export const getSessionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: session,
      message: 'Academic session fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getSessionById error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching academic session.' })
  }
}

export const updateSessionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id
    const { status } = req.body as { status?: IAcademicSession['status'] }

    if (!status) {
      res.status(400).json({ success: false, message: 'status is required.' })
      return
    }

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    session.status = status
    await session.save()

    res.status(200).json({
      success: true,
      data: session,
      message: 'Academic session status updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateSessionStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error updating academic session status.' })
  }
}

export const addTermToSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id
    const { term } = req.body as { term?: IAcademicTerm }

    if (!term) {
      res.status(400).json({ success: false, message: 'term is required.' })
      return
    }

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    session.terms.push(term)
    await session.save()

    res.status(200).json({
      success: true,
      data: session,
      message: 'Term added to academic session successfully.',
    })
  } catch (error: unknown) {
    console.error('addTermToSession error:', error)
    res.status(500).json({ success: false, message: 'Server error adding term to academic session.' })
  }
}

export const toggleAdmissionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    session.isAdmissionOpen = !session.isAdmissionOpen
    await session.save()

    res.status(200).json({
      success: true,
      data: session,
      message: 'Admission status toggled successfully.',
    })
  } catch (error: unknown) {
    console.error('toggleAdmissionStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error toggling admission status.' })
  }
}
