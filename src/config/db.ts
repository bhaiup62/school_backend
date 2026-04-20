import mongoose from 'mongoose'

const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGO_URI as string

    if (!uri) {
      throw new Error('MONGODB_URI is not defined in .env')
    }

    const conn = await mongoose.connect(uri)
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
  } catch (error: any) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`)
    process.exit(1)
  }
}

export default connectDB