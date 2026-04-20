// src/models/Receptionist.ts

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IReceptionist extends Document {
  user:            mongoose.Types.ObjectId
  receptionistId:  string
  firstName:       string
  lastName:        string
  phone:           string
  email:           string
  address:         string
  city:            string
  pincode:         string
  qualification:   string
  joiningDate:     Date
  shift:           'morning' | 'afternoon' | 'full_day'
  isActive:        boolean
  createdAt:       Date
  updatedAt:       Date
  fullName:        string
}

const ReceptionistSchema = new Schema<IReceptionist>(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
    },
    receptionistId: {
      type:     String,
      required: [true, 'Receptionist ID is required'],
      unique:   true,
      uppercase: true,
      trim:     true,
      match:    [/^RCP-\d{4}-\d{4}$/, 'Format must be RCP-YYYY-NNNN'],
    },
    firstName: {
      type:     String,
      required: [true, 'First name is required'],
      trim:     true,
      maxlength: 50,
    },
    lastName: {
      type:     String,
      required: [true, 'Last name is required'],
      trim:     true,
      maxlength: 50,
    },
    phone: {
      type:     String,
      required: [true, 'Phone number is required'],
      match:    [/^\d{10}$/, 'Phone number must be 10 digits'],
    },
    email: {
      type:     String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim:     true,
      match:    [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    address:  { type: String, default: '' },
    city:     { type: String, default: '' },
    pincode:  { type: String, default: '' },
    qualification: { type: String, default: '' },
    joiningDate: {
      type:    Date,
      default: Date.now,
    },
    shift: {
      type:    String,
      enum:    ['morning', 'afternoon', 'full_day'],
      default: 'full_day',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// Virtual for full name
ReceptionistSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`
})

// Ensure virtuals are included in JSON
ReceptionistSchema.set('toJSON', { virtuals: true })
ReceptionistSchema.set('toObject', { virtuals: true })

const Receptionist: Model<IReceptionist> =
  mongoose.models.Receptionist || mongoose.model<IReceptionist>('Receptionist', ReceptionistSchema)

export default Receptionist
