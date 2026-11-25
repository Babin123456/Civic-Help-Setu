// Volunteer Profile Hook
// ---------------------
// Custom hook for managing volunteer profile state, including loading,
// error handling, and service integration.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createVolunteerProfile,
  readVolunteerProfile,
  updateVolunteerProfile,
  listVolunteerProfiles,
} from '@/services/volunteerProfileService';
import { useToast } from '@/components/ui/useToast';

/**
 * Hook for managing a volunteer's profile.
 * 
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.userId] - The current user's ID (derived from auth if not provided)
 * @returns {Object} Profile state and handlers
 */
export function useVolunteerProfile(options = {}) {
  const { userId } = options;
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  // Fetch profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const result = await readVolunteerProfile(userId);
        setProfile(result);
      } catch (err) {
        setError(err.message || t('common:error'));
        toast({
          title: t('common:error'),
          description: err.message || t('volunteer:profile.loadFailed'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId, t, toast]);

  // Update profile
  const update = useCallback(async (updates) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await updateVolunteerProfile(userId, updates, {
        updatedBy: userId,
      });
      setProfile(result);
      
      toast({
        title: t('common:success'),
        description: t('volunteer:profile.updated'),
      });
      
      return result;
    } catch (err) {
      setError(err.message || t('common:error'));
      toast({
        title: t('common:error'),
        description: err.message || t('volunteer:profile.updateFailed'),
        variant: 'destructive',
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, t, toast]);

  // Refresh profile
  const refresh = useCallback(async () => {
    return loadProfile();
  }, [t, toast]);

  return {
    profile,
    isLoading,
    error,
    hasProfile: !!profile,
    refresh,
    update,
  };
}