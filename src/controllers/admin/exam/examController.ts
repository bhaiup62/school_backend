import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import Exam from '../../../models/admin/exam/Exam'
import AcademicSession from '../../../models/admin/AcademicSession'

export const createExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activeSession = await AcademicSession.findOne({ isCurrentSession: true }).select('_id')
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active academic session found.' })
      return
    }

    const { name, type, startDate, endDate, classes } = req.body as {
      name?: string
      type?: string
      startDate?: Date
      endDate?: Date
      classes?: string[]
    }

    const exam = await Exam.create({
      name,
      type,
      startDate,
      endDate,
      classes,
      academicSession: activeSession._id,
    })

    res.status(201).json({
      success: true,
      data: exam,
      message: 'Exam created successfully.',
    })
  } catch (error: unknown) {
    console.error('createExam error:', error)
    res.status(500).json({ success: false, message: 'Server error creating exam.' })
  }
}

export const getActiveExams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activeSession = await AcademicSession.findOne({ isCurrentSession: true }).select('_id')
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active academic session found.' })
      return
    }

    const exams = await Exam.find({ academicSession: activeSession._id })
      .populate('classes', 'className displayName')
      .sort({ startDate: 1 })

    res.status(200).json({
      success: true,
      data: exams,
      message: 'Exams fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getActiveExams error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching exams.' })
  }
}

export const updateExamStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examId } = req.params
    const { status } = req.body as { status?: string }

    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      { status },
      { new: true }
    )

    res.status(200).json({
      success: true,
      data: updatedExam,
      message: 'Exam status updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateExamStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error updating exam status.' })
  }
}
