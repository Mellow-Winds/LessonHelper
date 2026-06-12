/**
 * pages/home.js - Home dashboard
 * Hero + personal status + hot courses + light treasure-box plugins.
 */

import { apiGet, isLoggedIn } from '../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../core/router.js';
import { escHtml } from '../components/ui.js';

const ANSWERS = ['现在就去', '先问问同课同学', '值得一试', '换个角度看', '今天适合行动'];
const PLUGIN_ICON = {
  luck: '<svg viewBox="0 0 24 24"><path d="M8 17.5a4.5 4.5 0 0 1 0-9 5.7 5.7 0 0 1 11 2.1A3.7 3.7 0 0 1 18.2 18H8Z"/><path d="m14 4 1.2-2.2M18.8 6.4 21 5.2M4.8 19.2 3 21"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><path d="M9 2h6M12 6a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z"/><path d="M12 10v4l2.5 1.5"/></svg>',
  todo: '<svg viewBox="0 0 24 24"><path d="M6 5h12a2 2 0 0 1 2 2v12l-4-2-4 2-4-2-4 2V7a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 13h5"/></svg>',
  dice: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Z"/><path d="M5 4.5v17M9 7h7"/></svg>',
  fish: '<svg viewBox="0 0 24 24"><path d="M4 12s3.2-5 8.5-5c4.8 0 7.5 5 7.5 5s-2.7 5-7.5 5C7.2 17 4 12 4 12Z"/><path d="M4 12 2 8v8l2-4ZM15 10h.01"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 7 10 17l-5-5"/><circle cx="12" cy="12" r="9"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/><path d="m12 11 1.1 2.2 2.4.3-1.7 1.7.4 2.3-2.2-1.1-2.2 1.1.4-2.3-1.7-1.7 2.4-.3L12 11Z"/></svg>',
  paper: '<svg viewBox="0 0 24 24"><path d="M3 12 21 3l-5 18-4-7-9-2Z"/><path d="m12 14 4-4"/></svg>',
};

function todayWeekdayText() {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()];
}

function countTodayCourses(courses) {
  const weekday = todayWeekdayText();
  return courses.filter(course => {
    const text = `${course.title || ''} ${course.description || ''} ${course.teacher || ''}`;
    return text.includes(weekday);
  }).length;
}

function pickDaily(list, salt = '') {
  const date = new Date().toISOString().slice(0, 10);
  const key = `${date}_${window._currentUser?.id || 'guest'}_${salt}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
  return list[Math.abs(hash) % list.length];
}

function avatarDataUri(seed, index) {
  const palettes = [
    ['#dbeafe', '#6366f1', '#312e81'],
    ['#ffedd5', '#f97316', '#7c2d12'],
    ['#dcfce7', '#16a34a', '#14532d'],
    ['#fce7f3', '#db2777', '#831843'],
    ['#ede9fe', '#7c3aed', '#3b0764'],
  ];
  const [bg, shirt, ink] = palettes[index % palettes.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="24" fill="${bg}"/>
      <circle cx="24" cy="19" r="8" fill="#fff7ed"/>
      <path d="M12 43c1.6-8.2 6-12.4 12-12.4S34.4 34.8 36 43" fill="${shirt}"/>
      <path d="M18 19c1.7 1.2 3.7 1.8 6 1.8s4.3-.6 6-1.8" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M17 16c1.5-5.2 5-7.2 9.6-6.1 3.4.8 5.2 3.1 5.4 6.1-5-.5-8.2-2-9.6-4.5-1 2.4-2.8 3.9-5.4 4.5Z" fill="${ink}" opacity=".9"/>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}#${encodeURIComponent(seed)}`;
}

function renderStatCard(icon, label, value, hint, targetPage) {
  const attr = targetPage ? ` data-jump="${targetPage}"` : '';
  return `
    <button class="home-stat-card"${attr}>
      <span class="home-stat-icon">${icon}</span>
      <span class="home-stat-value">${escHtml(String(value))}</span>
      <span class="home-stat-label">${escHtml(label)}</span>
      <span class="home-stat-hint">${escHtml(hint)}</span>
    </button>
  `;
}

function renderHotCourse(course, index) {
  const count = Number(course.enrollment_count || course.totalCount || 0);
  const avatars = [0, 1, 2].map((n) => (
    `<img src="${avatarDataUri(`${course.id || course.title || index}-${n}`, index + n)}" alt="">`
  )).join('');
  return `
    <button class="home-course-card" data-course-id="${course.id}">
      <span class="home-course-rank">${String(index + 1).padStart(2, '0')}</span>
      <span class="home-course-main">
        <strong>${escHtml(course.title || course.name || '未命名课程')}</strong>
        <small>本学期 · ${count} 位同学正在关注</small>
      </span>
      <span class="home-course-avatars" aria-hidden="true">${avatars}</span>
      <span class="home-course-action">查看</span>
    </button>
  `;
}

function renderEmptyHotCourses() {
  return `
    <div class="home-empty-card">
      <strong>课程广场正在等待第一批课程</strong>
      <span>导入课表后，这里会展示大家正在看的热门课程。</span>
    </div>
  `;
}

function renderHomeShell(container) {
  const name = window._currentUser?.nickname || '同学';
  container.innerHTML = `
    <div class="home-page">
      <section class="home-hero">
        <div class="home-hero-bg" aria-hidden="true"></div>
        <div class="home-hero-content">
          <h1><span>选一门课，</span><span>也遇见一群人。</span></h1>
          <p>在课搭子里找到同课同学、课程资料、学习邀约<br>和校园里的小小连接。</p>
          <div class="home-hero-actions">
            <button class="btn btn-primary" data-jump="mycourse">进入我的课程</button>
            <button class="btn btn-secondary" data-jump="allcourse">逛逛课程广场</button>
          </div>
        </div>
      </section>

      <section class="home-stat-grid" id="home-stat-grid">
        ${renderStatCard(PLUGIN_ICON.calendar, '今日课程', '--', '正在读取', 'mycourse')}
        ${renderStatCard(PLUGIN_ICON.check, '连续签到天数', '--', '保持节奏', 'profile')}
        ${renderStatCard(PLUGIN_ICON.bell, '通知个数', '--', '新的连接', 'notifications')}
        ${renderStatCard(PLUGIN_ICON.folder, '收藏资料', '--', '常用资料', 'favorites')}
      </section>

      <div class="home-content-grid">
        <section class="home-section">
          <div class="home-section-head">
            <div>
              <span>Course Plaza</span>
              <h2>热门课程</h2>
            </div>
            <button class="home-link-btn" data-jump="allcourse">查看更多</button>
          </div>
          <div class="home-course-list" id="home-hot-courses">
            <div class="home-empty-card">热门课程加载中...</div>
          </div>
        </section>

        <section class="home-section">
          <div class="home-section-head">
            <div>
              <span>Fun Widgets</span>
              <h2>趣味插件</h2>
            </div>
            <button class="home-link-btn" data-jump="treasurebox">全部插件</button>
          </div>
          <div class="home-plugin-grid">
            <button class="home-plugin-card" id="home-luck-card">
              <span class="home-plugin-icon">${PLUGIN_ICON.luck}</span>
              <span class="home-plugin-label">今日运气值</span>
              <strong id="home-luck-value">点击揭晓</strong>
              <small>看看今天的幸运值</small>
            </button>
            <button class="home-plugin-card" data-jump="treasurebox">
              <span class="home-plugin-icon">${PLUGIN_ICON.timer}</span>
              <span class="home-plugin-label">番茄时钟</span>
              <strong>25 分钟</strong>
              <small>沉浸学习，提高效率</small>
            </button>
            <button class="home-plugin-card" data-jump="treasurebox">
              <span class="home-plugin-icon">${PLUGIN_ICON.dice}</span>
              <span class="home-plugin-label">替我抉择</span>
              <strong>抛硬币 / 掷骰子</strong>
              <small>选择困难交给它</small>
            </button>
            <button class="home-plugin-card" data-jump="treasurebox">
              <span class="home-plugin-icon">${PLUGIN_ICON.todo}</span>
              <span class="home-plugin-label">薛定谔的待办</span>
              <strong>今天也许会完成</strong>
              <small>半认真地管理任务</small>
            </button>
            <button class="home-plugin-card" id="home-answer-card">
              <span class="home-plugin-icon">${PLUGIN_ICON.book}</span>
              <span class="home-plugin-label">答案之书</span>
              <strong id="home-answer-value">想一个问题</strong>
              <small>给犹豫一个答案</small>
            </button>
          </div>
          <button class="home-invite-banner" data-jump="explore">
            <span>
              <strong>发布学习邀约</strong>
              <small id="home-quote">寻找学习搭子，一起进步吧！</small>
            </span>
            <b>去发布</b>
          </button>
        </section>
      </div>
    </div>
  `;
}

async function loadHomeData() {
  let courses = [];
  let unread = 0;
  let hotCourses = [];

  if (isLoggedIn()) {
    try { courses = await apiGet('/api/courses'); } catch {}
    try {
      const data = await apiGet('/api/notifications/unread-count');
      unread = Number(data.count || 0);
    } catch {}
  }

  try {
    hotCourses = await apiGet('/api/courses/all');
  } catch {}

  return { courses: Array.isArray(courses) ? courses : [], unread, hotCourses: Array.isArray(hotCourses) ? hotCourses : [] };
}

function updateStats({ courses, unread }) {
  const todayCount = countTodayCourses(courses);
  const streak = window._currentUser?.checkin_streak || 0;
  const favoritesHint = isLoggedIn() ? '点此查看收藏' : '登录后同步';
  const stats = document.getElementById('home-stat-grid');
  if (stats) {
    stats.innerHTML = [
      renderStatCard(PLUGIN_ICON.calendar, '今日课程', todayCount || courses.length, todayCount ? `${todayWeekdayText()}安排` : '已加入课程', 'mycourse'),
      renderStatCard(PLUGIN_ICON.check, '连续签到天数', `${streak}天`, streak ? '保持节奏' : '今日可签到', 'profile'),
      renderStatCard(PLUGIN_ICON.bell, '通知个数', unread, unread ? '有新消息' : '暂时清净', 'notifications'),
      renderStatCard(PLUGIN_ICON.folder, '收藏资料', '查看', favoritesHint, 'favorites'),
    ].join('');
  }

  const summary = document.getElementById('home-hero-summary');
  if (summary) summary.textContent = `你已加入 ${courses.length} 门课，今天有 ${todayCount || courses.length} 个课程入口可继续。`;

}

function updateHotCourses(hotCourses) {
  const list = document.getElementById('home-hot-courses');
  if (!list) return;
  const sorted = [...hotCourses]
    .sort((a, b) => Number(b.enrollment_count || 0) - Number(a.enrollment_count || 0))
    .slice(0, 5);
  list.innerHTML = sorted.length ? sorted.map(renderHotCourse).join('') : renderEmptyHotCourses();
  animStagger(Array.from(list.children), { y: 14, dur: 320, gap: 45 });
}

function bindHomeEvents(container) {
  container.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-jump]');
    if (jump) {
      navigateTo(jump.dataset.jump);
      return;
    }
    const course = e.target.closest('[data-course-id]');
    if (course) navigateTo('course-detail', Number(course.dataset.courseId));
  });

  container.querySelector('#home-luck-card')?.addEventListener('click', () => {
    const value = 40 + Math.abs(pickDaily([12, 19, 27, 36, 45, 52, 58], 'luck'));
    const el = document.getElementById('home-luck-value');
    if (el) el.textContent = `${Math.min(value, 99)} 分`;
  });

  container.querySelector('#home-answer-card')?.addEventListener('click', () => {
    const el = document.getElementById('home-answer-value');
    if (el) el.textContent = pickDaily(ANSWERS, `answer_${Date.now()}`);
  });

}

registerPage('home', async (container) => {
  renderHomeShell(container);
  bindRipples(container);
  bindHomeEvents(container);
  animIn(container.querySelector('.home-hero'), { y: 18, dur: 420 });

  const data = await loadHomeData();
  updateStats(data);
  updateHotCourses(data.hotCourses);
});
