// src/scripts/migrateStudents.ts
// Run: npx ts-node src/scripts/migrateStudents.ts
// Purpose: Renames the old class, section, and session fields to match the new rollover-ready schema.

import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'

const migrate = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI as string)
    console.log('✅ Connected to MongoDB\n')

    console.log('🔄 Starting Student data migration...')
    
    // We use the native MongoDB driver collection here to bypass Mongoose's 
    // strict schema validation, allowing us to interact with the old field names.
    const studentCollection = mongoose.connection.db!.collection('students')

    // The $rename operator updates all existing documents instantly
    const result = await studentCollection.updateMany(
      {}, // Match all students
      { 
        $rename: { 
          "class": "currentClass", 
          "section": "currentSection", 
          "session": "currentSession" 
        } 
      }
    )

    console.log('\n✅ Migration completed successfully!')
    console.log(`📊 Total Students Found: ${result.matchedCount}`)
    console.log(`📝 Students Updated: ${result.modifiedCount}\n`)

  } catch (error: any) {
    console.error('\n❌ Migration error:', error.message)
    console.error(error.stack)
  } finally {
    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
    process.exit(0)
  }
}

migrate()