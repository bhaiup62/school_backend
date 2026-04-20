// src/models/principal/CertificateRequest.ts
// Certificate request model for bonafide, character, transfer, migration certificates

import mongoose, { Document, Schema, Model } from 'mongoose'

export interface ICertificateRequest extends Document {
  type: 'bonafide' | 'character' | 'transfer' | 'migration'
  studentId: string
  studentName: string
  class: string
  section: string
  requestedBy: string
  requestedByRole: 'parent' | 'teacher' | 'receptionist' | 'student'
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: Date
  rejectionReason?: string
  certificateNumber?: string
  createdAt: Date
  updatedAt: Date
}

const CertificateRequestSchema = new Schema<ICertificateRequest>(
  {
    type: {
      type: String,
      enum: ['bonafide', 'character', 'transfer', 'migration'],
      required: true,
      index: true,
    },
    studentId: { type: String, required: true, index: true },
    studentName: { type: String, required: true },
    class: { type: String, required: true },
    section: { type: String, required: true },
    requestedBy: { type: String, required: true },
    requestedByRole: {
      type: String,
      enum: ['parent', 'teacher', 'receptionist', 'student'],
      required: true,
    },
    reason: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    certificateNumber: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
)

// Compound indexes for common query patterns
CertificateRequestSchema.index({ status: 1, createdAt: -1 })
CertificateRequestSchema.index({ type: 1, status: 1 })
CertificateRequestSchema.index({ studentId: 1, type: 1 })

export const CertificateRequest: Model<ICertificateRequest> =
  mongoose.models.CertificateRequest ||
  mongoose.model<ICertificateRequest>('CertificateRequest', CertificateRequestSchema)
