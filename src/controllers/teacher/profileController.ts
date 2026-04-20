// src/controllers/teacher/profileController.ts
import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware'
import Teacher from '../../models/teacher/Teacher'
import { getTeacher } from './teacherHelpers'

// GET /api/teacher/profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teacher = await getTeacher(req.user!.admissionNumber)
    if (!teacher) {
      res.status(404).json({ success: false, message: 'Teacher profile not found.' })
      return
    }
    res.status(200).json({ success: true, data: teacher })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// PATCH /api/teacher/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 🛡️ SECURE: Always verify the teacher exists using the helper first
    const teacherRecord = await getTeacher(req.user!.admissionNumber)
    if (!teacherRecord) {
      res.status(404).json({ success: false, message: 'Teacher not found.' })
      return
    }

    const allowed = ['phone', 'email', 'address', 'pincode']
    const updates: Record<string, any> = {}
    
    for (const f of allowed) {
      if (req.body[f] !== undefined) updates[f] = req.body[f]
    }
    
    if (!Object.keys(updates).length) {
      res.status(400).json({ success: false, message: 'No valid fields provided for update.' })
      return
    }
    
    // 🛡️ SECURE: Update using the strict MongoDB _id
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      teacherRecord._id,
      { $set: updates },
      { new: true, runValidators: true }
    )
    
    res.status(200).json({ success: true, message: 'Profile updated successfully.', data: updatedTeacher })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}