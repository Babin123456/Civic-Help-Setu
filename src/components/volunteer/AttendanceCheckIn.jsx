// Attendance Check-In Component
// -----------------------------
// Allows volunteers to check in/out of their assigned tasks.
// Records attendance events with location and timestamp.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/useToast';
import { useAssignment } from '@/hooks/useAssignment';

import { createAssignment, readAssignment, updateAssignment } from '@/services/assignmentService';
import { createAttendanceEvent, getAuditLog } from '@/services/attendanceEventService';

// Attendance modes
const ATTENDANCE_MODES = ['check-in', 'check-out'];

const AttendanceCheckIn = ({ assignmentId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);

  // Load assignment details
  useEffect(() => {
    // In a full implementation, we'd read the assignment
  }, [assignmentId]);

  const handleCheckIn = useCallback(async () => {
    setIsCheckingIn(true);
    setLocationError(null);

    try {
      // Create attendance event for check-in
      const attendance = await createAttendanceEvent({
        assignmentId,
        volunteerId: 'current-volunteer-id', // Would come from auth
        taskId: 'current-task-id', // Would derive from assignment
        mode: 'check-in',
        // In a real app, we'd get GPS location from the device
        location: hasLocation ? {
          latitude: 28.6139, // Example: Delhi
          longitude: 77.2090,
        } : undefined,
      });

      toast({
        title: t('common:success'),
        description: t('volunteer:checkIn.success'),
      });

      // Navigate away or update UI
      // In a full app, we might redirect to the assignment dashboard
    } catch (err) {
      setLocationError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message || t('volunteer:checkIn.failed'),
        variant: 'destructive',
      });
    } finally {
      setIsCheckingIn(false);
    }
  }, [assignmentId, toast, t]);

  const handleCheckOut = useCallback(async () => {
    setIsCheckingOut(true);

    try {
      // Create attendance event for check-out
      const attendance = await createAttendanceEvent({
        assignmentId,
        volunteerId: 'current-volunteer-id',
        taskId: 'current-task-id',
        mode: 'check-out',
        location: hasLocation ? {
          latitude: 28.6139,
          longitude: 77.2090,
        } : undefined,
        notes: t('volunteer:checkOut.completed'),
      });

      toast({
        title: t('common:success'),
        description: t('volunteer:checkOut.success'),
      });
    } catch (err) {
      setLocationError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message || t('volunteer:checkOut.failed'),
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
    }
  }, [assignmentId, toast, t]);

  return (
    <section className="p-6 rounded bg-card border border-border">
      <h2 className="text-xl font-bold mb-6">
        {t('volunteer:checkIn.title')}
      </h2>

      {/* Assignment info */}
      <div className="mb-4 p-3 rounded bg-muted border border-border">
        <p className="font-medium">{t('volunteer:checkIn.assignment', { id: assignmentId })}</p>
        <p className="text-sm text-muted-extra">
          {t('volunteer:checkIn.task')}
        </p>
      </div>

      {/* Check-In Button */}
      {(!isCheckingIn && !isCheckingOut) && (
        <div>
          <button
            onClick={handleCheckIn}
            disabled={!assignmentId}
            className="w-full py-2 px-4 border border-primary-600 rounded-md shadow-sm text-lg font-medium text-primary-600 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
            {t('volunteer:checkIn.checkIn')}
          </button>
        </div>
      )}

      {/* Check-Out Button */}
      {(!isCheckingIn && !isCheckingOut) && (
        <div>
          <button
            onClick={handleCheckOut}
            disabled={!assignmentId}
            className="w-full py-2 px-4 border border-success-600 rounded-md shadow-sm text-lg font-medium text-success-600 hover:bg-success-50 focus:outline-none focus:ring-2 focus:ring-success-600 focus:ring-offset-2">
            {t('volunteer:checkOut.checkOut')}
          </button>
        </div>
      )}

      {/* Location status */}
      {hasLocation && (
        <p className="mt-3 text-sm text-success-600">
          {t('volunteer:checkIn.locationRecorded')}
        </p>
      )}

      {/* Location error */}
      {locationError && (
        <p className="mt-3 text-sm text-error-600">
          {locationError}
        </p>
      )}

      {/* Loading states */}
      {isCheckingIn && (
        <p className="mt-3 text-sm text-primary-600">
          {t('common:processing')}
        </p>
      )}

      {isCheckingOut && (
        <p className="mt-3 text-sm text-success-600">
          {t('common:processing')}
        </p>
      )}
    </section>
  );
};

export default AttendanceCheckIn;