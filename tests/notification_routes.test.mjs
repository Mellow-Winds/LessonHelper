import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveNotificationTarget } from '../public/js/pages/notification_routes.mjs';

test('course post notifications navigate to the course detail page', () => {
  assert.deepEqual(resolveNotificationTarget('post', 31, 7), {
    page: 'course-detail',
    data: 7,
  });
});

test('invite notifications navigate to explore', () => {
  assert.deepEqual(resolveNotificationTarget('invite', 31, 0), {
    page: 'explore',
    data: { tab: 'invites', inviteId: 31 },
  });
});

test('material notifications navigate to the course detail page', () => {
  assert.deepEqual(resolveNotificationTarget('material', 31, 7), {
    page: 'course-detail',
    data: 7,
  });
});

test('square post notifications navigate to the square post detail page', () => {
  assert.deepEqual(resolveNotificationTarget('square_post', 31, 0), {
    page: 'square-post',
    data: 31,
  });
});

test('new follower notifications navigate to the follower profile', () => {
  assert.deepEqual(resolveNotificationTarget('user', 7, 0), {
    page: 'profile-user',
    data: 7,
  });
});
