# `src/domain/privacy/privacy.ts`

This module defines planning, private, and restricted privacy levels and prevents an AI suggestion from reducing protection.

## `PrivacyLevelSchema`

`PrivacyLevelSchema` allows the three stored privacy levels.

## `doesNotReducePrivacy`

`doesNotReducePrivacy` checks whether a proposed level is as private as the current one.

## `resolvePrivacy`

`resolvePrivacy` keeps the current privacy level when an AI suggests a lower one. It never approves sharing.
