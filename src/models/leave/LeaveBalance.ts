import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ILeaveBalance extends Document {
  staffId: mongoose.Types.ObjectId
  academicSession: mongoose.Types.ObjectId
  casualLeaves: {
    total: number
    used: number
  }
  sickLeaves: {
    total: number
    used: number
  }
  earnedLeaves: {
    total: number
    used: number
  }
}

const leaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    casualLeaves: {
      total: { type: Number, default: 12 },
      used: { type: Number, default: 0 },
    },
    sickLeaves: {
      total: { type: Number, default: 10 },
      used: { type: Number, default: 0 },
    },
    earnedLeaves: {
      total: { type: Number, default: 15 },
      used: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

leaveBalanceSchema.index({ staffId: 1, academicSession: 1 }, { unique: true })

const LeaveBalance: Model<ILeaveBalance> =
  mongoose.models.LeaveBalance || mongoose.model<ILeaveBalance>('LeaveBalance', leaveBalanceSchema)

export default LeaveBalance
