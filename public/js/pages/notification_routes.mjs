export function resolveNotificationTarget(relatedType, relatedId, courseId) {
  if ((relatedType === 'post' || relatedType === 'material') && courseId) {
    return { page: 'course-detail', data: courseId };
  }

  if (relatedType === 'invite') {
    return { page: 'explore', data: { tab: 'invites', inviteId: relatedId || 0 } };
  }

  if (relatedType === 'square_post' && relatedId) {
    return { page: 'square-post', data: relatedId };
  }

  if (relatedType === 'user' && relatedId) {
    return { page: 'profile-user', data: relatedId };
  }

  return null;
}
