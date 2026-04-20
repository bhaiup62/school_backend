// src/scripts/one.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load your environment variables (.env file)
dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'YOUR_MONGODB_URI_HERE';

async function migrateDatabase() {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully!');

    // FIX: Safely grab the database and prove to TypeScript it exists!
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("❌ Database connection is undefined!");
    }

    // Now TypeScript knows 'db' is 100% real
    const collection = db.collection('complaints');

    console.log('🚀 Starting Complaint Migration...');

    // 1. Rename the old fields to the new fields
    const renameResult = await collection.updateMany(
      { submittedBy: { $exists: true } },
      {
        $rename: {
          'submittedBy': 'raisedBy',
          'submittedByName': 'raisedByName',
          'submittedByRole': 'raisedByRole',
          'submittedByContact': 'raisedByContact'
        }
      }
    );
    console.log(`✅ Renamed fields for ${renameResult.modifiedCount} complaints.`);

    // 2. Fix the Category Enum
    const categoryResult = await collection.updateMany(
      { category: 'facilities' },
      { $set: { category: 'infrastructure' } }
    );
    console.log(`✅ Updated category 'facilities' -> 'infrastructure' for ${categoryResult.modifiedCount} complaints.`);

    // 3. Fix the Priority Enum
    const priorityResult = await collection.updateMany(
      { priority: 'normal' },
      { $set: { priority: 'medium' } }
    );
    console.log(`✅ Updated priority 'normal' -> 'medium' for ${priorityResult.modifiedCount} complaints.`);

    console.log('🎉 Migration completed successfully! Your database is now clean.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
}

migrateDatabase();