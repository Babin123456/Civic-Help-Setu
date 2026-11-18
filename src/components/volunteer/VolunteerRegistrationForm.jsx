// Volunteer Registration Form
// --------------------------
// Form for citizens to register skills and preferred service areas.
// Focused on presentation, form state, and accessible interaction.

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// Import services
import { useVolunteerProfile } from '@/hooks/useVolunteerProfile';
import { skillsService } from '@/services/skillService';
import { serviceAreaContract } from '@/data/serviceAreaContract';

// Skill types for the form
const SKILL_OPTIONS = [
  { value: 'first-aid', label: 'First Aid / Medical' },
  { value: 'disaster-response', label: 'Disaster Response' },
  { value: 'education', label: 'Education & Tutoring' },
  { value: 'food-distribution', label: 'Food Distribution' },
  { value: 'translation', label: 'Translation & Interpretation' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'elder-care', label: 'Elder Care' },
  { value: 'language-teaching', label: 'Language Teaching' },
  { value: 'community-outreach', label: 'Community Outreach' },
  { value: 'environment', label: 'Environment & Cleanup' },
  { value: 'construction', label: 'Construction & Repair' },
  { value: 'administrative', label: 'Administrative & Legal' },
];

// Service area categories
const SERVICE_AREA_OPTIONS = [
  { value: 'city-center', label: 'City Center' },
  { value: 'suburban', label: 'Suburban' },
  { value: 'rural', label: 'Rural' },
  { value: 'specific-ward', label: 'Specific Ward' },
];

const VolunteerRegistrationForm = () => {
  const { t } = useTranslation();
  const [skills, setSkills] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitSuccessful },
    reset,
  } = useForm({
    resolver: yupResolver(
      Yup.object({
        fullName: Yup.string().required(t('form:required', { field: t('fullName') })).trim(),
        email: Yup.string().email(t('form:email.invalid')).optional().trim(),
        phone: Yup.string().optional().trim(),
        // Skills as array of selected values
        skills: Yup.array().of(Yup.string()).optional(),
        // Service areas as array of selected values
        serviceAreas: Yup.array().of(Yup.string()).optional(),
        availability: Yup.string().optional().trim(),
        consent: Yup.boolean().oneOf([true], t('form:consent.required')).required(t('form:consent.required')),
      })
    ),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      skills: [],
      serviceAreas: [],
      availability: '',
      consent: false,
    },
  });

  // Handle skill selection change
  const onSkillChange = (e) => {
    const selected = e.target.value;
    if (selected) {
      // Toggle skill on/off
      const updated = skills.includes(selected)
        ? skills.filter((s) => s !== selected)
        : [...skills, selected];
      setSkills(updated);
    }
  };

  // Handle service area selection change
  const onServiceAreaChange = (e) => {
    const selected = e.target.value;
    if (selected) {
      const updated = serviceAreas.includes(selected)
        ? serviceAreas.filter((s) => s !== selected)
        : [...serviceAreas, selected];
      setServiceAreas(updated);
    }
  };

  // On submit
  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);
    
    try {
      // Create volunteer profile via service
      const { createVolunteerProfile } = await import('./volunteerProfileService.js');
      const profile = await createVolunteerProfile({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        skills: data.skills.map(id => ({ id, name: getSkillName(id) })),
        serviceAreas: data.serviceAreas,
        availabilityPattern: data.availability,
        consentGiven: data.consent,
        isAvailable: true,
      }, { createdBy: 'citizen' });
      
      // Show success
      reset();
      // Navigate to tasks or show success message
      // In a real app: router.push('/volunteer-tasks')
      alert(t('volunteer:registration.success', { name: data.fullName }));
    } catch (err) {
      setError(err.message || t('form:submit.error'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch available skills and service areas
  useEffect(() => {
    // Skills are defined locally; service areas could come from an API
    // In production, fetch from the skill service
  }, []);

  const getSkillName = (id) => {
    const skill = SKILL_OPTIONS.find((s) => s.value === id);
    return skill ? skill.label : id;
  };

  return (
    <section className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">{t('volunteer:registration.title')}</h2>
      
      {error && (
        <div role="alert" className="mb-4 p-3 rounded bg-red-100 text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium mb-2">
            {t('fullName')}
          </label>
          <input
            id="fullName"
            {...register('fullName')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            required
            aria-describedby="fullName-help"
          />
          <p id="fullName-help" className="mt-1 text-xs text-gray-500">
            {t('form:fullName.help')}
          </p>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            {t('email')}
          </label>
          <input
            id="email"
            {...register('email')}
            type="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            aria-describedby="email-help"
          />
          <p id="email-help" className="mt-1 text-xs text-gray-500">
            {t('form:email.help')}
          </p>
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-2">
            {t('phone')}
          </label>
          <input
            id="phone"
            {...register('phone')}
            type="tel"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            aria-describedby="phone-help"
          />
          <p id="phone-help" className="mt-1 text-xs text-gray-500">
            {t('form:phone.help')}
          </p>
        </div>

        {/* Skills */}
        <div>
          <label className="block text-sm font-medium mb-3">
            {t('volunteer:registration.skills')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SKILL_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`relative flex items-center px-3 py-2 border rounded-md ${
                  skills.includes(option.value)
                    ? 'border-primary-600 bg-primary-100 text-primary-800'
                    : 'border-gray-300 hover:border-gray-500'
                }`}
              >
                <input
                  type="checkbox"
                  value={option.value}
                  checked={skills.includes(option.value)}
                  onChange={onSkillChange}
                  className="peer cursor-pointer rounded accent-primary-600"
                  aria-label={t(`volunteer:registration.skill.${option.value}`, { defaultValue: option.label })}
                />
                <span className="ml-2">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t('volunteer:registration.skills.help')}
          </p>
        </div>

        {/* Service Areas */}
        <div>
          <label className="block text-sm font-medium mb-3">
            {t('volunteer:registration.serviceAreas')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SERVICE_AREA_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`relative flex items-center px-3 py-2 border rounded-md ${
                  serviceAreas.includes(option.value)
                    ? 'border-primary-600 bg-primary-100 text-primary-800'
                    : 'border-gray-300 hover:border-gray-500'}
              }>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={serviceAreas.includes(option.value)}
                  onChange={onServiceAreaChange}
                  className="peer cursor-pointer rounded accent-primary-600"
                  aria-label={t(`volunteer:registration.serviceArea.${option.value}`, { defaultValue: option.label })}
                />
                <span className="ml-2">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t('volunteer:registration.serviceAreas.help')}
          </p>
        </div>

        {/* Availability */}
        <div>
          <label htmlFor="availability" className="block text-sm font-medium mb-2">
            {t('volunteer:registration.availability')}
          </label>
          <select
            id="availability"
            {...register('availability')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            aria-describedby="availability-help"
          >
            <option value="" disabled>{t('volunteer:registration.availability.select')}</option>
            <option value="weekdays">{t('volunteer:registration.availability.weekdays')}</option>
            <option value="weekends">{t('volunteer:registration.availability.weekends')}</option>
            <option value="flexible">{t('volunteer:registration.availability.flexible')}</option>
            <option value="evenings">{t('volunteer:registration.availability.evenings')}</option>
          </select>
          <p id="availability-help" className="mt-1 text-xs text-gray-500">
            {t('form:availability.help')}
          </p>
        </div>

        {/* Consent */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('volunteer:registration.consent')}
          </label>
          <p className="text-sm text-gray-500 mb-2">
            {t('volunteer:registration.consent.description')}
          </p>
          <div className="flex items-start">
            <input
              type="checkbox"
              {...register('consent')}
              className="w-4 h-4 border border-gray-300 rounded-s focus:ring-primary-600 mt-1 peer"
              required
            />
            <span className="ml-3 text-gray-900 flex-1">
              I agree to the {t('volunteer:registration.consent.terms')} and consent to data processing for volunteer coordination.
            </span>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? t('common:submitting') : t('common:submit')}
          </button>
        </div>
      </form>
    </section>
  );
};

export default VolunteerRegistrationForm;