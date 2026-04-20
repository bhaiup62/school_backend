// src/controllers/receptionist/studentController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import User from '../../models/shared/User'
import { logAudit } from '../../models/shared/AuditLog'
import { AuthRequest, generateNextId } from './receptionistHelpers'

// GET /api/receptionist/students
export const getAllStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: cls, section, search, page = 1, limit = 50 } = req.query as any

    const filter: Record<string, any> = { isActive: true }
    
    if (cls) filter.currentClass = cls
    if (section) filter.currentSection = section.toUpperCase()

    let query = Student.find(filter)
      .select('firstName lastName admissionNumber currentClass currentSection rollNumber phone parents isActive')
      .sort({ currentClass: 1, currentSection: 1, rollNumber: 1 })
      .lean()

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { admissionNumber: searchRegex },
        { 'parents.fatherName': searchRegex },
      ]
      query = Student.find(filter)
        .select('firstName lastName admissionNumber currentClass currentSection rollNumber phone parents isActive')
        .sort({ currentClass: 1, currentSection: 1, rollNumber: 1 })
        .lean()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const students = await query.skip(skip).limit(parseInt(limit))
    const total = await Student.countDocuments(filter)

    const mappedStudents = students.map((s: any) => ({
      ...s,
      class: s.currentClass,
      section: s.currentSection,
    }))

    res.status(200).json({
      success: true,
      data: mappedStudents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err: any) {
    console.error('getAllStudents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/receptionist/students/:admissionNumber
export const getStudentDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber.toUpperCase(),
      isActive: true,
    })
      .select('-attendance -results') 
      .lean()

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    const mappedStudent = {
      ...student,
      class: student.currentClass,
      section: student.currentSection,
      session: student.currentSession,
    }

    res.status(200).json({ success: true, data: mappedStudent })
  } catch (err: any) {
    console.error('getStudentDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// POST /api/receptionist/students
export const registerStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      // Core requirements
      firstName, lastName, dateOfBirth, gender, class: cls, section,
      
      // Flat Fields
      nationality, motherTongue, identificationMarks, bloodGroup, religion, caste, aadharNumber,
      phone, email, address, city, pincode,
      
      // Enterprise Nested Objects
      parents = {},
      previousAcademicHistory = {},
      medicalRecord = {},
      transport = {},
      documentChecklist = {}
    } = req.body

    if (!firstName || !lastName || !dateOfBirth || !gender || !cls || !section) {
      res.status(400).json({
        success: false,
        message: 'Required fields: firstName, lastName, dateOfBirth, gender, class, section',
      })
      return
    }

    const admissionNumber = await generateNextId('SPS')

    const lastStudent = await Student.findOne({ currentClass: cls, currentSection: section.toUpperCase() })
      .sort({ rollNumber: -1 })
      .select('rollNumber')
      .lean()
      
    const rollNumber = lastStudent ? String(parseInt(lastStudent.rollNumber) + 1) : '1'

    const user = await User.create({
      admissionNumber,
      password: 'student123',
      role: 'student',
      isActive: true,
    })

    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const session = `${currentYear}-${String(nextYear).slice(-2)}`
    
    // 🛡️ Enterprise Creation: Merging flat and nested objects
    const student = await Student.create({
      user: user._id,
      admissionNumber,
      
      // Core & Academic
      firstName, lastName, dateOfBirth: new Date(dateOfBirth), gender,
      currentClass: cls, currentSection: section.toUpperCase(), currentSession: session, rollNumber, admissionDate: new Date(),
      
      // Personal
      nationality: nationality || 'Indian',
      motherTongue: motherTongue || 'Hindi',
      identificationMarks: identificationMarks || '',
      bloodGroup: bloodGroup || '',
      religion: religion || '',
      caste: caste || 'General',
      aadharNumber: aadharNumber || '',
      
      // Contact
      phone: phone || '', email: email || '', address: address || '', city: city || 'Varanasi', pincode: pincode || '',
      
      // Enterprise Nested
      parents,
      previousAcademicHistory,
      medicalRecord,
      transport,
      documentChecklist,

      isActive: true,
    })

    await logAudit({
      action: 'REGISTER_STUDENT',
      entityType: 'Student',
      entityId: admissionNumber,
      performedBy: req.user!.admissionNumber,
      performedByName: req.user!.admissionNumber,
      performedByRole: req.user!.role,
      description: `Registered new student: ${firstName} ${lastName} (${admissionNumber}) in Class ${cls}-${section}`,
      newData: { admissionNumber, firstName, lastName, class: cls, section, rollNumber },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })

    res.status(201).json({
      success: true,
      message: 'Student registered successfully.',
      data: {
        admissionNumber: student.admissionNumber,
        fullName: `${student.firstName} ${student.lastName}`,
        class: student.currentClass,
        section: student.currentSection,
        rollNumber: student.rollNumber,
        defaultPassword: 'student123',
      },
    })
  } catch (err: any) {
    console.error('registerStudent error:', err)
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Duplicate entry detected.' })
      return
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// PATCH /api/receptionist/students/:admissionNumber
// Now supports FULL ENTERPRISE PROFILE updates!
export const updateStudentContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.params.admissionNumber.toUpperCase(),
      isActive: true,
    })

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // 1. Update Flat Fields
    const rootFields = [
      'firstName', 'lastName', 'gender', 'nationality', 'motherTongue', 
      'identificationMarks', 'bloodGroup', 'religion', 'caste', 'aadharNumber',
      'phone', 'email', 'address', 'city', 'pincode'
    ]
    
    for (const field of rootFields) {
      if (req.body[field] !== undefined) {
        (student as any)[field] = req.body[field]
      }
    }
    
    if (req.body.dateOfBirth) {
      student.dateOfBirth = new Date(req.body.dateOfBirth)
    }

    // 2. Safely Update Nested Enterprise Objects
    if (req.body.parents) {
      student.parents = { ...student.parents, ...req.body.parents }
      student.markModified('parents')
    }
    if (req.body.previousAcademicHistory) {
      student.previousAcademicHistory = { ...student.previousAcademicHistory, ...req.body.previousAcademicHistory }
      student.markModified('previousAcademicHistory')
    }
    if (req.body.medicalRecord) {
      student.medicalRecord = { ...student.medicalRecord, ...req.body.medicalRecord }
      student.markModified('medicalRecord')
    }
    if (req.body.transport) {
      student.transport = { ...student.transport, ...req.body.transport }
      student.markModified('transport')
    }
    if (req.body.documentChecklist) {
      student.documentChecklist = { ...student.documentChecklist, ...req.body.documentChecklist }
      student.markModified('documentChecklist')
    }

    await student.save()

    res.status(200).json({
      success: true,
      message: 'Student profile updated successfully.',
      data: { admissionNumber: student.admissionNumber },
    })
  } catch (err: any) {
    console.error('updateStudentContact error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}