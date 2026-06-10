export function resolveNotificationTarget(relatedType, relatedId, courseId, relatedCommentId = 0) {
  if ((relatedType === 'post' || relatedType === 'material') && courseId) {
    return { page: 'course-detail', data: courseId };
  }

  if (relatedType === 'invite') {
    return { page: 'explore', data: { tab: 'invites', inviteId: relatedId || 0 } };
  }

  if (relatedType === 'square_post' && relatedId) {
    return { page: 'square-post', data: relatedId };
  }

  if (relatedType === 'explore_post' && relatedId) {
    return {
      page: 'explore-post-detail',
      data: relatedCommentId ? { id: relatedId, commentId: relatedCommentId } : relatedId
    };
  }

  if (relatedType === 'course_square_post' && courseId) {
    return { page: 'course-detail', data: courseId };
  }

  if (relatedType === 'user' && relatedId) {
    return { page: 'profile-user', data: relatedId };
  }

  if (relatedType === 'card' && relatedId) {
    // 卡片通知：回退到发现页，后续可通过卡片→帖子反查优化
    return { page: 'explore', data: null };
  }

  return null;
}
