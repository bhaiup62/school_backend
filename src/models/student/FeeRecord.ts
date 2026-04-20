// src/models/FeeRecord.ts
// Model for student fee records and defaulter tracking
// ═══════════════════════════════════════════════════════════════════════════════
// Academic Year Rollover Ready - snapshots student's class/section at fee creation
// IMPORTANT: daysOverdue, lateFeeApplied, isDefaulter are calculated dynamically
// in controllers, NOT in pre('save') hook to avoid stale time bug
// ═══════════════════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IFeePayment {
  paymentId: string
  amount: number
  paidDate: Date
  paymentMode: 'cash' | 'cheque' | 'online' | 'upi' | 'bank_transfer'
  transactionId: string
  receivedBy: mongoose.Types.ObjectId
  remarks: string
}

export interface IFeeRecord extends Document {
  student: mongoose.Types.ObjectId
  // Snapshot fields - preserve student's academic position at fee creation
  studentClassAtTime: string    // Class when fee was created (e.g., "10")
  studentSectionAtTime: string  // Section when fee was created (e.g., "A")
  sessionAtTime: string         // Academic session (e.g., "2025-26")
  
  academicYear: string  // e.g., "2025-26"
  
  // Fee structure
  feeType: 'tuition' | 'admission' | 'exam' | 'transport' | 'library' | 'lab' | 'sports' | 'uniform' | 'annual' | 'other'
  feeDescription: string
  
  // Amounts
  totalAmount: number
  discount: number
  discountReason: string
  netAmount: number
  paidAmount: number
  dueAmount: number
  
  // Due dates
  dueDate: Date
  lateFeePerDay: number
  // NOTE: lateFeeApplied is stored but should be recalculated dynamically in controllers
  lateFeeApplied: number
  finalAmount: number
  
  // Status
  // NOTE: status, isDefaulter, daysOverdue should be recalculated dynamically in controllers
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived'
  isDefaulter: boolean
  defaulterSince: Date
  daysOverdue: number
  
  // Payments
  payments: IFeePayment[]
  
  // Principal actions
  restrictReportCard: boolean
  restrictedBy: mongoose.Types.ObjectId
  restrictedAt: Date
  restrictionReason: string
  
  // Reminders
  remindersSent: number
  lastReminderSentAt: Date
  
  // Audit
  createdBy: mongoose.Types.ObjectId
  lastUpdatedBy: mongoose.Types.ObjectId
  
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const PaymentSchema = new Schema<IFeePayment>(
  {
    paymentId: { type: String, required: true },
    amount: { type: Number, required: true },
    paidDate: { type: Date, default: Date.now },
    paymentMode: {
      type: String,
      enum: ['cash', 'cheque', 'online', 'upi', 'bank_transfer'],
      default: 'cash',
    },
    transactionId: { type: String, default: '' },
    receivedBy: { type: Schema.Types.ObjectId },
    remarks: { type: String, default: '' },
  },
  { _id: true }
)

const FeeRecordSchema = new Schema<IFeeRecord>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required'],
    },
    // Snapshot fields - captures student's academic position at fee creation
    // These prevent "time travel" when student is promoted to a new class
    studentClassAtTime: {
      type: String,
      required: [true, 'Student class at time of fee creation is required'],
    },
    studentSectionAtTime: {
      type: String,
      required: [true, 'Student section at time of fee creation is required'],
    },
    sessionAtTime: {
      type: String,
      required: [true, 'Academic session at time of fee creation is required'],
    },
    academicYear: {
      type: String,
      required: true,
      default: () => {
        const now = new Date()
        const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
        return `${year}-${(year + 1).toString().slice(2)}`
      },
    },
    
    feeType: {
      type: String,
      enum: ['tuition', 'admission', 'exam', 'transport', 'library', 'lab', 'sports', 'uniform', 'annual', 'other'],
      required: true,
    },
    feeDescription: { type: String, default: '' },
    
    totalAmount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountReason: { type: String, default: '' },
    netAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    lateFeePerDay: { type: Number, default: 0 },
    lateFeeApplied: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },
    
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue', 'waived'],
      default: 'pending',
    },
    isDefaulter: { type: Boolean, default: false },
    defaulterSince: Date,
    daysOverdue: { type: Number, default: 0 },
    
    payments: [PaymentSchema],
    
    restrictReportCard: { type: Boolean, default: false },
    restrictedBy: { type: Schema.Types.ObjectId, ref: 'Principal' },
    restrictedAt: Date,
    restrictionReason: { type: String, default: '' },
    
    remindersSent: { type: Number, default: 0 },
    lastReminderSentAt: Date,
    
    createdBy: { type: Schema.Types.ObjectId },
    lastUpdatedBy: { type: Schema.Types.ObjectId },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// Calculate basic amounts before save
// NOTE: Time-sensitive calculations (daysOverdue, lateFeeApplied, isDefaulter, status)
// are intentionally NOT done here to avoid the "stale time bug" where values freeze
// if the document isn't actively being saved. Those are calculated dynamically in controllers.
FeeRecordSchema.pre('save', function (next) {
  // Net amount after discount
  this.netAmount = this.totalAmount - this.discount
  
  // Calculate paid amount from payments
  this.paidAmount = this.payments.reduce((sum, p) => sum + p.amount, 0)
  
  // Due amount (without late fees - those are calculated dynamically)
  this.dueAmount = this.netAmount - this.paidAmount
  
  // Simple status check based on payment (not time-based overdue)
  if (this.status !== 'waived') {
    if (this.paidAmount >= this.netAmount) {
      this.status = 'paid'
    } else if (this.paidAmount > 0) {
      this.status = 'partial'
    }
    // NOTE: 'overdue' status is set dynamically in controllers based on current date
  }
  
  next()
})

// Indexes
FeeRecordSchema.index({ student: 1, academicYear: 1 })
FeeRecordSchema.index({ student: 1, sessionAtTime: 1 })
FeeRecordSchema.index({ sessionAtTime: 1, studentClassAtTime: 1 })
FeeRecordSchema.index({ status: 1 })
FeeRecordSchema.index({ isDefaulter: 1 })
FeeRecordSchema.index({ dueDate: 1 })
FeeRecordSchema.index({ restrictReportCard: 1 })

const FeeRecord: Model<IFeeRecord> =
  mongoose.models.FeeRecord || mongoose.model<IFeeRecord>('FeeRecord', FeeRecordSchema)

export default FeeRecord
