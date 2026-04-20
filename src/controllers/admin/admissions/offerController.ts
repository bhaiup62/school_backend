import mongoose, { ClientSession } from 'mongoose'
import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import Application from '../../../models/admin/Application'
import ClassMaster from '../../../models/admin/ClassMaster'
import AcademicSession from '../../../models/admin/AcademicSession'
import Student from '../../../models/student/Student'
import User from '../../../models/shared/User'
import { Counter } from '../../../models/shared/Counter'

type OfferAction = 'Offer' | 'Waitlist' | 'Reject'
type OfferPipelineStatus = 'Offered' | 'Waitlisted' | 'Rejected'

const OFFER_ACTION_STATUS_MAP: Record<OfferAction, OfferPipelineStatus> = {
  Offer: 'Offered',
  Waitlist: 'Waitlisted',
  Reject: 'Rejected',
}

const getNextAdmissionNumber = async (dbSession: ClientSession): Promise<string> => {
  const year = new Date().getFullYear()
  const counterId = `SPS-${year}`

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession }
  )

  return `SPS-${year}-${String(counter!.seq).padStart(4, '0')}`
}

export const updateOfferStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applicationId = req.params.id || req.params.applicationId || req.body.applicationId
    const { action } = req.body as { action?: OfferAction }

    if (!applicationId || !action || !['Offer', 'Waitlist', 'Reject'].includes(action)) {
      res.status(400).json({
        success: false,
        message: 'applicationId and action (Offer | Waitlist | Reject) are required.',
      })
      return
    }

    const application = await Application.findByIdAndUpdate(
      applicationId,
      { pipelineStatus: OFFER_ACTION_STATUS_MAP[action] },
      { new: true, runValidators: true }
    )
      .populate('appliedClass')
      .populate('academicSession')

    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: application,
      message: 'Offer status updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateOfferStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error updating offer status.' })
  }
}

export const confirmAdmission = async (req: AuthRequest, res: Response): Promise<void> => {
  const dbSession = await mongoose.startSession()

  try {
    const applicationId = req.params.id || req.params.applicationId || req.body.applicationId

    if (!applicationId) {
      res.status(400).json({ success: false, message: 'applicationId is required.' })
      return
    }

    let createdStudent: any = null

    await dbSession.withTransaction(async () => {
      const application = await Application.findById(applicationId).session(dbSession)
      if (!application) {
        throw new Error('APPLICATION_NOT_FOUND')
      }

      if (application.pipelineStatus !== 'Offered') {
        throw new Error('APPLICATION_NOT_OFFERED')
      }

      const classMaster = await ClassMaster.findById(application.appliedClass).session(dbSession)
      if (!classMaster) {
        throw new Error('CLASS_NOT_FOUND')
      }

      if (classMaster.availableSeats <= 0) {
        throw new Error('NO_SEATS_AVAILABLE')
      }

      const academicSession = await AcademicSession.findById(application.academicSession).session(dbSession)
      if (!academicSession) {
        throw new Error('ACADEMIC_SESSION_NOT_FOUND')
      }

      const admissionNumber = await getNextAdmissionNumber(dbSession)

      const lastStudent = await Student.findOne({
        currentClass: classMaster.className,
        currentSection: 'A',
        currentSession: academicSession.sessionName,
      })
        .sort({ rollNumber: -1 })
        .select('rollNumber')
        .session(dbSession)
        .lean()

      const rollNumber = lastStudent ? String(parseInt((lastStudent as any).rollNumber, 10) + 1) : '1'

      const user = new User({
        admissionNumber,
        password: 'student123',
        role: 'student',
        isActive: true,
      })
      await user.save({ session: dbSession })

      const genderMap: Record<'Male' | 'Female' | 'Other', 'male' | 'female' | 'other'> = {
        Male: 'male',
        Female: 'female',
        Other: 'other',
      }

      const student = new Student({
        user: user._id,
        admissionNumber,
        applicationId: application._id,
        admissionBatch: application.academicSession,
        firstName: application.childData.firstName,
        lastName: application.childData.lastName,
        dateOfBirth: application.childData.dob,
        gender: genderMap[application.childData.gender],
        bloodGroup: application.childData.bloodGroup || '',
        currentClass: classMaster.className,
        currentSection: 'A',
        currentSession: academicSession.sessionName,
        rollNumber,
        admissionDate: new Date(),
        phone: application.parentData.phone || '',
        email: application.parentData.email || '',
        parents: {
          fatherName: application.parentData.fatherName,
          motherName: application.parentData.motherName,
          fatherPhone: application.parentData.phone || '',
          motherPhone: application.parentData.phone || '',
          fatherOccupation: application.parentData.occupation || '',
          annualFamilyIncome:
            typeof application.parentData.annualIncome === 'number'
              ? String(application.parentData.annualIncome)
              : '',
          phone: application.parentData.phone || '',
          email: application.parentData.email || '',
        },
        isActive: true,
      })
      await student.save({ session: dbSession })

      classMaster.availableSeats -= 1
      await classMaster.save({ session: dbSession })

      application.pipelineStatus = 'Admitted'
      await application.save({ session: dbSession })

      createdStudent = student
    })

    res.status(201).json({
      success: true,
      data: createdStudent,
      message: 'Admission confirmed successfully.',
    })
  } catch (error: unknown) {
    console.error('confirmAdmission error:', error)

    if (error instanceof Error) {
      const errorMap: Record<string, { status: number; message: string }> = {
        APPLICATION_NOT_FOUND: { status: 404, message: 'Application not found.' },
        APPLICATION_NOT_OFFERED: { status: 400, message: 'Only offered applications can be admitted.' },
        CLASS_NOT_FOUND: { status: 404, message: 'Class not found for this application.' },
        NO_SEATS_AVAILABLE: { status: 400, message: 'No available seats in this class.' },
        ACADEMIC_SESSION_NOT_FOUND: { status: 404, message: 'Academic session not found for this application.' },
      }

      const mapped = errorMap[error.message]
      if (mapped) {
        res.status(mapped.status).json({ success: false, message: mapped.message })
        return
      }
    }

    res.status(500).json({ success: false, message: 'Server error confirming admission.' })
  } finally {
    await dbSession.endSession()
  }
}
