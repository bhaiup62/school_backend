import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISection {
  sectionName: string
  capacity: number
  classTeacher?: mongoose.Types.ObjectId
}

export interface IClassMaster extends Document {
  academicSession: mongoose.Types.ObjectId
  className: string
  displayName: string
  board: string
  medium: string
  totalCapacity: number
  availableSeats: number
  applicationFeeAmount: number
  minimumAgeCutoffDate?: Date
  minAge?: number
  maxAge?: number
  sections: ISection[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const sectionSchema = new Schema<ISection>(
  {
    sectionName: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    classTeacher: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
)

const classMasterSchema = new Schema<IClassMaster>(
  {
    academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    className: { type: String, required: true },
    displayName: { type: String, required: true },
    board: { type: String, default: 'CBSE' },
    medium: { type: String, default: 'English' },
    totalCapacity: { type: Number, required: true, default: 0 },
    availableSeats: { type: Number, required: true, default: 0 },
    applicationFeeAmount: { type: Number, required: true, default: 0 },
    minimumAgeCutoffDate: { type: Date },
    minAge: { type: Number },
    maxAge: { type: Number },
    sections: { type: [sectionSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

classMasterSchema.pre('save', function (next) {
  this.totalCapacity = this.sections.reduce((sum, section) => sum + section.capacity, 0)

  if (this.isNew) {
    this.availableSeats = this.totalCapacity
  }

  next()
})

classMasterSchema.index({ academicSession: 1, className: 1 }, { unique: true })

const ClassMaster: Model<IClassMaster> =
  mongoose.models.ClassMaster || mongoose.model<IClassMaster>('ClassMaster', classMasterSchema)

export default ClassMaster
