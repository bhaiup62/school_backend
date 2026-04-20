// src/controllers/receptionist/profileController.ts

import { Response } from 'express'
import { AuthRequest, getReceptionist } from './receptionistHelpers'

// GET /api/receptionist/profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receptionist = await getReceptionist(req.user!.admissionNumber)
    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: {
        receptionistId: receptionist.receptionistId,
        firstName: receptionist.firstName,
        lastName: receptionist.lastName,
        fullName: receptionist.fullName,
        phone: receptionist.phone,
        email: receptionist.email,
        address: receptionist.address,
        city: receptionist.city,
        pincode: receptionist.pincode,
        qualification: receptionist.qualification,
        joiningDate: receptionist.joiningDate,
        shift: receptionist.shift,
        isActive: receptionist.isActive
      },
    })
  } catch (err: any) {
    console.error('getProfile error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// PATCH /api/receptionist/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const receptionist = await getReceptionist(req.user!.admissionNumber)
    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist profile not found.' })
      return
    }

    // Strictly limit which fields can be edited
    const allowedFields = ['phone', 'email', 'address', 'city', 'pincode']
    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    }

    Object.assign(receptionist, updates)
    await receptionist.save()

    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully.', 
      data: receptionist 
    })
  } catch (err: any) {
    console.error('updateProfile error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}