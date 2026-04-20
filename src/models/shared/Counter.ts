import mongoose, { Document, Schema, Model } from 'mongoose'

export interface ICounter {
  _id: string // e.g., 'SPS-2024', 'TCH-2024', 'PAR-2024'
  seq: number
}

interface ICounterModel extends Model<ICounter> {
  getNextSequence(prefix: string, year?: number): Promise<string>
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
})

/**
 * Atomically increments the counter and returns the new value.
 * Uses findOneAndUpdate with upsert to handle race conditions.
 */
CounterSchema.statics.getNextSequence = async function (
  prefix: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const counterId = `${prefix}-${year}`
  
  const counter = await this.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
  
  return `${prefix}-${year}-${String(counter!.seq).padStart(4, '0')}`
}

export const Counter = mongoose.model<ICounter, ICounterModel>('Counter', CounterSchema)
