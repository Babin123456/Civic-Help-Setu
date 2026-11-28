# Citizen-Facing Service Journey Recovery and Resume Checkpoint System

## Purpose
Guarantees resilient workflow recovery for multi-step citizen applications across interrupted sessions, device handoffs, and external portal transitions.

## Key Capabilities
- **Status Stage Demarcation**: Transparently distinguishes `DRAFT`, `PREPARED`, `SUBMITTED_EXTERNALLY`, and `CONFIRMED` states.
- **Privacy Hardening**: Strips passwords, PINs, and raw Aadhaar attributes prior to local or cloud checkpoint serialization.
- **Stale Checkpoint Detection**: Alerts citizens when saved applications exceed statutory expiration periods or policy update windows.
