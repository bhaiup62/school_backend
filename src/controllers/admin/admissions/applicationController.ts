import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import Application, { IApplication } from '../../../models/admin/Application'
import AcademicSession from '../../../models/admin/AcademicSession'
import ClassMaster from '../../../models/admin/ClassMaster'
import { Counter } from '../../../models/shared/Counter'

type DocumentStatus = 'Verified' | 'Rejected'

export const createApplication = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activeSession = await AcademicSession.findOne({ isCurrentSession: true })
    if (!activeSession) {
      res.status(400).json({ success: false, message: 'No active academic session found.' })
      return
    }

    if (!activeSession.isAdmissionOpen) {
      res.status(403).json({
        success: false,
        message: 'Admissions are currently closed for the active session.',
      })
      return
    }

    const { academicSession, appliedClass, childData, parentData, payment, documents, assessment } = req.body

    const classMaster = await ClassMaster.findById(appliedClass)
    if (!classMaster) {
      res.status(404).json({ success: false, message: 'Class not found.' })
      return
    }

    if (classMaster.availableSeats <= 0) {
      res.status(400).json({ success: false, message: 'No seats available for this class.' })
      return
    }

    const childDob = new Date(childData?.dob)
    if (Number.isNaN(childDob.getTime())) {
      res.status(400).json({ success: false, message: 'Valid child dob is required.' })
      return
    }

    // NEW FIX: Safely check if minimumAgeCutoffDate exists before comparing
    if (classMaster.minimumAgeCutoffDate) {
      const cutoffDate = new Date(classMaster.minimumAgeCutoffDate)
      if (childDob > cutoffDate) {
        res.status(400).json({
          success: false,
          message: 'Child does not meet the minimum age cutoff date for this class.',
        })
        return
      }
    }

    const escapeRegex = (value: string): string =>
      value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const existingApplication = await Application.findOne({
      academicSession,
      'childData.firstName': {
        $regex: new RegExp(`^${escapeRegex(String(childData?.firstName ?? '').trim())}$`, 'i'),
      },
      'childData.lastName': {
        $regex: new RegExp(`^${escapeRegex(String(childData?.lastName ?? '').trim())}$`, 'i'),
      },
      'childData.dob': childDob,
    })

    if (existingApplication) {
      res.status(400).json({
        success: false,
        message: 'An application for this child already exists for the selected academic session.',
      })
      return
    }

    const counter = await Counter.findOneAndUpdate(
      { id: 'application_number' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, translateAliases: true }
    )
    if (!counter) {
      throw new Error('Failed to generate application number.')
    }
    const applicationNumber = `APP-${new Date().getFullYear()}-${counter.seq.toString().padStart(4, '0')}`

    const application = await Application.create({
      applicationNumber,
      academicSession,
      appliedClass,
      childData,
      parentData,
      payment,
      documents,
      assessment,
      pipelineStatus: 'Draft',
    })

    res.status(201).json({
      success: true,
      data: application,
      message: 'Application created successfully.',
    })
  } catch (error: unknown) {
    console.error('createApplication error:', error)
    res.status(500).json({ success: false, message: 'Server error creating application.' })
  }
}

export const getApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pipelineStatus, appliedClass, academicSession } = req.query as {
      pipelineStatus?: IApplication['pipelineStatus']
      appliedClass?: string
      academicSession?: string
    }

    const filters: {
      pipelineStatus?: IApplication['pipelineStatus']
      appliedClass?: string
      academicSession?: string
    } = {}

    if (pipelineStatus) filters.pipelineStatus = pipelineStatus
    if (appliedClass) filters.appliedClass = appliedClass
    if (academicSession) filters.academicSession = academicSession

    const applications = await Application.find(filters)
      .populate('appliedClass')
      .populate('academicSession')
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      data: applications,
      message: 'Applications fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getApplications error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching applications.' })
  }
}

export const getApplicationById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.id || req.params.applicationId || req.body.applicationId

    if (!applicationId) {
      res.status(400).json({ success: false, message: 'applicationId is required.' })
      return
    }

    const application = await Application.findById(applicationId)
      .populate('appliedClass')
      .populate('academicSession')

    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: application,
      message: 'Application fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getApplicationById error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching application.' })
  }
}

export const updateDocumentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.id || req.params.applicationId || req.body.applicationId
    const { documentIndex, documentType, status } = req.body as {
      documentIndex?: number
      documentType?: string
      status?: 'Verified' | 'Rejected'
    }

    if (!applicationId || !status || !['Verified', 'Rejected'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'applicationId and status (Verified | Rejected) are required.',
      })
      return
    }

    const application = await Application.findById(applicationId)
    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' })
      return
    }

    // ── NEW: Handle the Manual Override Exception ──
    if (documentType === 'Manual Override') {
      application.pipelineStatus = 'Document Verified'
      await application.save()

      res.status(200).json({
        success: true,
        data: application,
        message: 'Documents manually overridden. Pipeline advanced.',
      })
      return
    }
    // ───────────────────────────────────────────────

    let targetIndex = -1

    if (typeof documentIndex === 'number') {
      targetIndex = documentIndex
    } else if (documentType) {
      targetIndex = application.documents.findIndex((doc) => doc.documentType === documentType)
    }

    if (targetIndex < 0 || targetIndex >= application.documents.length) {
      res.status(400).json({
        success: false,
        message: 'Valid documentIndex or documentType is required.',
      })
      return
    }

    application.documents[targetIndex].status = status
    await application.save()

    res.status(200).json({
      success: true,
      data: application,
      message: 'Document status updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateDocumentStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error updating document status.' })
  }
}

export const updatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.id || req.params.applicationId || req.body.applicationId
    const { transactionId } = req.body as { transactionId?: string }

    if (!applicationId || !transactionId) {
      res.status(400).json({
        success: false,
        message: 'applicationId and transactionId are required.',
      })
      return
    }

    const application = await Application.findById(applicationId)
    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' })
      return
    }

    application.payment.status = 'Paid'
    application.payment.transactionId = transactionId
    application.pipelineStatus = 'Submitted'

    await application.save()

    res.status(200).json({
      success: true,
      data: application,
      message: 'Payment updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updatePayment error:', error)
    res.status(500).json({ success: false, message: 'Server error updating payment.' })
  }
}
