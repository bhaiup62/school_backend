// src/controllers/receptionist/parentController.ts

import { Response } from 'express'
import Parent from '../../models/parent/Parent'
import Student from '../../models/student/Student'
import User from '../../models/shared/User'
import { logAudit } from '../../models/shared/AuditLog'
import { AuthRequest, generateNextId } from './receptionistHelpers'

// GET /api/receptionist/parents
export const getAllParents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = 1, limit = 50 } = req.query as any

    const filter: Record<string, any> = { isActive: true }

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { parentId: searchRegex },
        { phone: searchRegex },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const parents = await Parent.find(filter)
      .select('firstName lastName parentId phone email relation children')
      .sort({ parentId: 1 })
      .skip(skip)
      .limit(parseInt(limit))

    const total = await Parent.countDocuments(filter)

    res.status(200).json({
      success: true,
      data: parents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err: any) {
    console.error('getAllParents error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// GET /api/receptionist/parents/:parentId
export const getParentDetail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.params.parentId.toUpperCase(),
      isActive: true,
    }).lean()

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    // Get children details
    const children = await Student.find({
      admissionNumber: { $in: parent.children },
      isActive: true,
    }).select('firstName lastName admissionNumber currentClass currentSection rollNumber').lean()

    // Map 'currentClass' back to 'class' for frontend compatibility
    const mappedChildren = children.map(c => ({
      ...c,
      class: c.currentClass,
      section: c.currentSection
    }))

    res.status(200).json({
      success: true,
      data: {
        ...parent,
        childrenDetails: mappedChildren,
      },
    })
  } catch (err: any) {
    console.error('getParentDetail error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// POST /api/receptionist/parents
// Register a new parent
export const registerParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      firstName, lastName, phone, email, relation,
      address, city, pincode, occupation,
      children, // Array of student admission numbers
    } = req.body

    if (!firstName || !lastName || !phone || !relation) {
      res.status(400).json({
        success: false,
        message: 'Required fields: firstName, lastName, phone, relation',
      })
      return
    }

    // Validate children exist
    const childrenArray = children || []
    if (childrenArray.length > 0) {
      const validChildren = await Student.find({
        admissionNumber: { $in: childrenArray.map((c: string) => c.toUpperCase()) },
        isActive: true,
      }).select('admissionNumber')

      if (validChildren.length !== childrenArray.length) {
        res.status(400).json({
          success: false,
          message: 'One or more children admission numbers are invalid.',
        })
        return
      }
    }

    // Generate parent ID atomically
    const parentId = await generateNextId('PAR')

    // Create User account
    const user = await User.create({
      admissionNumber: parentId,
      password: 'parent123', // Default password
      role: 'parent',
      isActive: true,
    })

    // Create Parent profile
    const parent = await Parent.create({
      user: user._id,
      parentId,
      firstName,
      lastName,
      phone,
      email: email || '',
      relation,
      address: address || '',
      city: city || 'Varanasi',
      pincode: pincode || '',
      occupation: occupation || '',
      children: childrenArray.map((c: string) => c.toUpperCase()),
      isActive: true,
    })

    await logAudit({
      action: 'REGISTER_PARENT',
      entityType: 'Parent',
      entityId: parentId,
      performedBy: req.user!.admissionNumber,
      performedByName: req.user!.admissionNumber,
      performedByRole: req.user!.role,
      description: `Registered new parent: ${firstName} ${lastName} (${parentId})`,
      newData: { parentId, firstName, lastName, phone, relation, children: childrenArray },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })

    res.status(201).json({
      success: true,
      message: 'Parent registered successfully.',
      data: {
        parentId: parent.parentId,
        fullName: `${parent.firstName} ${parent.lastName}`,
        phone: parent.phone,
        children: parent.children,
        defaultPassword: 'parent123',
      },
    })
  } catch (err: any) {
    console.error('registerParent error:', err)
    if (err.code === 11000) {
      res.status(400).json({ success: false, message: 'Duplicate entry detected.' })
      return
    }
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// PATCH /api/receptionist/parents/:parentId
// Update parent contact info
export const updateParentContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parent = await Parent.findOne({
      parentId: req.params.parentId.toUpperCase(),
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    const allowedFields = ['phone', 'email', 'address', 'city', 'pincode', 'occupation']
    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    }

    Object.assign(parent, updates)
    await parent.save()

    res.status(200).json({
      success: true,
      message: 'Parent contact updated.',
      data: { parentId: parent.parentId, ...updates },
    })
  } catch (err: any) {
    console.error('updateParentContact error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// POST /api/receptionist/parents/:parentId/link-child
// Link a child to parent
export const linkChildToParent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { childAdmissionNumber } = req.body

    if (!childAdmissionNumber) {
      res.status(400).json({ success: false, message: 'childAdmissionNumber is required.' })
      return
    }

    const parent = await Parent.findOne({
      parentId: req.params.parentId.toUpperCase(),
      isActive: true,
    })

    if (!parent) {
      res.status(404).json({ success: false, message: 'Parent not found.' })
      return
    }

    const student = await Student.findOne({
      admissionNumber: childAdmissionNumber.toUpperCase(),
      isActive: true,
    })

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' })
      return
    }

    // Check if already linked
    if (parent.children.includes(childAdmissionNumber.toUpperCase())) {
      res.status(400).json({ success: false, message: 'Child already linked to this parent.' })
      return
    }

    parent.children.push(childAdmissionNumber.toUpperCase())
    await parent.save()

    res.status(200).json({
      success: true,
      message: 'Child linked to parent successfully.',
      data: { parentId: parent.parentId, children: parent.children },
    })
  } catch (err: any) {
    console.error('linkChildToParent error:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}