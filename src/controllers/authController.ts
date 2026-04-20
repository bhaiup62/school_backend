import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/shared/User'
import Student from '../models/student/Student'
import { AuthRequest } from '../middleware/authMiddleware'

// ── POST /api/auth/login ─────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { admissionNumber, password } = req.body

    if (!admissionNumber || !password) {
      res.status(400).json({
        success: false,
        message: 'Admission number and password are required.',
      })
      return
    }

    // Find user and include password
    const user = await User.findOne({
      admissionNumber: admissionNumber.toUpperCase().trim(),
    }).select('+password')

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid admission number or password.',
      })
      return
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account deactivated. Please contact admin.',
      })
      return
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid admission number or password.',
      })
      return
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    // Sign token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        admissionNumber: user.admissionNumber,
        role: user.role,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
    )

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id,
          admissionNumber: user.admissionNumber,
          role: user.role,
        },
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ── GET /api/auth/me ─────────────────────────────────────
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await Student.findOne({
      admissionNumber: req.user!.admissionNumber,
      isActive: true,
    }).select('-results -attendance')

    if (!student) {
      res.status(404).json({ success: false, message: 'Profile not found.' })
      return
    }

    res.status(200).json({ success: true, data: student })
  } catch (error: any) {
    console.error('GetMe error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ── POST /api/auth/change-password ───────────────────────
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current and new password are required.',
      })
      return
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      })
      return
    }

    const user = await User.findById(req.user!.userId).select('+password')
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' })
      return
    }

    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Current password is incorrect.' })
      return
    }

    user.password = newPassword
    await user.save()

    res.status(200).json({ success: true, message: 'Password changed successfully.' })
  } catch (error: any) {
    console.error('ChangePassword error:', error)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}