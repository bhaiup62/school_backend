import mongoose from 'mongoose'
import { Response } from 'express'
import { AuthRequest } from '../../../middleware/authMiddleware'
import AcademicSession, { IAcademicSession, IAcademicTerm } from '../../../models/admin/AcademicSession'
import ClassMaster from '../../../models/admin/ClassMaster'
import ClassSubjectMapping from '../../../models/admin/ClassSubjectMapping'
import Application from '../../../models/admin/Application'

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await AcademicSession.create(req.body)

    res.status(201).json({
      success: true,
      data: session,
      message: 'Academic session created successfully.',
    })
  } catch (error: unknown) {
    console.error('createSession error:', error)
    res.status(500).json({ success: false, message: 'Server error creating academic session.' })
  }
}

export const getAllSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await AcademicSession.find().sort({ startDate: -1 })

    res.status(200).json({
      success: true,
      data: sessions,
      message: 'Academic sessions fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getAllSessions error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching academic sessions.' })
  }
}

export const getSessionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    res.status(200).json({
      success: true,
      data: session,
      message: 'Academic session fetched successfully.',
    })
  } catch (error: unknown) {
    console.error('getSessionById error:', error)
    res.status(500).json({ success: false, message: 'Server error fetching academic session.' })
  }
}

export const updateSessionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const sessionId = req.params.id
    const { status } = req.body as { status?: IAcademicSession['status'] }

    if (!status) {
      await session.abortTransaction()
      res.status(400).json({ success: false, message: 'status is required.' })
      return
    }

    const existingSession = await AcademicSession.findById(sessionId).session(session)
    if (!existingSession) {
      await session.abortTransaction()
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    if (status === 'Active') {
      await AcademicSession.updateMany(
        { _id: { $ne: sessionId } },
        { $set: { isCurrentSession: false } },
        { session }
      )
    }

    const updatePayload: Partial<Pick<IAcademicSession, 'status' | 'isCurrentSession'>> = { status }
    if (status === 'Active') {
      updatePayload.isCurrentSession = true
    } else if (status === 'Archived' || status === 'Completed') {
      updatePayload.isCurrentSession = false
    }

    const updatedSession = await AcademicSession.findByIdAndUpdate(
      sessionId,
      { $set: updatePayload },
      { new: true, runValidators: true, session }
    )

    if (!updatedSession) {
      await session.abortTransaction()
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    await session.commitTransaction()

    res.status(200).json({
      success: true,
      data: updatedSession,
      message: 'Academic session status updated successfully.',
    })
  } catch (error: unknown) {
    await session.abortTransaction()
    console.error('updateSessionStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error updating academic session status.' })
  } finally {
    await session.endSession()
  }
}

export const addTermToSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id
    const { term } = req.body as { term?: IAcademicTerm }

    if (!term) {
      res.status(400).json({ success: false, message: 'term is required.' })
      return
    }

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    session.terms.push(term)
    await session.save()

    res.status(200).json({
      success: true,
      data: session,
      message: 'Term added to academic session successfully.',
    })
  } catch (error: unknown) {
    console.error('addTermToSession error:', error)
    res.status(500).json({ success: false, message: 'Server error adding term to academic session.' })
  }
}

export const toggleAdmissionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    session.isAdmissionOpen = !session.isAdmissionOpen
    await session.save()

    res.status(200).json({
      success: true,
      data: session,
      message: 'Admission status toggled successfully.',
    })
  } catch (error: unknown) {
    console.error('toggleAdmissionStatus error:', error)
    res.status(500).json({ success: false, message: 'Server error toggling admission status.' })
  }
}

export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id

    const session = await AcademicSession.findById(sessionId)
    if (!session) {
      res.status(404).json({ success: false, message: 'Academic session not found.' })
      return
    }

    if (session.isCurrentSession) {
      res.status(403).json({
        success: false,
        message: 'Current academic session cannot be deleted.',
      })
      return
    }

    const [classCount, applicationCount] = await Promise.all([
      ClassMaster.countDocuments({ academicSession: sessionId }),
      Application.countDocuments({ academicSession: sessionId }),
    ])

    if (classCount > 0 || applicationCount > 0) {
      res.status(409).json({
        success: false,
        message:
          'Academic session cannot be deleted because it is linked to classes or applications.',
      })
      return
    }

    await session.deleteOne()

    res.status(200).json({
      success: true,
      message: 'Academic session deleted successfully.',
    })
  } catch (error: unknown) {
    console.error('deleteSession error:', error)
    res.status(500).json({ success: false, message: 'Server error deleting academic session.' })
  }
}

export const rolloverSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { oldSessionId, newSessionId } = req.body;
    if (!oldSessionId || !newSessionId) {
      res.status(400).json({ success: false, message: 'oldSessionId and newSessionId are required.' });
      return;
    }

    // 1. Fetch old classes
    const oldClasses = await mongoose.models.ClassMaster.find({ academicSession: oldSessionId });
    const classIdMap: Record<string, string> = {};
    let classesCreated = 0;

    // 2. Clone Classes
    for (const oldClass of oldClasses) {
      const classData = oldClass.toObject();
      delete classData._id;
      delete classData.createdAt;
      delete classData.updatedAt;
      
      classData.academicSession = newSessionId;
      // Reset seats for the new academic year
      classData.availableSeats = classData.totalCapacity; 

      const newClass = await mongoose.models.ClassMaster.create(classData);
      // Map the old class ID to the newly generated class ID
      classIdMap[oldClass._id.toString()] = newClass._id.toString();
      classesCreated++;
    }

    // 3. Fetch old mappings
    const oldMappings = await mongoose.models.ClassSubjectMapping.find({ academicSession: oldSessionId });
    let mappingsCreated = 0;

    // 4. Clone Mappings and attach to NEW Class IDs
    for (const oldMapping of oldMappings) {
      const newClassId = classIdMap[oldMapping.classId.toString()];
      if (!newClassId) continue; // Skip if class wasn't cloned

      const mappingData = oldMapping.toObject();
      delete mappingData._id;
      delete mappingData.createdAt;
      delete mappingData.updatedAt;
      
      mappingData.academicSession = newSessionId;
      mappingData.classId = newClassId; // Attach to the new class!

      await mongoose.models.ClassSubjectMapping.create(mappingData);
      mappingsCreated++;
    }

    res.status(200).json({
      success: true,
      message: `Rollover complete! Migrated ${classesCreated} classes and ${mappingsCreated} subjects.`,
    });
  } catch (error) {
    console.error('rolloverSession error:', error);
    res.status(500).json({ success: false, message: 'Server error during rollover.' });
  }
};