// src/models/LeaveRequest.ts

import mongoose, { Document, Schema, Model } from 'mongoose'

export interface ILeaveRequest extends Document {
  requestorId: string
  requestorName: string
  requestorRole: 'teacher' | 'staff' | 'receptionist'
  department?: string  // For teachers: subjects they teach
  leaveType: 'casual' | 'sick' | 'earned' | 'other'
  fromDate: Date
  toDate: Date
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: Date
  rejectionReason?: string
  createdAt: Date
  updatedAt: Date
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    requestorId: { type: String, required: true, index: true },
    requestorName: { type: String, required: true },
    requestorRole: { type: String, enum: ['teacher', 'staff', 'receptionist'], required: true },
    department: { type: String, default: '' },
    leaveType: {
      type: String,
      enum: ['casual', 'sick', 'earned', 'other'],
      required: true,
    },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true }
)

// Compound index for common queries
LeaveRequestSchema.index({ status: 1, createdAt: -1 })

export const LeaveRequest: Model<ILeaveRequest> =
  mongoose.models.LeaveRequest || mongoose.model<ILeaveRequest>('LeaveRequest', LeaveRequestSchema)
