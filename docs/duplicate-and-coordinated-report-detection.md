# Duplicate and Coordinated Civic Report Detection Pipeline

This document specifies the technical design, privacy-preserving geospatial clustering, burst monitoring, and human moderator controls for civic report processing in Civic Help Setu.

## Problem Statement
When municipal infrastructure fails (e.g. broken water mains, hazardous potholes, uncollected waste, downed power cables), dozens of concerned citizens often submit independent complaints regarding the same asset.

Manual deduplication is labor-intensive, yet naive automated merging risks:
1. Deleting independent photographic evidence or differing severity perspectives.
2. Exposing citizens' exact home GPS coordinates in public deduplication lists.
3. Falsely mischaracterizing high-volume community reporting as malicious spam or "coordinated attacks".

## Architectural Pipeline

```
     [ Incoming Civic Issues / Grievance Reports ]
                           │
                           ▼
     +-----------------------------------------------------------+
     |             Privacy Geospatial Bucketer                   |
     |  - Converts exact GPS to ~500m grid cell                  |
     |  - Never reveals exact user residential coordinates       |
     +-----------------------------+-----------------------------+
                                   │
                                   ▼
     +-----------------------------------------------------------+
     |             Multi-Factor Similarity Scorer                |
     |  - Category alignment                                     |
     |  - Geospatial bucket proximity                            |
     |  - Temporal window overlap (default: 72 hours)            |
     |  - Jaccard token text similarity                          |
     +-----------------------------+-----------------------------+
                                   │
                                   ▼
     +-----------------------------------------------------------+
     |              Moderator Recommendation Dashboard           |
     |  - Suggests merge clusters with interpretable reasons     |
     |  - All original reports preserved with independent IDs    |
     |  - Zero automatic irreversible deletions                  |
     +-----------------------------+-----------------------------+
                                   │
                                   ▼
     +-----------------------------------------------------------+
     |              Reversible Moderator Merge Engine            |
     |  - Human confirms or rejects merge                        |
     |  - Split / Unmerge fully supported if error discovered    |
     +-----------------------------------------------------------+
```

## Community Protection Guarantees
- **No Automatic Deletion**: Reports are grouped for administrative triage, but original report IDs, timestamps, and citizen progress trackers remain permanently intact.
- **Non-Punitive Burst Detection**: Unusually rapid reporting is reported as "elevated community activity" or widespread infrastructure failure, rather than accusations of fraud.
- **Complete Reversibility**: Any merge action can be undone by an authorized moderator with reason logging.
