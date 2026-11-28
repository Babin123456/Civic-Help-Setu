# Passkey and Risk-Based Step-Up Authentication for Sensitive Actions

## Purpose
Introduces phishing-resistant FIDO2 / WebAuthn passkey step-up authentication for high-risk actions such as account recovery, document export, consent revocation, and administrative overrides.

## Key Capabilities
- **Risk Assessment Gate**: Evaluates action sensitivity, device novelty, and network reputation to prompt step-up challenges dynamically.
- **Challenge-Response Assertion**: Validates cryptographically signed WebAuthn assertions with replay protection.
- **Privacy-by-Design**: Authenticator interactions verify assertions client-side; no biometric data ever leaves citizen hardware.
