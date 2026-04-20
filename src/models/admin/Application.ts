import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IApplicationChildData {
  firstName: string
  lastName: string
  dob: Date
  gender: 'Male' | 'Female' | 'Other'
  bloodGroup?: string
}

export interface IApplicationParentData {
  fatherName: string
  motherName: string
  phone: string
  email?: string
  occupation?: string
  annualIncome?: number
}

export interface IApplicationPayment {
  status: 'Pending' | 'Paid' | 'Failed'
  transactionId?: string
  amount?: number
}

export interface IApplicationDocument {
  documentType?: string
  fileUrl?: string
  status: 'Pending' | 'Verified' | 'Rejected'
}

export interface IApplicationAssessment {
  interviewDate?: Date
  testScore?: number
}

export interface IApplication extends Document {
  applicationNumber: string
  academicSession: mongoose.Types.ObjectId
  appliedClass: mongoose.Types.ObjectId
  childData: IApplicationChildData
  parentData: IApplicationParentData
  payment: IApplicationPayment
  documents: IApplicationDocument[]
  assessment: IApplicationAssessment
  pipelineStatus:
    | 'Draft'
    | 'Submitted'
    | 'Document Verified'
    | 'Test Scheduled'
    | 'Offered'
    | 'Waitlisted'
    | 'Rejected'
    | 'Admitted'
  createdAt: Date
  updatedAt: Date
}

const ChildDataSchema = new Schema<IApplicationChildData>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    bloodGroup: { type: String },
  },
  { _id: false }
)

const ParentDataSchema = new Schema<IApplicationParentData>(
  {
    fatherName: { type: String, required: true },
    motherName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    occupation: { type: String },
    annualIncome: { type: Number },
  },
  { _id: false }
)

const PaymentSchema = new Schema<IApplicationPayment>(
  {
    status: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },
    transactionId: { type: String },
    amount: { type: Number },
  },
  { _id: false }
)

const DocumentSchema = new Schema<IApplicationDocument>(
  {
    documentType: { type: String },
    fileUrl: { type: String },
    status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  },
  { _id: false }
)

const AssessmentSchema = new Schema<IApplicationAssessment>(
  {
    interviewDate: { type: Date },
    testScore: { type: Number },
  },
  { _id: false }
)

const ApplicationSchema = new Schema<IApplication>(
  {
    applicationNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    academicSession: { type: Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    appliedClass: { type: Schema.Types.ObjectId, ref: 'ClassMaster', required: true },
    childData: { type: ChildDataSchema, required: true },
    parentData: { type: ParentDataSchema, required: true },
    payment: { type: PaymentSchema, default: () => ({}) },
    documents: { type: [DocumentSchema], default: [] },
    assessment: { type: AssessmentSchema, default: () => ({}) },
    pipelineStatus: {
      type: String,
      enum: ['Draft', 'Submitted', 'Document Verified', 'Test Scheduled', 'Offered', 'Waitlisted', 'Rejected', 'Admitted'],
      default: 'Draft',
    },
  },
  { timestamps: true }
)

export const Application: Model<IApplication> =
  mongoose.models.Application || mongoose.model<IApplication>('Application', ApplicationSchema)

export default Application
