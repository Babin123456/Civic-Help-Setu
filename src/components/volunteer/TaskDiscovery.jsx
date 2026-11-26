// Task Discovery Component
// -----------------------
// Allows volunteers to discover nearby tasks published by coordinators.
// Supports filtering by skills, location, and availability.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';

// Import services
import {
  listVolunteerTasks,
  readVolunteerTask,
  getTopMatches,
  explainMatch,
} from '@/services/volunteerTaskService';
import { skillsService } from '@/services/skillService';
import { serviceAreaContract } from '@/data/serviceAreaContract';

// Task status display helpers
const STATUS_LABELS = {
  published: 'volunteer:task.status.published',
  draft: 'volunteer:task.status.draft',
  completed: 'volunteer:task.status.completed',
  archived: 'volunteer:task.status.archived',
};

const PRIORITY_LABELS = {
  low: 'volunteer:task.priority.low',
  medium: 'volunteer:task.priority.medium',
  high: 'volunteer:task.priority.high',
  urgent: 'volunteer:task.priority.urgent',
};

const TaskDiscovery = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State
  const [skills, setSkills] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [availability, setAvailability] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkillFilters, setSelectedSkillFilters] = useState([]);
  const [selectedAreaFilters, setSelectedAreaFilters] = useState([]);

  // Debounced search
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Query tasks from the service
  const { data, isLoading, isError, error: queryError, refetch } = useQuery(
    ['volunteer-tasks', { skills: selectedSkillFilters, areas: selectedAreaFilters, query: debouncedQuery, availability }],
    async () => {
      const filters = {};
      
      // Apply skill filters
      if (selectedSkillFilters.length > 0) {
        filters.requiredSkills = selectedSkillFilters;
      }
      
      // Apply service area filters
      if (selectedAreaFilters.length > 0) {
        filters.serviceAreaId = selectedAreaFilters[0]; // Simple single-area filter for UI
      }
      
      // Apply availability
      if (availability) {
        filters.availability = availability;
      }
      
      // Apply search query to title/description
      if (debouncedQuery) {
        // We'll filter client-side after receiving results
        filters.titleSearch = debouncedQuery;
      }
      
      return listVolunteerTasks(filters);
    },
    {
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );

  // If we have search query, also filter client-side
  const displayedTasks = useMemo(() => {
    if (!data || !debouncedQuery) return data?.tasks || [];
    
    const query = debouncedQuery.toLowerCase();
    return data.tasks.filter(
      (task) =>
        (task.title && task.title.toLowerCase().includes(query)) ||
        (task.description && task.description.toLowerCase().includes(query)) ||
        (task.category && task.category.toLowerCase().includes(query))
    );
  }, [data, debouncedQuery]);

  // Handle skill selection
  const handleSkillSelect = (skillId) => {
    setSelectedSkillFilters((prev) => {
      if (prev.includes(skillId)) return prev.filter((s) => s !== skillId);
      return [...prev, skillId];
    });
  };

  // Handle area selection
  const handleAreaSelect = (areaId) => {
    setSelectedAreaFilters((prev) => {
      if (prev.includes(areaId)) return prev.filter((a) => a !== areaId);
      return [...prev, areaId];
    });
  };

  // Apply filters and refetch
  const applyFilters = useCallback(() => {
    refetch();
  }, [refetch]);

  // If there's an error
  if (isError) {
    return (
      <section className="p-6">
        <p className="text-red-600">{t('volunteer:taskDiscovery.error', { error: (queryError || {}).message || 'Unknown error' })}</p>
        <button onClick={refetch} className="mt-2 btn-primary">
          {t('common:retry')}
        </button>
      </section>
    );
  }

  // Loading state
  if (isLoading && !data) {
    return (
      <section className="p-6">
        <p className="text-primary-600">{t('common:loading')}</p>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">
        {t('volunteer:taskDiscovery.title')}
      </h2>

      {/* Filters section */}
      <div className="mb-6 p-4 rounded bg-gray-50 border border-gray-200">
        <h3 className="text-sm font-medium mb-4">{t('volunteer:taskDiscovery.filters')}</h3>
        
        {/* Skills filter */}
        <div className="mb-3">
          <label htmlFor="skills-filter" className="block text-sm font-medium mb-2">
            {t('volunteer:taskDiscovery.filterBySkills')}
          </label>
          <div className="grid grid-cols-2 gap-1">
            {SKILL_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`relative flex items-center px-2 py-1 rounded border ${
                  selectedSkillFilters.includes(option.value)
                    ? 'border-primary-600 bg-primary-100 text-primary-600'
                    : 'border-transparent hover:border-gray-300'}
              }>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={selectedSkillFilters.includes(option.value)}
                  onChange={() => handleSkillSelect(option.value)}
                  className="peer cursor-pointer rounded accent-primary-600 peer-inside"
                  aria-label={option.label}
                />
                <span className="text-sm ml-1">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('volunteer:taskDiscovery.filterBySkills.help')}
          </p>
        </div>

        {/* Service Areas filter */}
        <div className="mb-3">
          <label htmlFor="areas-filter" className="block text-sm font-medium mb-2">
            {t('volunteer:taskDiscovery.filterByAreas')}
          </label>
          <div className="grid grid-cols-2 gap-1">
            {SERVICE_AREA_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`relative flex items-center px-2 py-1 rounded border ${
                  selectedAreaFilters.includes(option.value)
                    ? 'border-primary-600 bg-primary-100 text-primary-600'
                    : 'border-transparent hover:border-gray-300'}
              }>
                <input
                  type="checkbox"
                  value={option.value}
                  checked={selectedAreaFilters.includes(option.value)}
                  onChange={() => handleAreaSelect(option.value)}
                  className="peer cursor-pointer rounded accent-primary-600 peer-inside"
                  aria-label={option.label}
                />
                <span className="text-sm ml-1">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t('volunteer:taskDiscovery.filterByAreas.help')}
          </p>
        </div>

        {/* Availability filter */}
        <div className="mb-3">
          <label htmlFor="availability-filter" className="block text-sm font-medium mb-2">
            {t('volunteer:taskDiscovery.filterByAvailability')}
          </label>
          <select
            id="availability-filter"
            onChange={(e) => setAvailability(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
          >
            <option value="" disabled>{t('volunteer:taskDiscovery.availability.select')}</option>
            <option value="weekdays">{t('volunteer:taskDiscovery.availability.weekdays')}</option>
            <option value="weekends">{t('volunteer:taskDiscovery.availability.weekends')}</option>
            <option value="flexible">{t('volunteer:taskDiscovery.availability.flexible')}</option>
            <option value="evenings">{t('volunteer:taskDiscovery.availability.evenings')}</option>
          </select>
        </div>

        {/* Search */}
        <div className="mb-3">
          <label htmlFor="search-query" className="block text-sm font-medium mb-2">
            {t('volunteer:taskDiscovery.search')}
          </label>
          <input
            id="search-query"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600"
            placeholder={t('volunteer:taskDiscovery.search.placeholder')}
            aria-label={t('volunteer:taskDiscovery.search.placeholder')}
          />
        </div>

        <button
          onClick={applyFilters}
          disabled={isLoading}
          className="mt-3 w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? t('common:submitting') : t('volunteer:taskDiscovery.applyFilters')}
        </button>
      </div>

      {/* Tasks list */}
      <div>
        {isLoading && !data && (
          <p className="text-primary-600">{t('common:loading')}</p>
        )}

        {displayedTasks.length === 0 && !isLoading && (
          <div className="p-6 text-center text-gray-500">
            <p>{t('volunteer:taskDiscovery.noTasks')}</p>
          </div>
        )}

        {displayedTasks.map((task) => (
          <div
            key={task.id}
            className="p-4 rounded border border-gray-200 mb-3 hover:border-primary-300 transition-colors"
          >
            <h3 className="text-lg font-medium mb-2">
              {task.title}
            </h3>
            <p className="text-sm text-gray-600 mb-3 line-clamp-3">
              {task.description}
            </p>

            <div className="flex flex-col sm:flex-row items-start items-center gap-2">
              {/* Priority */}
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                PRIORITY_LABELS[task.priority] ? `text-${PRIORITY_LABELS[task.priority].split('-')[1] || 'gray'}-600 bg-${PRIORITY_LABELS[task.priority] || 'gray'}-100` : ''
              }`}
                aria-label={t(`volunteer:task.priority.${task.priority}`, { defaultValue: task.priority })}>
                {t(`volunteer:task.priority.${task.priority}`, { defaultValue: task.priority })}
              </span>

              {/* Status */}
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                STATUS_LABELS[task.publicationState] ? `text-${STATUS_LABELS[task.publicationState].split('-')[1] || 'gray'}-600 bg-${STATUS_LABELS[task.publicationState] || 'gray'}-100` : ''
              }`}
                aria-label={t(`volunteer:task.status.${task.publicationState}`, { defaultValue: task.publicationState })}>
                {t(`volunteer:task.status.${task.publicationState}`, { defaultValue: task.publicationState })}
              </span>
            </div>

            {/* Match score and CTA */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <button
                onClick={() => navigate(`/volunteer/task/${task.id}/apply}`, { replace: true })
                className="w-full py-2 px-4 border border-primary-600 rounded-md shadow-sm text-sm font-medium text-primary-600 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2">
                {t('volunteer:taskDiscovery.apply')}
              </button>
            </div>
          </div>
        ))}

        {/* Pagination (simplified) */}
        {data && data.totalPages > 1 && (
          <nav className="mt-6">
            <ul className="flex justify-between items-center">
              <li>
                <button className="prev-arrow opacity-50 cursor-not-allowed">
                  ← {t('common:previous')}
                </button>
              </li>
              <li>
                <span className="current-page">
                  {data.page} of {data.totalPages}
                </span>
              </li>
              <li>
                <button className="next-arrow">
                  {t('common:next')} →
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
};

// Helper hook for debouncing
const useMemo = require('react').useMemo;

export default TaskDiscovery;