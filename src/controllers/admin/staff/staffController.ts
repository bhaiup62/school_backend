import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../../../models/shared/User';
import Teacher from '../../../models/teacher/Teacher';
import Receptionist from '../../../models/receptionist/Receptionist';
import { Counter } from '../../../models/shared/Counter';
import { AuthRequest } from '../../../middleware/authMiddleware';

export const createStaffMember = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstName, lastName, email, phone, role, gender } = req.body;

    // 1. Validate role input
    if (!['teacher', 'receptionist'].includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role. Must be teacher or receptionist.' });
      return;
    }

    // 2. Check if email is already in use
    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email is already in use.' });
      return;
    }

    // 3. Generate unique Employee ID using your Counter model
    const counter = await Counter.findOneAndUpdate(
      { id: 'employee_number' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );
    const employeeId = `EMP-${new Date().getFullYear()}-${counter!.seq.toString().padStart(4, '0')}`;

    // 4. Generate a default password (they should change this on first login)
    const defaultPassword = `${firstName.toLowerCase()}@123`;

    // 5. Create the unified User login credential
    const newUser = await User.create([{
      email,
      password: defaultPassword,
      role,
      name: `${firstName} ${lastName}`
    }], { session });

    const userId = newUser[0]._id;
    let newProfile;

    // 6. Create the specific HR Profile based on the role
    if (role === 'teacher') {
      newProfile = await Teacher.create([{
        userId,
        employeeId,
        firstName,
        lastName,
        email,
        phone,
        gender,
        isActive: true
      }], { session });
    } else if (role === 'receptionist') {
      newProfile = await Receptionist.create([{
        userId,
        employeeId,
        firstName,
        lastName,
        email,
        phone,
        gender,
        isActive: true
      }], { session });
    }

    // 7. Commit the transaction ONLY if both User and Profile succeed
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully.`,
      data: {
        employeeId,
        firstName,
        lastName,
        email,
        role
        // We purposefully DO NOT send the password back in the JSON response for security
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('createStaffMember error:', error);
    res.status(500).json({ success: false, message: 'Server error creating staff member.' });
  }
};
export const getStaffMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, status } = req.query as { role?: string; status?: string };
    const activeQuery = status === 'inactive' ? false : true;
    let staff: any[] = [];

    // If no role filter is applied, or if the filter is 'teacher', fetch teachers
    if (!role || role === 'teacher') {
      const teachers = await Teacher.find({ isActive: activeQuery }).lean();
      // Tag them with the role so the UI knows what color badge to use
      const mappedTeachers = teachers.map(t => ({ ...t, role: 'teacher' }));
      staff = [...staff, ...mappedTeachers];
    }

    // If no role filter is applied, or if the filter is 'receptionist', fetch receptionists
    if (!role || role === 'receptionist') {
      const receptionists = await Receptionist.find({ isActive: activeQuery }).lean();
      // Tag them with the role
      const mappedReceptionists = receptionists.map(r => ({ ...r, role: 'receptionist' }));
      staff = [...staff, ...mappedReceptionists];
    }

    // Sort alphabetically by first name
    staff.sort((a, b) => a.firstName.localeCompare(b.firstName));

    res.status(200).json({ success: true, data: staff });
  } catch (error) {
    console.error('getStaffMembers error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching staff.' });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const { role, ...updateData } = req.body as {
      role?: 'teacher' | 'receptionist';
      [key: string]: unknown;
    };

    if (!id || !role || !['teacher', 'receptionist'].includes(role)) {
      res.status(400).json({ success: false, message: 'id and valid role (teacher | receptionist) are required.' });
      return;
    }

    const updatedStaff = role === 'teacher'
      ? await Teacher.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
      : await Receptionist.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

    if (!updatedStaff) {
      res.status(404).json({ success: false, message: `${role} profile not found.` });
      return;
    }

    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} updated successfully.`,
      data: updatedStaff,
    });
  } catch (error) {
    console.error('updateStaff error:', error);
    res.status(500).json({ success: false, message: 'Server error updating staff.' });
  }
};

export const deactivateStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const id = req.params.id;
    const { role } = req.body as { role?: 'teacher' | 'receptionist' };

    if (!id || !role || !['teacher', 'receptionist'].includes(role)) {
      await session.abortTransaction();
      res.status(400).json({ success: false, message: 'id and valid role (teacher | receptionist) are required.' });
      return;
    }

    const deactivatedProfile = role === 'teacher'
      ? await Teacher.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true, session }
      )
      : await Receptionist.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true, session }
      );

    if (!deactivatedProfile) {
      await session.abortTransaction();
      res.status(404).json({ success: false, message: `${role} profile not found.` });
      return;
    }

    const profileUserId = (deactivatedProfile as any).user || (deactivatedProfile as any).userId;
    if (!profileUserId) {
      throw new Error('STAFF_USER_LINK_MISSING');
    }

    const deactivatedUser = await User.findByIdAndUpdate(
      profileUserId,
      { isActive: false },
      { new: true, session }
    );

    if (!deactivatedUser) {
      await session.abortTransaction();
      res.status(404).json({ success: false, message: 'Associated user account not found.' });
      return;
    }

    await session.commitTransaction();
    res.status(200).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} deactivated successfully.`,
      data: {
        profile: deactivatedProfile,
        user: deactivatedUser,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('deactivateStaff error:', error);
    res.status(500).json({ success: false, message: 'Server error deactivating staff.' });
  } finally {
    await session.endSession();
  }
};
