// src/scripts/seedAdmin.ts
// Run: npx ts-node src/scripts/seedAdmin.ts

import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Load .env from project root (same as your working seedSchoolData.ts)
dotenv.config()

import User from '../models/shared/User'
import Admin from '../models/admin/Admin'

const seedAdmin = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI as string)
    console.log('✅ Connected to MongoDB\n')
    
    const adminId = 'ADM-2026-0001'

    // 1. Check if admin already exists
    const existingUser = await User.findOne({ admissionNumber: adminId })
    if (existingUser) {
      console.log('⚠️ Admin user already exists in the database!')
      process.exit(0)
    }

    // 2. Create User auth record
    console.log('⏳ Creating User Auth Record...')
    const user = new User({
      admissionNumber: adminId,
      password: 'superadmin123', // will be hashed by your pre('save') hook
      role: 'admin',
      isActive: true
    })
    await user.save()

    // 3. Create Admin profile
    console.log('⏳ Creating Admin Profile Record...')
    const adminProfile = new Admin({
      user: user._id,          // ← links to User (required by your schema pattern)
      adminId: adminId,
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@sps.edu',
      phone: '9999999999',
      isActive: true
    })
    await adminProfile.save()

    console.log('🎉 Super Admin created successfully!')
    console.log('--------------------------------------------------')
    console.log(`🔑 Login ID: ${adminId}`)
    console.log(`🔑 Password: superadmin123`)
    console.log('--------------------------------------------------')
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding admin:', error)
    process.exit(1)
  }
}

seedAdmin()