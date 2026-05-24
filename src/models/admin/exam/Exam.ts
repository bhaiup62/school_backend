import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IExam extends Document {
  name: string
  academicSession: mongoose.Types.ObjectId
  type: 'Unit Test' | 'Mid Term' | 'Final' | 'Practical'
  startDate: Date
  endDate: Date
  classes: mongoose.Types.ObjectId[]
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Results Published'
}

const examSchema = new Schema<IExam>(
  {
    name: { type: String, required: true, trim: true },
    academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    type: {
      type: String,
      required: true,
      enum: ['Unit Test', 'Mid Term', 'Final', 'Practical'],
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    classes: [{ type: Schema.Types.ObjectId, ref: 'ClassMaster', required: true }],
    status: {
      type: String,
      enum: ['Upcoming', 'Ongoing', 'Completed', 'Results Published'],
      default: 'Upcoming',
    },
  },
  { timestamps: true }
)

examSchema.index({ academicSession: 1 })
examSchema.index({ status: 1 })

const Exam: Model<IExam> = mongoose.models.Exam || mongoose.model<IExam>('Exam', examSchema)

export default Exam
