import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import ExamSchedule from '../../../models/admin/exam/ExamSchedule'
import Exam from '../../../models/admin/exam/Exam'

export const upsertClassSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examId, classId, schedules } = req.body as {
      examId?: string
      classId?: string
      schedules?: Array<{
        subjectId: string
        examDate: Date
        startTime: string
        endTime: string
        maxMarks: number
        passMarks: number
      }>
    }

    if (!examId || !classId || !Array.isArray(schedules)) {
      res.status(400).json({ success: false, message: 'examId, classId, and schedules are required.' })
      return
    }

    await Exam.findById(examId).select('_id')

    for (const item of schedules) {
      await ExamSchedule.findOneAndUpdate(
        { examId, classId, subjectId: item.subjectId },
        { $set: { ...item } },
        { upsert: true, new: true }
      )
    }

    res.status(200).json({
      success: true,
      message: 'Exam schedule saved successfully.',
    })
  } catch (error: unknown) {
    console.error('upsertClassSchedule error:', error)
    res.status(500).json({ success: false, message: 'Server error saving exam schedule.' })
  }
}

export const getClassSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examId, classId } = req.params

    if (!examId || !classId) {
      res.status(400).json({ success: false, message: 'examId and classId are required.' })
      return
    }

    const schedules = await ExamSchedule.find({ examId, classId })
      .populate('subjectId', 'subjectName subjectCode type hasPractical')
      .sort({ examDate: 1 })

    res.status(200).json({
      success: true,
      data: schedules,
      message: 'Exam schedule fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getClassSchedule error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching exam schedule.' })
  }
}
