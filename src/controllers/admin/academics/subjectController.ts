import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import SubjectMaster from '../../../models/admin/SubjectMaster'

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { academicSession } = req.body as { academicSession?: string }

    if (!academicSession) {
      res.status(400).json({ success: false, message: 'academicSession is required.' })
      return
    }

    const subject = await SubjectMaster.create(req.body)

    res.status(201).json({
      success: true,
      data: subject,
      message: 'Subject created successfully.',
    })
  } catch (error: unknown) {
    console.error('createSubject error:', error)
    res.status(500).json({ success: false, message: 'Server error creating subject.' })
  }
}

export const getSubjectsBySession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params

    const subjects = await SubjectMaster.find({ academicSession: sessionId }).sort({ subjectName: 1 })

    res.status(200).json({
      success: true,
      data: subjects,
      message: 'Subjects fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getSubjectsBySession error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching subjects.' })
  }
}

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const subject = await SubjectMaster.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    })

    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: subject,
      message: 'Subject updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateSubject error:', error)
    res.status(500).json({ success: false, message: 'Server error updating subject.' })
  }
}

export const toggleSubjectStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const subject = await SubjectMaster.findById(id)
    if (!subject) {
      res.status(404).json({ success: false, message: 'Subject not found.' })
      return
    }

    subject.isActive = !subject.isActive
    await subject.save()

    res.status(200).json({
      success: true,
      data: subject,
      message: 'Subject status toggled successfully.',
    })
  } catch (error: unknown) {
    console.error('toggleSubjectStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error toggling subject status.' })
  }
}
