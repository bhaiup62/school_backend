import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ILeaveRequest extends Document {
  staffId: mongoose.Types.ObjectId
  leaveType: 'Casual' | 'Sick' | 'Earned' | 'Maternity' | 'LWP'
  startDate: Date
  endDate: Date
  totalDays: number
  reason: string
  attachmentUrl: string
  status: 'Pending' | 'Approved' | 'Rejected'
  approvedBy?: mongoose.Types.ObjectId
  remarks: string
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: {
      type: String,
      enum: ['Casual', 'Sick', 'Earned', 'Maternity', 'LWP'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    attachmentUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
)

leaveRequestSchema.index({ staffId: 1 })
leaveRequestSchema.index({ status: 1 })
leaveRequestSchema.index({ startDate: 1 })

const LeaveRequest: Model<ILeaveRequest> =
  mongoose.models.LeaveRequest || mongoose.model<ILeaveRequest>('LeaveRequest', leaveRequestSchema)

export default LeaveRequest
