# FeltLab Firestore Security Specification

## 1. Data Invariants

1. **Identity Isolation**: Every `/users/{userId}` document and `/users/{userId}/attempts/{attemptId}` document is strictly private to the authenticated, email-verified user whose `request.auth.uid == userId`.
2. **Master Gate Enforcement**: A `DrillAttempt` under `/users/{userId}/attempts/{attemptId}` cannot be read (single `get`), created, or deleted unless the parent `/users/{userId}` profile exists and its stored `uid` equals `request.auth.uid`.
3. **Zero PII Exposure**: No email, phone number, or address is persisted to Firestore documents; profiles contain only a bounded display name, UI preferences, and mastery counters.
4. **Strict Schema & Size Boundaries**: Every write validates required and allowed keys (`hasAll` + `hasOnly`), exact field types, numeric bounds, enum allowlists, and string `.size()` limits to prevent shadow fields and resource exhaustion.
5. **Immutability & Temporal Integrity**: `uid` and `createdAt` are immutable after creation; `createdAt` must equal `request.time` on creation and `updatedAt` must equal `request.time` on updates.
6. **Secure List Queries**: `allow list` on `/users/{userId}/attempts/{attemptId}` enforces `resource.data.uid == request.auth.uid && userId == request.auth.uid` without using `get()` lookups.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Be Denied)

1. **Unauthenticated Profile Create**: `auth = null` attempting to write `/users/u1`.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` creating `/users/u1`.
3. **Cross-Tenant Profile Read**: User `u2` attempting `get` on `/users/u1`.
4. **UID Spoofing on Create**: User `u1` creating `/users/u1` with `{ uid: "u2" }`.
5. **Shadow Field Injection on Profile Create**: User `u1` adding `{ isAdmin: true }` to `/users/u1`.
6. **Oversized Document ID Poisoning**: Creating `/users/u1/attempts/<200-char-invalid-id>`.
7. **Oversized String Exhaustion**: Creating an attempt with `spotLabel` length > 120 characters.
8. **Invalid Enum Module / Grade**: Creating an attempt with `module: "hacked"` or `grade: "Godlike"`.
9. **Client Timestamp Forgery**: Creating a profile with `createdAt` set to a past client timestamp instead of `request.time`.
10. **Immutable Field Tampering on Update**: User `u1` modifying `createdAt` or `uid` on `/users/u1`.
11. **Negative / Out-of-Range EV Loss**: Creating an attempt with `evLossBb: -5` or `accuracyScore: 150`.
12. **Orphaned Attempt Write**: User `u1` writing `/users/u1/attempts/a1` when parent `/users/u1` does not exist.
