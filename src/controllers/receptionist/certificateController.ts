// src/controllers/receptionist/certificateController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import { AuthRequest, getReceptionist } from './receptionistHelpers'
import mongoose from 'mongoose'

// POST /api/receptionist/certificates/bonafide
export const generateBonafideCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { admissionNumber, purpose } = req.body

    if (!admissionNumber) {
      res.status(400).json({ success: false, message: 'Admission Number is required.' })
      return
    }

    const student = await Student.findOne({
      admissionNumber: admissionNumber.toUpperCase(),
      isActive: true,
    }).lean()

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // 🛡️ FIX: Perfectly flattened to match Frontend Interface & Enterprise Schema
    const certificateData = {
      type: 'Bonafide',
      certificateNo: `BON-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      issueDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      fatherName: student.parents?.fatherName || '_______________________',
      sonDaughterOf: student.gender === 'female' ? 'D/O' : 'S/O',
      class: student.currentClass,
      section: student.currentSection,
      rollNumber: student.rollNumber,
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-IN') : '_______________________',
      purpose: purpose || 'General Purpose',
      schoolName: 'Saraswati Public School',
      schoolAddress: 'BHU Campus, Varanasi, Uttar Pradesh - 221005',
    }

    res.status(200).json({
      success: true,
      message: 'Bonafide certificate generated successfully.',
      data: certificateData,
    })
  } catch (err: any) {
    console.error('generateBonafideCertificate error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// POST /api/receptionist/certificates/character
export const generateCharacterCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { admissionNumber, conduct, remarks } = req.body

    if (!admissionNumber) {
      res.status(400).json({ success: false, message: 'Admission Number is required.' })
      return
    }

    const student = await Student.findOne({
      admissionNumber: admissionNumber.toUpperCase(),
      isActive: true,
    }).lean()

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // 🛡️ FIX: Perfectly flattened to match Frontend Interface & Enterprise Schema
    const certificateData = {
      type: 'Character',
      certificateNo: `CHR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      issueDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNumber: student.admissionNumber,
      fatherName: student.parents?.fatherName || '_______________________',
      sonDaughterOf: student.gender === 'female' ? 'D/O' : 'S/O',
      class: student.currentClass,
      section: student.currentSection,
      rollNumber: student.rollNumber,
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-IN') : '_______________________',
      characterRemarks: remarks || `The student has shown ${conduct || 'good'} moral character and behavior during their period of study.`,
      schoolName: 'Saraswati Public School',
      schoolAddress: 'BHU Campus, Varanasi, Uttar Pradesh - 221005',
    }

    res.status(200).json({
      success: true,
      message: 'Character certificate generated successfully.',
      data: certificateData,
    })
  } catch (err: any) {
    console.error('generateCharacterCertificate error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// Reference the CertificateRequest model
const CertificateRequestSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['bonafide', 'character', 'transfer', 'migration'], required: true },
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    class: { type: String, required: true },
    section: { type: String, required: true },
    requestedBy: { type: String, required: true },
    requestedByRole: { type: String, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: String,
    approvedAt: Date,
    rejectionReason: String,
    certificateNumber: String,
  },
  { timestamps: true }
)

const CertificateRequest = mongoose.models.CertificateRequest || mongoose.model('CertificateRequest', CertificateRequestSchema)

// POST /api/receptionist/certificate-requests
export const submitCertificateRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receptionist = await getReceptionist(req.user!.admissionNumber)
    if (!receptionist) { res.status(404).json({ success: false, message: 'Receptionist not found.' }); return }

    const { type, admissionNumber, reason } = req.body
    if (!type || !admissionNumber) { res.status(400).json({ success: false, message: 'Type and admissionNumber are required.' }); return }

    const validTypes = ['bonafide', 'character', 'transfer', 'migration']
    if (!validTypes.includes(type)) { res.status(400).json({ success: false, message: 'Invalid certificate type.' }); return }

    const student = await Student.findOne({ admissionNumber: admissionNumber.toUpperCase(), isActive: true })
    if (!student) { res.status(404).json({ success: false, message: 'Student not found.' }); return }

    const request = new CertificateRequest({
      type,
      studentId: student.admissionNumber,
      studentName: `${student.firstName} ${student.lastName}`,
      class: student.currentClass, // 🛡️ FIX: mapped to currentClass
      section: student.currentSection, // 🛡️ FIX: mapped to currentSection
      requestedBy: receptionist.receptionistId,
      requestedByRole: 'receptionist',
      reason: reason || '',
    })

    await request.save()

    res.status(201).json({ success: true, message: 'Certificate request submitted for principal approval.', data: request })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/receptionist/certificate-requests
export const getCertificateRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receptionist = await getReceptionist(req.user!.admissionNumber)
    if (!receptionist) { res.status(404).json({ success: false, message: 'Receptionist not found.' }); return }

    const { status, page = 1, limit = 20 } = req.query as any
    const filter: Record<string, any> = { requestedBy: receptionist.receptionistId }
    if (status) filter.status = status

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const requests = await CertificateRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
    const total = await CertificateRequest.countDocuments(filter)

    res.status(200).json({
      success: true, data: requests,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}