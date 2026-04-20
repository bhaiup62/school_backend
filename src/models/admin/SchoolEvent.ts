import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISchoolEvent extends Document {
  title: string
  startDate: Date
  endDate: Date
  type: 'Holiday' | 'Exam' | 'Activity' | 'PTM' | 'Administrative'
  academicSession: mongoose.Types.ObjectId
  appliesToClasses: mongoose.Types.ObjectId[]
  description?: string
  createdAt: Date
  updatedAt: Date
}

const schoolEventSchema = new Schema<ISchoolEvent>(
  {
    title: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ['Holiday', 'Exam', 'Activity', 'PTM', 'Administrative'],
      required: true,
    },
    academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    appliesToClasses: [{ type: Schema.Types.ObjectId, ref: 'ClassMaster' }],
    description: { type: String },
  },
  { timestamps: true }
)

schoolEventSchema.index({ academicSession: 1, startDate: 1 })

const SchoolEvent: Model<ISchoolEvent> =
  mongoose.models.SchoolEvent || mongoose.model<ISchoolEvent>('SchoolEvent', schoolEventSchema)

export default SchoolEvent
