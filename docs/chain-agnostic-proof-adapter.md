# Chain-Agnostic Proof Adapter and Local Verification Sandbox

## Overview
This service provides an extensible, ledger-agnostic abstraction layer for anchoring cryptographic commitments and verifying timestamped proofs without binding Civic Help Setu to any proprietary blockchain vendor.

## Architecture
- **BaseProofAdapter**: Abstract adapter class defining standard `anchor`, `verify`, and `getStatus` contracts.
- **InMemoryProofAdapter**: Fast, deterministic local proof sandbox for automated testing and air-gapped deployments.
- **MockEvmTestnetAdapter**: Emulates public or consortium EVM L2 testnets with transaction receipt verification.
- **ChainAgnosticProofService**: Verification hub and policy enforcement engine.

## Strict PII & Payload Validation Rules
- **No Raw Data or PII Allowed**: The adapter strictly verifies that payloads match standard 64-character SHA-256 hexadecimal digests. Any raw text, citizen details, or non-hex payloads are instantly rejected with `PROHIBITED_RAW_PAYLOAD`.
- **Feature Flag Control**: Ledgers and anchoring operations can be dynamically toggled off via feature flag without impacting dependent reading services.
