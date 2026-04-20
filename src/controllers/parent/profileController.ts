import { Response } from 'express'
import Parent from '../../models/parent/Parent'
import { AuthRequest } from '../../middleware/authMiddleware'

// GET /api/parent/profile
export const getParentProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.user!.admissionNumber,
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent profile not found.' })
      return
    }

    res.status(200).json({ success: true, data: parent })
  } catch (err: any) {
    console.error('getParentProfile error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
