# Auth Invites Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix password visibility, add password reset, make study invite capacity and approval configurable, repair notification navigation, and make contact exchange requests actionable.

**Architecture:** Keep the existing Express routers and static ES modules. Add small migrations in `server.js`, route behavior in `routes/auth.js`, `routes/invites.js`, and `routes/user.js`, and focused UI updates in the existing auth, invite, and notification modules.

**Tech Stack:** Node.js, Express, sql.js, native `node:test`, static browser JavaScript.

---

### Task 1: Backend Regression Tests

**Files:**
- Create: `tests/invites_approval.test.mjs`
- Create: `tests/contact_exchange.test.mjs`
- Modify: `tests/notification_routes.test.mjs`

- [ ] Write tests for invite max capacity, pending approval, accept/reject, and contact exchange notification `related_id`.
- [ ] Run the targeted tests and confirm they fail before production changes.

### Task 2: Auth Reset Tests

**Files:**
- Create: `tests/auth_password_reset.test.mjs`

- [ ] Test requesting a reset code for an existing student account.
- [ ] Test resetting a password with a valid code updates the stored bcrypt hash and allows the new password to match.
- [ ] Run the test and confirm the reset endpoints are missing.

### Task 3: Backend Implementation

**Files:**
- Modify: `server.js`
- Modify: `routes/auth.js`
- Modify: `routes/invites.js`
- Modify: `routes/user.js`

- [ ] Add `study_invites.approval_required`.
- [ ] Add password reset request and confirm endpoints.
- [ ] Add invite approval behavior and creator review endpoints.
- [ ] Fix invite capacity comparisons to count accepted responses directly.
- [ ] Fix contact exchange notifications to reference the request id.

### Task 4: Frontend Implementation

**Files:**
- Modify: `public/js/pages/auth.js`
- Modify: `public/js/pages/explore/invites.js`
- Modify: `public/js/pages/notification_routes.mjs`
- Modify: `public/js/pages/notifications.js`

- [ ] Make password visibility toggle find the nearest password input reliably.
- [ ] Add forgot password form flow.
- [ ] Add invite publish controls for max participants and approval requirement.
- [ ] Render pending status and creator approval/rejection buttons.
- [ ] Make invite notifications route back to the invite tab and optionally highlight an invite.

### Task 5: Verification

**Files:**
- Run: `npm test`

- [ ] Run all tests.
- [ ] Start the app if tests pass and inspect critical browser flows if practical.
