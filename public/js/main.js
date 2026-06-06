/**
 * main.js — 全局唯一入口
 * 负责：i18n初始化 + 模块导入 + 跨层函数 + 全局函数注册 + DOMContentLoaded
 */

/* =============================================
   i18n Language Foundation（必须在任何模块渲染前执行）
   ============================================= */

window.i18nDict = {
  zh: {
    app_name: '课搭子',
    courses: '课程列表',
    profile: '个人中心',
    import_schedule: '导入课程表',
    select_existing: '选择已有课程',
    search: '搜索',
    login: '登录',
    register: '注册',
    email: '邮箱',
    password: '密码',
    password_min: '密码（至少6位）',
    nickname: '昵称',
    major: '专业',
    grade: '年级',
    verify_code: '验证码',
    course_id: '课程号',
    course_name: '课程名称',
    teacher: '教师',
    all_time: '全部时间',
    all_semester: '全部学期',
    title: '标题',
    content: '内容',
    save: '保存',
    publish: '发布',
    logout: '退出登录',
    edit_profile: '编辑资料',
  },
  en: {
    app_name: 'EduSpace',
    courses: 'Courses',
    profile: 'Profile',
    import_schedule: 'Import Schedule',
    select_existing: 'Select Course',
    search: 'Search',
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    password_min: 'Password (min 6)',
    nickname: 'Nickname',
    major: 'Major',
    grade: 'Grade',
    verify_code: 'Verification Code',
    course_id: 'Course ID',
    course_name: 'Course Name',
    teacher: 'Teacher',
    all_time: 'All Time',
    all_semester: 'All Semesters',
    title: 'Title',
    content: 'Content',
    save: 'Save',
    publish: 'Publish',
    logout: 'Logout',
    edit_profile: 'Edit Profile',
  },
};

window.currentLang = localStorage.getItem('lang') || 'zh';

window.t = function(key) {
  return (window.i18nDict[window.currentLang] && window.i18nDict[window.currentLang][key]) || key;
};

/* =============================================
   Import 核心模块
   ============================================= */

import { apiGet, isLoggedIn, clearToken } from './core/api.js';
import { navigateTo, initRouter, pages, registerPage } from './core/router.js';
import { showToast } from './components/ui.js';

/* =============================================
   Import 页面模块（触发 registerPage + 模块初始化）
   ============================================= */

import {
  switchAuthView, handleLogin, handleRegister, handleSendCode, handleResendCode,
  refreshNotifBadge,
  handleSearchPageKey, executeSearch, switchSearchTab, navigateToCourseResult,
} from './pages/auth.js';

import {
  registerProfilePages,
  openEditProfileModal, handleEditProfile, handlePrivacyChange,
  handleCheckin, handleSaveProfile, handlePrivacyToggle, showFeedbackModal,
} from './pages/profile.js';

import './pages/my_posts.js';
import './pages/notifications.js';
import {
  toggleCourseFavorite, togglePostFavorite,
} from './pages/favorites.js';

import {
  handleLeaveCourse, openCourseSearchModal, doCourseSearch, handleEnrollFromSearch,
  openImportModal, handleAgreeAndImport, handleScheduleImport,
  handlePortalToPlaza,
  openMoveSemesterModal, handleMoveSemester,
} from './pages/courses/my_courses.js';

import {
  filterPlazaCourses, navigateToPlazaCourseById,
} from './pages/courses/all_courses.js';

import {
  showPublishBlockedToast, switchDetailTab, toggleComments, handleAddComment,
  refreshMyMaterials, rateMyMaterial, deleteMyMaterial,
  openUploadMaterialModal, onFileSelected, handleUploadMaterial,
  // forum stream architecture
  toggleForumLike, openForumInlineEditor, submitForumReply,
  autoResizeForumTextarea, handleForumReplyImageChange, removeForumReplyImage,
  toggleForumReplies, focusForumCompose, openForumCompose, closeForumCompose,
  handleForumComposeImageChange, removeForumComposeImage, submitForumPost,
} from './pages/courses/detail.js';

import {
  onPublishFileSelected,
} from './pages/courses/publish.js';

import './pages/explore.js';
import './pages/post-editor.js';
import {
  refreshInvites, respondInvite, cancelInvite,
  switchMyTab,
} from './pages/explore/invites.js';
import {
  refreshSquarePosts,
  submitSquareInterest, handleSquareInterest,
  switchSquareMyTab,
} from './pages/explore/square.js';

/* =============================================
   注册 Profile 子页面（必须在路由初始化前完成）
   ============================================= */

registerProfilePages(registerPage);

/* =============================================
   跨层桥接函数（同时依赖 api + ui + router，无法归属单一模块）
   ============================================= */

window._currentUser = null;

async function loadCurrentUser() {
  if (!isLoggedIn()) return null;
  try {
    const user = await apiGet('/api/auth/me');
    if (user && !user.error) {
      window._currentUser = user;
      return user;
    }
    clearToken();
    return null;
  } catch {
    clearToken();
    return null;
  }
}

function logout() {
  clearToken();
  window._currentUser = null;
  navigateTo('profile');
  showToast('已退出登录');
}

function updateSidebarAvatar() {
  const el = document.getElementById('sidebar-avatar');
  if (!el) return;
  const user = window._currentUser;
  if (user?.avatar_url) {
    const img = document.createElement('img');
    img.src = user.avatar_url;
    img.alt = user.nickname || '头像';
    img.className = 'sidebar-avatar-img';
    el.replaceWith(img);
  }
}

// 挂载到 window 供页面模块和 HTML 内联事件使用
window.loadCurrentUser = loadCurrentUser;
window.logout = logout;
window.navigateTo = navigateTo;
window.showToast = showToast;

/* =============================================
   全局函数注册（供 HTML 内联 onclick/onsubmit 使用）
   ============================================= */

Object.assign(window, {
  // auth
  switchAuthView,
  handleLogin,
  handleRegister,
  handleSendCode,
  handleResendCode,
  // notifications
  refreshNotifBadge,
  // search
  handleSearchPageKey,
  executeSearch,
  switchSearchTab,
  navigateToCourseResult,
  toggleCourseFavorite,
  togglePostFavorite,
  // profile
  openEditProfileModal,
  handleEditProfile,
  handlePrivacyChange,
  handleCheckin,
  handleSaveProfile,
  handlePrivacyToggle,
  showFeedbackModal,
  // my courses (list only)
  handleLeaveCourse,
  openCourseSearchModal,
  doCourseSearch,
  handleEnrollFromSearch,
  openImportModal,
  handleAgreeAndImport,
  handleScheduleImport,
  openMoveSemesterModal,
  handleMoveSemester,
  // all courses (plaza search)
  filterPlazaCourses,
  navigateToPlazaCourseById,
  // course detail (unified)
  showPublishBlockedToast,
  switchDetailTab,
  toggleComments,
  handleAddComment,
  refreshMyMaterials,
  rateMyMaterial,
  deleteMyMaterial,
  openUploadMaterialModal,
  onFileSelected,
  handleUploadMaterial,
  // forum stream architecture
  toggleForumLike,
  openForumInlineEditor,
  submitForumReply,
  autoResizeForumTextarea,
  handleForumReplyImageChange,
  removeForumReplyImage,
  toggleForumReplies,
  focusForumCompose,
  openForumCompose,
  closeForumCompose,
  handleForumComposeImageChange,
  removeForumComposeImage,
  submitForumPost,
  // publish
  onPublishFileSelected,
  // my course detail extras
  handlePortalToPlaza,
  // explore (new card system — no exported functions needed)
  // invites
  refreshInvites,
  respondInvite,
  cancelInvite,
  switchMyTab,
  // square
  refreshSquarePosts,
  submitSquareInterest,
  handleSquareInterest,
  switchSquareMyTab,
});

/* =============================================
   DOMContentLoaded — 应用启动
   ============================================= */

document.addEventListener('DOMContentLoaded', async () => {
  // 加载当前用户
  await loadCurrentUser();

  // 更新侧边栏头像
  updateSidebarAvatar();

  // 绑定侧边栏导航（点击时同步更新URL）
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  // 初始化路由系统：解析URL → 导航到对应页面
  initRouter(() => navigateTo('mycourse'));

  // 启动通知轮询
  if (window._currentUser) {
    refreshNotifBadge();
    if (!window._notifInterval) window._notifInterval = setInterval(refreshNotifBadge, 30000);
  }
});
