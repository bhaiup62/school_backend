import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IElectiveGroup extends Document {
  academicSession: mongoose.Types.ObjectId
  classId: mongoose.Types.ObjectId
  groupName: string
  subjects: mongoose.Types.ObjectId[]
  minSelect: number
  maxSelect: number
}

const electiveGroupSchema = new Schema<IElectiveGroup>(
  {
    academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'ClassMaster', required: true },
    groupName: { type: String, required: true },
    subjects: [{ type: Schema.Types.ObjectId, ref: 'SubjectMaster', required: true }],
    minSelect: { type: Number, required: true },
    maxSelect: { type: Number, required: true },
  },
  { timestamps: true }
)

electiveGroupSchema.path('maxSelect').validate(function (this: IElectiveGroup, value: number) {
  return this.minSelect <= value
}, 'minSelect must be less than or equal to maxSelect')

const ElectiveGroup: Model<IElectiveGroup> =
  mongoose.models.ElectiveGroup || mongoose.model<IElectiveGroup>('ElectiveGroup', electiveGroupSchema)

export default ElectiveGroup
