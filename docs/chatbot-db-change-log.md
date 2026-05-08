# Chatbot Database Change Log

Date: 2026-04-22
Scope: In-app assistant (rule-based + optional ChatGPT fallback)

## Previous Database State
- Existing project schema and data were used as-is.
- Core read sources used by chatbot:
  - `posts`
  - `tours`
  - `activities`
  - `events`
  - `bookings`
  - `favorites`
  - `profiles`

## New Database State
- No schema changes applied.
- No data mutations applied.
- Chatbot currently runs only read operations against existing tables.

## Comparison Summary
- Previous schema/data: unchanged
- New schema/data: unchanged
- Delta: none

## Revert Plan
- No rollback needed because no database write or migration was introduced.

