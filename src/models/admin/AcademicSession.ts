import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IAcademicTerm {
  termName: string
  startDate: Date
  endDate: Date
  isCurrentTerm: boolean
}

export interface IAcademicSession extends Document {
  sessionName: string
  startDate: Date
  endDate: Date
  status: 'Upcoming' | 'Active' | 'Completed' | 'Archived'
  isCurrentSession: boolean
  isAdmissionOpen: boolean
  terms: IAcademicTerm[]
  attendanceBackdateLimit: number
  marksEntryLockDate?: Date
  minAttendancePercentage: number
  feeDefaulterPromotionLocked: boolean
  createdAt: Date
  updatedAt: Date
}

const termSchema = new Schema<IAcademicTerm>(
  {
    termName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrentTerm: { type: Boolean, default: false },
  },
  { _id: false }
)

const academicSessionSchema = new Schema<IAcademicSession>(
  {
    sessionName: { type: String, required: true, unique: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Upcoming', 'Active', 'Completed', 'Archived'],
      default: 'Upcoming',
    },
    isCurrentSession: { type: Boolean, default: false },
    isAdmissionOpen: { type: Boolean, default: false },
    terms: { type: [termSchema], default: [] },
    attendanceBackdateLimit: { type: Number, required: true, default: 3 },
    marksEntryLockDate: { type: Date },
    minAttendancePercentage: { type: Number, required: true, default: 75 },
    feeDefaulterPromotionLocked: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
)

academicSessionSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'Active') {
      this.isCurrentSession = true
    }

    if (this.status === 'Archived' || this.status === 'Completed') {
      this.isCurrentSession = false
    }
  }

  next()
})

academicSessionSchema.pre('save', async function () {
  if (this.isModified('isCurrentSession') && this.isCurrentSession) {
    await this.model('AcademicSession').updateMany(
      { _id: { $ne: this._id } },
      { $set: { isCurrentSession: false } }
    )
  }
})

const AcademicSession: Model<IAcademicSession> =
  mongoose.models.AcademicSession || mongoose.model<IAcademicSession>('AcademicSession', academicSessionSchema)

export default AcademicSession
