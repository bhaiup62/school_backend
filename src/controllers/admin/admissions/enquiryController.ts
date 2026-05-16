import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import Enquiry, { IEnquiry } from '../../../models/admin/Enquiry'

export const createEnquiry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { parentName, phone, email, classInterestedIn, leadSource } = req.body

    const enquiry = await Enquiry.create({
      parentName,
      phone,
      email,
      classInterestedIn,
      leadSource,
    })

    res.status(201).json({
      success: true,
      data: enquiry,
      message: 'Enquiry created successfully.',
    })
  } catch (error: unknown) {
    console.error('createEnquiry error:', error)
    res.status(500).json({ success: false, message: 'Server error creating enquiry.' })
  }
}

export const getEnquiries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, classInterestedIn } = req.query as {
      status?: IEnquiry['status']
      classInterestedIn?: string
    }

    const filters: {
      status?: IEnquiry['status']
      classInterestedIn?: string
    } = {}

    if (status) filters.status = status
    if (classInterestedIn) filters.classInterestedIn = classInterestedIn

    const enquiries = await Enquiry.find(filters)
      .populate('classInterestedIn', 'className')
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      data: enquiries,
      message: 'Enquiries fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getEnquiries error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching enquiries.' })
  }
}

export const updateEnquiryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const enquiryId = req.params.id || req.params.enquiryId || req.body.enquiryId
    const { status, followUpDate, applicationId } = req.body as {
      status?: IEnquiry['status']
      followUpDate?: Date
      applicationId?: string
    }

    if (!enquiryId || !status) {
      res.status(400).json({
        success: false,
        message: 'enquiryId and status are required.',
      })
      return
    }

    if (status === 'Converted' && !applicationId) {
      res.status(400).json({
        success: false,
        message: 'An Application ID is required to mark an enquiry as Converted.',
      })
      return
    }

    const updatePayload: {
      status: IEnquiry['status']
      followUpDate?: Date
      applicationId?: string
    } = { status }

    if (followUpDate) {
      updatePayload.followUpDate = followUpDate
    }

    if (status === 'Converted' && applicationId) {
      updatePayload.applicationId = applicationId
    }

    const enquiry = await Enquiry.findByIdAndUpdate(enquiryId, updatePayload, {
      new: true,
      runValidators: true,
    }).populate('classInterestedIn', 'className')

    if (!enquiry) {
      res.status(404).json({ success: false, message: 'Enquiry not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: enquiry,
      message: 'Enquiry status updated successfully.',
    })
  } catch (error: unknown) {
    console.error('updateEnquiryStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error updating enquiry status.' })
  }
}

export const deleteEnquiry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const enquiryId = req.params.id || req.params.enquiryId || req.body.enquiryId

    if (!enquiryId) {
      res.status(400).json({ success: false, message: 'enquiryId is required.' })
      return
    }

    const deletedEnquiry = await Enquiry.findByIdAndDelete(enquiryId)
    if (!deletedEnquiry) {
      res.status(404).json({ success: false, message: 'Enquiry not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: deletedEnquiry,
      message: 'Enquiry deleted successfully.',
    })
  } catch (error: unknown) {
    console.error('deleteEnquiry error:', error)
    res.status(500).json({ success: false, message: 'Server error deleting enquiry.' })
  }
}
