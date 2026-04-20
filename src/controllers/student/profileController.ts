// src/controllers/student/profileController.ts

import { Response } from 'express'
import Student from '../../models/student/Student'
import { AuthRequest } from '../../middleware/authMiddleware'

// ── GET /api/student/profile ─────────────────────────────
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.user!.admissionNumber,
      isActive: true,
    })
      .select('-results -attendance -classTeacherRemarks -academicHistory') // Exclude heavy arrays
      .lean()

    if (!student) {
      res.status(404).json({ success: false, message: 'Student profile not found.' })
      return
    }

    // 🛡️ FIX: Map new Enterprise Schema fields to standard names for frontend convenience
    const mappedStudent = {
      ...student,
      class: student.currentClass,
      section: student.currentSection,
      session: student.currentSession,
    }

    res.status(200).json({ success: true, data: mappedStudent })
  } catch (error: any) {
    console.error('getProfile error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ── PATCH /api/student/profile ───────────────────────────
// Students can only update their own basic contact info
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 🛡️ FIX: Added 'city' so they can update their full address
    const allowedFields = ['phone', 'email', 'address', 'city', 'pincode']
    const updates: Record<string, any> = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields provided.' })
      return
    }

    const student = await Student.findOneAndUpdate(
      { admissionNumber: req.user!.admissionNumber },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-results -attendance').lean()

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    const mappedStudent = {
      ...student,
      class: student.currentClass,
      section: student.currentSection,
    }

    res.status(200).json({ success: true, message: 'Profile updated.', data: mappedStudent })
  } catch (error: any) {
    console.error('updateProfile error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}