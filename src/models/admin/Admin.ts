// src/models/admin/Admin.ts

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IAdmin extends Document {
  adminId: string; // Links to User.admissionNumber (e.g., ADM-2024-0001)
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isActive: boolean;
}

const AdminSchema = new Schema<IAdmin>(
  {
    adminId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const Admin: Model<IAdmin> = mongoose.models.Admin || mongoose.model<IAdmin>('Admin', AdminSchema)

export default Admin