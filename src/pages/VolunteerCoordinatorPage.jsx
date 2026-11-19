// Volunteer Coordination Dashboard
// -------------------------------
// Main entry point for the verified civic volunteer coordination and
// skill-matching network. Supports both volunteer and coordinator roles.

import { useState, useEffect } from 'react';
import { useTranslation, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNetwork } from '@/context/NetworkContext';
import { logDiagnostic } from '@/utils/diagnostics';

import Navbar from '@/components/Navbar';
import VolunteerRegistrationForm from '@/components/volunteer/VolunteerRegistrationForm';
import TaskDiscovery from '@/components/volunteer/TaskDiscovery';
import { useVolunteerProfile } from '@/hooks/useVolunteerProfile';
import { skillsService } from '@/services/skillService';

// Page component
const VolunteerCoordinatorPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isOnline } = useNetwork();

  // If user is not signed in, redirect to login
  if (!user) {
    return navigate('/login');
  }

  // Determine user role
  const userRole = user.role || 'citizen';
  const isCoordinator = userRole === 'operator' || userRole === 'admin';

  // Fetch volunteer profile if available
  const { data: profileData, isLoading, refetch } = useQuery(
    ['volunteer-profile', user.id],
    async () => {
      // In a full implementation, we'd fetch from the volunteer profile service
      // For now, return null to show the registration flow
      return null;
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // Check if profile exists
  const hasProfile = profileData !== null && profileData !== undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-6">
        {/* Role-based content */}
        {isCoordinator ? (
          <CoordinatorDashboard />
        ) : (
          <VolunteerDashboard />
        )}

        {/* Cross-role section: If no profile, show registration */}
        {!hasProfile && !isCoordinator && (
          <div className="mt-8 p-6 rounded bg-card border border-border">
            <h2 className="text-xl font-bold mb-4">
              {t('volunteer:dashboard.registerTitle')}
            </h2>
            <p className="text-muted-large text-body-muted mb-6">
              {t('volunteer:dashboard.registerSubtitle')}
            </p>
            <VolunteerRegistrationForm />
          </div>
        )}
      </main>
    </div>
  );
};

// Volunteer Dashboard component
const VolunteerDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <section className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {t('volunteer:dashboard.title', { name: user.fullName || user.username })}
      </h1>

      <p className="text-body-muted mb-6">
        {t('volunteer:dashboard.welcome', { name: user.fullName || user.username })}
      </p>

      {/* My Skills Section */}
      <div className="mb-6 p-4 rounded bg-card border border-border">
        <h3 className="text-sm font-medium mb-3">
          {t('volunteer:dashboard.mySkills')}
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {/* Skills displayed as chips */}
          {user.skills && user.skills.length > 0 ? (
            user.skills.map((skillId) => {
              const skillName = skillsService
                ? skillsService.readSkill(skillId)?.name || skillId
                : skillId;
              return (
                <span
                  key={skillId}
                  className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border border-border bg-border-soft"
                >
                  {skillName}
                </span>
              );
            })
          ) : (
            <p className="text-sm text-muted-extra">
              {t('volunteer:dashboard.noSkills')}
            </p>
          )}
        </div>
      </div>

      {/* Available Tasks Section */}
      <div>
        <h3 className="text-sm font-medium mb-3">
          {t('volunteer:dashboard.availableTasks')}
        </h3>

        <p className="text-caption text-muted-extra mb-3">
          {t('volunteer:dashboard.discoverTasks')}
        </p>

        {/* Task discovery form */}
        <TaskDiscovery />
      </div>
    </section>
  );
};

// Coordinator Dashboard component
const CoordinatorDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <section className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {t('volunteer:coordinator.dashboardTitle', { name: user.fullName })}
      </h1>

      <p className="text-body-muted mb-6">
        {t('volunteer:coordinator.dashboardSubtitle')}
      </p>

      {/* Published Tasks Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Task stats cards would go here */}
        {/* In a full implementation, we'd fetch task counts from the service */}
      </div>

      {/* New Task Post Form */}
      <div className="p-6 rounded bg-card border border-border mb-8">
        <h3 className="text-sm font-medium mb-4">
          {t('volunteer:coordinator.newTask')}
        </h3>

        {/* Task creation form would go here */}
        <p className="text-caption text-muted-extra">
          {t('volunteer:coordinator.newTaskHelp')}
        </p>
      </div>

      {/* Recent Applications */}
      <div>
        <h3 className="text-sm font-medium mb-3">
          {t('volunteer:coordinator.recentApplications')}
        </h3>

        {/* Applications list would go here */}
        {user.role === 'admin' && (
          <p className="text-caption text-muted-extra">
            {t('volunteer:coordinator.noApplicationsYet')}
          </p>
        )}
      </div>
    </section>
  );
};

export default VolunteerCoordinatorPage;