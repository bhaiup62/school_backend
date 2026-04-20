import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import Application from '../../../models/admin/Application'

export const scheduleTest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.id || req.params.applicationId || req.body.applicationId
    const { interviewDate } = req.body as { interviewDate?: Date }

    if (!applicationId || !interviewDate) {
      res.status(400).json({
        success: false,
        message: 'applicationId and interviewDate are required.',
      })
      return
    }

    const application = await Application.findById(applicationId)
    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' })
      return
    }

    const allowedStatusesForScheduling = [
      'Document Verified',
      'Test Scheduled',
      'Offered',
      'Waitlisted',
      'Admitted',
    ]

    if (!allowedStatusesForScheduling.includes(application.pipelineStatus)) {
      res.status(400).json({
        success: false,
        message: 'Cannot schedule a test. Documents must be verified first.',
      })
      return
    }

    application.assessment.interviewDate = interviewDate
    application.pipelineStatus = 'Test Scheduled'
    await application.save()

    res.status(200).json({
      success: true,
      data: application,
      message: 'Test scheduled successfully.',
    })
  } catch (error: unknown) {
    console.error('scheduleTest error:', error)
    res.status(500).json({ success: false, message: 'Server error scheduling test.' })
  }
}

export const updateTestScore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.id || req.params.applicationId || req.body.applicationId
    const { testScore } = req.body as { testScore?: number }

    if (!applicationId || typeof testScore !== 'number') {
      res.status(400).json({
        success: false,
        message: 'applicationId and testScore are required.',
      })
      return
    }

    const application = await Application.findById(applicationId)
    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' })
      return
    }

    const allowedStatusesForScoreUpdate = [
      'Test Scheduled',
      'Offered',
      'Waitlisted',
      'Admitted',
    ]

    if (!allowedStatusesForScoreUpdate.includes(application.pipelineStatus)) {
      res.status(400).json({
        success: false,
        message: 'Cannot update score. A test must be scheduled first.',
      })
      return
    }

    application.assessment.testScore = testScore
    await application.save()

    res.status(200).json({
      success: true,
      data: application,
      message: 'Test score updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateTestScore error:', error)
    res.status(500).json({ success: false, message: 'Server error updating test score.' })
  }
}

export const getScheduledTests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scheduledTests = await Application.find({ pipelineStatus: 'Test Scheduled' })
      .populate('appliedClass')
      .sort({ 'assessment.interviewDate': 1 })

    res.status(200).json({
      success: true,
      data: scheduledTests,
      message: 'Scheduled tests fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getScheduledTests error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching scheduled tests.' })
  }
}
