// Assignment Hook
// ---------------
// Custom hook for managing assignment state.

import { useState, useEffect, useCallback } from 'react';
import {
  createAssignment,
  readAssignment,
  updateAssignment,
  cancelAssignment,
  listAssignments,
} from '@/services/assignmentService';
import { useToast } from '@/components/ui/useToast';
import { useAuth } from '@/context/AuthContext';

/**
 * Hook for managing an assignment.
 * 
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.assignmentId] - The assignment ID
 * @returns {Object} Assignment state and handlers
 */
export function useAssignment(options = {}) {
  const { assignmentId } = options;
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load assignment on mount
  useEffect(() => {
    const loadAssignment = async () => {
      if (!assignmentId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const result = await readAssignment(assignmentId);
        setAssignment(result);
      } catch (err) {
        setError(err.message || t('common:error'));
        toast({
          title: t('common:error'),
          description: err.message || t('volunteer:assignment.loadFailed'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadAssignment();
  }, [assignmentId, t, toast]);

  // Check in / check out (simplified - would use attendance service)
  const checkIn = useCallback(async () => {
    if (!assignment) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Create an attendance event for check-in
      // In a full implementation, we'd use the attendance event service
      // For now, just update the assignment status
      const result = await updateAssignment(assignmentId, {
        status: 'active',
      }, { updatedBy: user?.id });
      
      setAssignment(result);
      toast({
        title: t('common:success'),
        description: t('volunteer:checkIn.success'),
      });
    } catch (err) {
      setError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, user, t, toast]);

  // Mark assignment as completed
  const complete = useCallback(async (notes) => {
    if (!assignment) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await updateAssignment(assignmentId, {
        status: 'completed',
        completedAt: new Date().toISOString().split('T')[0],
        notes,
      }, { updatedBy: user?.id });
      
      setAssignment(result);
      toast({
        title: t('common:success'),
        description: t('volunteer:assignment.completed'),
      });
    } catch (err) {
      setError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, user, t, toast]);

  // Cancel assignment
  const cancel = useCallback(async (reason) => {
    if (!assignment) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await cancelAssignment(assignmentId, { reason });
      
      setAssignment(result);
      toast({
        title: t('common:success'),
        description: t('volunteer:assignment.cancelled'),
      });
    } catch (err) {
      setError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, t, toast]);

  return {
    assignment,
    isLoading,
    error,
    hasAssignment: !!assignment,
    checkIn,
    complete,
    cancel,
    refresh: useCallback(async () => {
      await loadAssignment();
    }, [t, toast]),
  };
}