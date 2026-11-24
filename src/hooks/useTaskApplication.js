// Task Application Hook
// -------------------
// Custom hook for managing task applications, including submission,
// status tracking, and idempotency checks.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createTaskApplication,
  readTaskApplication,
  updateTaskApplicationStatus,
  withdrawTaskApplication,
  listTaskApplications,
} from '@/services/taskApplicationService';
import { useToast } from '@/components/ui/useToast';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook for managing a volunteer's task applications.
 * 
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.volunteerId] - The volunteer's ID (from auth)
 * @returns {Object} Application state and handlers
 */
export function useTaskApplication(options = {}) {
  const { volunteerId } = options;
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load applications on mount
  useEffect(() => {
    const loadApplications = async () => {
      const id = volunteerId || (user && user.id);
      if (!id) {
        setApplications([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const result = await listTaskApplications({ volunteerId: id });
        setApplications(result.applications || []);
      } catch (err) {
        setError(err.message || t('common:error'));
        toast({
          title: t('common:error'),
          description: err.message || t('volunteer:apps.loadFailed'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadApplications();
  }, [volunteerId, user, t, toast]);

  // Check for existing application (idempotency)
  const checkExistingApplication = useCallback(async (taskId) => {
    if (!volunteerId) return null;
    
    try {
      const result = await listTaskApplications({
        volunteerId,
        taskId,
      });
      return result.applications?.[0] || null;
    } catch (err) {
      return null;
    }
  }, [volunteerId]);

  // Submit a new application
  const submitApplication = useCallback(async (taskId, applicationData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Idempotency check
      const existing = await checkExistingApplication(taskId);
      if (existing && existing.status !== 'withdrawn') {
        const err = new Error(
          t('volunteer:application.duplicate', { 
            taskTitle: existing.taskTitle || 'this task' 
          })
        );
        throw err;
      }

      const result = await createTaskApplication({
        volunteerId,
        taskId,
        ...applicationData,
      }, { createdBy: volunteerId });

      toast({
        title: t('common:success'),
        description: t('volunteer:application.submitted'),
      });
      
      // Refresh applications list
      await loadApplications();
      
      return result;
    } catch (err) {
      setError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [taskId, checkExistingApplication, loadApplications, t, toast]);

  // Update application status (coordinator action)
  const updateStatus = useCallback(async (applicationId, newStatus, overrideReason) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await updateTaskApplicationStatus(applicationId, newStatus, {
        updatedBy: applicationId,
        overrideReason,
      });
      
      toast({
        title: t('common:success'),
        description: t('volunteer:application.updated', { status: newStatus }),
      });
      
      await loadApplications();
      return result;
    } catch (err) {
      setError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadApplications, t, toast]);

  // Withdraw application (volunteer action)
  const withdraw = useCallback(async (applicationId) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await withdrawTaskApplication(applicationId, {
        withdrawnBy: volunteerId,
      });
      
      toast({
        title: t('common:success'),
        description: t('volunteer:application.withdrawn'),
      });
      
      await loadApplications();
      return result;
    } catch (err) {
      setError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [volunteerId, loadApplications, t, toast]);

  return {
    applications,
    isLoading,
    error,
    hasApplications: applications.length > 0,
    checkExistingApplication,
    submitApplication,
    updateStatus,
    withdraw,
    refresh: useCallback(async () => {
      await loadApplications();
    }, [loadApplications, t, toast]),
  };
}