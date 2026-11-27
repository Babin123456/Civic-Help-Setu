# Reusable Workflow Engine for Cross-Department Civic Processes

## Overview
Civic processes (such as multi-agency road cutting permits, commercial building occupancy clearances, and pension transfers) traverse multiple departments (Police, Municipal Ward, Water Supply, Fire).

## Core Capabilities
1. **Pinned Versioned Definitions**:
   - Workflows pin the definition version (e.g. `1.0.0`) at creation so deployment updates do not disrupt in-flight cases.
2. **Role-Based Task Assignment & State Guards**:
   - Rejects illegal state jumping. Transitions verify actor principal roles (`ward_officer`, `traffic_police_inspector`, etc.).
3. **Automated SLA Deadlines & Escalation**:
   - Calculates hours-based SLAs per state and flags stalled cases for executive intervention.
4. **Audit Trail Continuity**:
   - Complete history of state transitions, acting principals, and payload changes stored for statutory audit.
