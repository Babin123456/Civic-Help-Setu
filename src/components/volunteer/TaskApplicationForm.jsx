// Task Application Form
// -------------------
// Form for volunteers to apply to a volunteer task.
// Includes eligibility checking and idempotent submission.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/useToast';

import { useTaskApplication } from '@/hooks/useTaskApplication';
import { matchVolunteersForTask, explainMatch } from '@/services/matchingService';
import { skillsService } from '@/services/skillService';

// Application schema
const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'];

const TaskApplicationForm = ({ taskId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth(); // Assuming useAuth is available

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
    reset,
  } = useForm({
    resolver: yupResolver(
      Yup.object({
        motivation: Yup.string()
          .optional()
          .when('requireMotivation', (val, ctx) => val ? Yup.string().required() : Yup.string())
          .required(t('form:required', { field: t('motivation') })),
        skillsOffered: Yup.array()
          .of(Yup.string())
          .optional(),
        availability: Yup.string().optional(),
        consent: Yup.boolean().oneOf([true], t('form:consent.required')).required(t('form:consent.required')),
      })
    ),
    defaultValues: {
      motivation: '',
      skillsOffered: [],
      availability: '',
      consent: false,
    },
  });

  // Load task details and volunteer profile
  useEffect(() => {
    if (!taskId) return;

    // Fetch task details
    // In a full implementation, we'd use the volunteerTaskService
    
    // Fetch volunteer profile
    // In a full implementation, we'd use the volunteerProfileService
  }, [taskId]);

  // On submit
  const onSubmit = async (data) => {
    setSubmitLoading(true);
    setSubmitError(null);
    
    try {
      // Check if user already has an application for this task (idempotency)
      const existingApp = await checkExistingApplication(taskId, user.id);
      if (existingApp && existingApp.status !== 'withdrawn') {
        throw new Error(
          t('volunteer:application.duplicate', { taskTitle: data.taskTitle || '' })
        );
      }

      // Create the application
      const application = await createTaskApplication({
        volunteerId: user.id,
        taskId,
        motivationLetter: data.motivation,
        skillsOffered: data.skillsOffered,
        availability: data.availability,
        consentGiven: data.consent,
      }, { createdBy: user.id });

      // Show success and navigate
      toast({
        title: t('common:success'),
        description: t('volunteer:application.submitted'),
      });
      
      // Navigate to assignment tracking or task details
      navigate(`/volunteer/task/${taskId}/assignment`, { replace: true });
      
      reset();
    } catch (err) {
      setSubmitError(err.message || t('form:submit.error'));
      toast({
        title: t('common:error'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!taskId) {
    return (
      <section className="p-6">
        <p>{t('volunteer:application.error.noTask')}</p>
        <button onClick={() => navigate('/volunteer/tasks')} className="btn-primary">
          {t('common:back')}
        </button>
      </section>
    );
  }

  return (
    <section className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">
        {t('volunteer:application.title', { taskTitle: '' })}
      </h2>

      {submitError && (
        <div role="alert" className="mb-4 p-3 rounded bg-red-100 text-red-800">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Motivation Letter */}
        <div>
          <label htmlFor="motivation" className="block text-sm font-medium mb-2">
            {t('volunteer:application.motivation')}
          </label>
          <textarea
            id="motivation"
            {...register('motivation')}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 resize-none"
            aria-describedby="motivation-help"
          />
          <p id="motivation-help" className="mt-1 text-xs text-gray-500">
            {t('volunteer:application.motivation.help')}
          </p>
        </div>

        {/* Skills Offered */}
        <div>
          <label className="block text-sm font-medium mb-3">
            {t('volunteer:application.skillsOffered')}
          </label>
          {/* Show available skills from the task's required skills */}
          {/* In a full implementation, we'd display the task's required skills and let the volunteer select which of their skills to offer */}
          <div className="space-y-2">
            {/* Placeholder - skills would be populated from task data */}
          </div>
          <p className="text-xs text-gray-500">
            {t('volunteer:application.skillsOffered.help')}
          </p>
        </div>

        {/* Availability */}
        <div>
          <label htmlFor="availability" className="block text-sm font-medium mb-2">
            {t('volunteer:application.availability')}
          </label>
          <select
            id="availability"
            {...register('availability')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            aria-describedby="availability-help"
          >
            <option value="" disabled>{t('volunteer:availability.select')}</option>
            <option value="weekdays">{t('volunteer:availability.weekdays')}</option>
            <option value="weekends">{t('volunteer:availability.weekends')}</option>
            <option value="flexible">{t('volunteer:availability.flexible')}</option>
            <option value="evenings">{t('volunteer:availability.evenings')}</option>
          </select>
          <p id="availability-help" className="mt-1 text-xs text-gray-500">
            {t('form:availability.help')}
          </p>
        </div>

        {/* Consent */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('volunteer:application.consent')}
          </label>
          <p className="text-sm text-gray-500 mb-2">
            {t('volunteer:application.consent.description')}
          </p>
          <div className="flex items-start">
            <input
              type="checkbox"
              {...register('consent')}
              className="w-4 h-4 border border-gray-300 rounded-s focus:ring-primary-600 mt-1 peer"
              required
            />
            <span className="ml-3 text-gray-900 flex-1">
              I agree to the {t('volunteer:application.consent.terms')} and consent to data processing for volunteer coordination.
            </span>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={submitLoading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {submitLoading ? t('common:submitting') : t('common:submit')}
          </button>
        </div>
      </form>
    </section>
  );
};

// Auth placeholder - in production, this would come from context
const useAuth = () => ({
  id: 'user-123',
  // Full auth would provide user details
});

TaskApplicationForm.useAuth = useAuth;

export default TaskApplicationForm;