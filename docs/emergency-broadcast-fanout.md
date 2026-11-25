# Multi-Channel Emergency Broadcast Fan-Out with Geographic Targeting

## Purpose
During public safety emergencies (flash floods, urban fires, gas leaks, structural collapses), municipal authorities need to deliver rapid, geofenced alerts across multiple citizen channels (SMS, WebPush, WhatsApp, Voice) without spamming out-of-boundary residents.

## Architecture
1. **Geofenced Targeting**:
   - Matches recipients strictly by district, ward, or geographic polygon.
2. **Channel Redundancy & Deduplication**:
   - Fans out across SMS, WebPush, and Voice channels with deduplication keys preventing alert duplicate storms.
3. **Multilingual Content Variants**:
   - Evaluates citizen language preferences (`en`, `hi`, `kn`, etc.) and dispatches localized alerts.
4. **Legal Opt-Out Rules**:
   - Respects opt-out preferences on non-critical `ADVISORY` messages while overriding on `SEVERE_EMERGENCY` public safety alerts.
