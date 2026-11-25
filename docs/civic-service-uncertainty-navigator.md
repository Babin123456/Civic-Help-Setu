# Agentic Civic Service Navigator with Explicit Uncertainty Routing

## Purpose
Citizens querying public services often ask vague questions ("How do I apply for certificate?") or queries with contradictory jurisdictional cues.

Rather than guessing or returning hallucinated advice, this service employs **Explicit Uncertainty Routing**:
1. **Ambiguity Gate**: Short or jurisdiction-less requests trigger structured clarifying questions.
2. **Uncertainty Quantification**: Calculates confidence scores based on keyword and geographic alignment.
3. **Graceful Fallback & Human Escalation**: Automatically routes ambiguous requests to help desk escalations instead of presenting false certitude.
