// src/models/Principal.ts

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IPrincipal extends Document {
  user:           mongoose.Types.ObjectId   // ref → User
  principalId:    string                    // e.g. PRI-2024-0001
  firstName:      string
  lastName:       string
  phone:          string
  email:          string
  address:        string
  city:           string
  pincode:        string
  qualification:  string
  experience:     number                    // years of experience
  specialization: string
  joiningDate:    Date
  photo:          string
  signature:      string                    // digital signature image for certificates
  isActive:       boolean
  createdAt:      Date
  updatedAt:      Date
  // Virtual
  fullName:       string
}

const PrincipalSchema = new Schema<IPrincipal>(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },
    principalId: {
      type:      String,
      required:  true,
      unique:    true,
      uppercase: true,
      trim:      true,
      match: [/^PRI-\d{4}-\d{4}$/, 'Format must be PRI-YYYY-NNNN'],
    },
    firstName:      { type: String, required: true, trim: true },
    lastName:       { type: String, required: true, trim: true },
    phone:          { type: String, required: true },
    email:          { type: String, default: '' },
    address:        { type: String, default: '' },
    city:           { type: String, default: 'Varanasi' },
    pincode:        { type: String, default: '' },
    qualification:  { type: String, default: '' },
    experience:     { type: Number, default: 0 },
    specialization: { type: String, default: '' },
    joiningDate:    { type: Date, default: Date.now },
    photo:          { type: String, default: '' },
    signature:      { type: String, default: '' },
    isActive:       { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Virtual: full name
PrincipalSchema.virtual('fullName').get(function (this: IPrincipal) {
  return `${this.firstName} ${this.lastName}`
})

const Principal: Model<IPrincipal> =
  mongoose.models.Principal || mongoose.model<IPrincipal>('Principal', PrincipalSchema)

export default Principal
