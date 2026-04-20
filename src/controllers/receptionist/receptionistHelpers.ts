import { Request } from 'express'
import Receptionist from '../../models/receptionist/Receptionist'
import { Counter } from '../../models/shared/Counter'

// Extended request with user info from JWT
export interface AuthRequest extends Request {
  user?: {
    userId: string
    admissionNumber: string
    role: string
  }
}

export const getReceptionist = async (receptionistId: string) => {
  return Receptionist.findOne({ receptionistId, isActive: true })
}

// Generate next admission number for a given prefix using atomic counter
export const generateNextId = async (prefix: string): Promise<string> => {
  const year = new Date().getFullYear()
  const counterId = `${prefix}-${year}`
  
  // Atomic increment using findOneAndUpdate with upsert
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
  
  return `${prefix}-${year}-${String(counter.seq).padStart(4, '0')}`
}
