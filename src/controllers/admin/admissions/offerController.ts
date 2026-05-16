import mongoose, { ClientSession } from 'mongoose'
import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import Application from '../../../models/admin/Application'
import ClassMaster from '../../../models/admin/ClassMaster'
import AcademicSession from '../../../models/admin/AcademicSession'
import Parent from '../../../models/parent/Parent'
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

  if (!counter) {
    throw new Error('ADMISSION_COUNTER_FAILED')
  }

  return `SPS-${year}-${String(counter.seq).padStart(4, '0')}`
}

const getNextParentId = async (dbSession: ClientSession): Promise<string> => {
  const year = new Date().getFullYear()
  const counterId = `PAR-${year}`

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session: dbSession }
  )

  if (!counter) {
    throw new Error('PARENT_COUNTER_FAILED')
  }

  return `PAR-${year}-${String(counter.seq).padStart(4, '0')}`
}

const splitName = (fullName: string): { firstName: string; lastName: string } => {
  const trimmed = fullName.trim()
  if (!trimmed) {
    return { firstName: 'Parent', lastName: 'User' }
  }

  const parts = trimmed.split(/\s+/)
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || parts[0],
  }
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
    let createdParent: any = null

    await dbSession.withTransaction(async () => {
      const application = await Application.findById(applicationId).session(dbSession)
      if (!application) {
        throw new Error('APPLICATION_NOT_FOUND')
      }

      if (application.pipelineStatus !== 'Offered') {
        throw new Error('APPLICATION_NOT_OFFERED')
      }

      const classMaster = await ClassMaster.findOneAndUpdate(
        { _id: application.appliedClass, availableSeats: { $gt: 0 } },
        { $inc: { availableSeats: -1 } },
        { new: true, session: dbSession }
      )
      if (!classMaster) {
        throw new Error('CLASS_CAPACITY_REACHED')
      }

      const academicSession = await AcademicSession.findById(application.academicSession).session(dbSession)
      if (!academicSession) {
        throw new Error('ACADEMIC_SESSION_NOT_FOUND')
      }

      const admissionNumber = await getNextAdmissionNumber(dbSession)
      const parentId = await getNextParentId(dbSession)

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

      application.pipelineStatus = 'Admitted'
      await application.save({ session: dbSession })

      const { childData, parentData } = application
      const relation: 'father' | 'mother' | 'guardian' = parentData.fatherName
        ? 'father'
        : parentData.motherName
          ? 'mother'
          : 'guardian'
      const primaryParentName =
        (relation === 'father' ? parentData.fatherName : parentData.motherName) ||
        parentData.fatherName ||
        parentData.motherName ||
        'Parent User'
      const { firstName: parentFirstName, lastName: parentLastName } = splitName(primaryParentName)

      const studentUser = new User({
        admissionNumber,
        password: 'student123',
        role: 'student',
        isActive: true,
      })
      await studentUser.save({ session: dbSession })

      const genderMap: Record<'Male' | 'Female' | 'Other', 'male' | 'female' | 'other'> = {
        Male: 'male',
        Female: 'female',
        Other: 'other',
      }

      const student = new Student({
        user: studentUser._id,
        admissionNumber,
        applicationId: application._id,
        admissionBatch: application.academicSession,
        firstName: childData.firstName,
        lastName: childData.lastName,
        dateOfBirth: childData.dob,
        gender: genderMap[childData.gender],
        bloodGroup: childData.bloodGroup || '',
        currentClass: classMaster.className,
        currentSection: 'A',
        currentSession: academicSession.sessionName,
        rollNumber,
        admissionDate: new Date(),
        phone: parentData.phone || '',
        email: parentData.email || '',
        parents: {
          fatherName: parentData.fatherName,
          motherName: parentData.motherName,
          fatherPhone: parentData.phone || '',
          motherPhone: parentData.phone || '',
          fatherOccupation: parentData.occupation || '',
          annualFamilyIncome:
            typeof parentData.annualIncome === 'number'
              ? String(parentData.annualIncome)
              : '',
          phone: parentData.phone || '',
          email: parentData.email || '',
        },
        isActive: true,
      })
      await student.save({ session: dbSession })

      const parentUser = new User({
        admissionNumber: parentId,
        password: 'parent123',
        role: 'parent',
        isActive: true,
      })
      await parentUser.save({ session: dbSession })

      const parent = new Parent({
        user: parentUser._id,
        parentId,
        firstName: parentFirstName,
        lastName: parentLastName,
        phone: parentData.phone || '',
        email: parentData.email || '',
        occupation: parentData.occupation || '',
        relation,
        children: [admissionNumber],
        isActive: true,
      })
      await parent.save({ session: dbSession })

      createdStudent = student
      createdParent = parent
    })

    res.status(201).json({
      success: true,
      data: { student: createdStudent, parent: createdParent },
      message: 'Admission confirmed successfully.',
    })
  } catch (error: unknown) {
    console.error('confirmAdmission error:', error)

    if (error instanceof Error) {
      const errorMap: Record<string, { status: number; message: string }> = {
        APPLICATION_NOT_FOUND: { status: 404, message: 'Application not found.' },
        APPLICATION_NOT_OFFERED: { status: 400, message: 'Only offered applications can be admitted.' },
        CLASS_CAPACITY_REACHED: { status: 400, message: 'Cannot admit student: Class capacity reached.' },
        ACADEMIC_SESSION_NOT_FOUND: { status: 404, message: 'Academic session not found for this application.' },
        ADMISSION_COUNTER_FAILED: { status: 500, message: 'Failed to generate admission number.' },
        PARENT_COUNTER_FAILED: { status: 500, message: 'Failed to generate parent ID.' },
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
