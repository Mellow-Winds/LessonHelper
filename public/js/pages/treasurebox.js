/**
 * pages/treasurebox.js — 百宝箱：番茄时钟 / 运气值 / 替我抉择 / 薛定谔的待办 / 答案之书
 * 纯前端工具，不使用后端 API
 */

import { registerPage } from '../core/router.js';
import { showToast } from '../components/ui.js';

/* ============================================
   工具函数
   ============================================ */

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pad(n) { return String(n).padStart(2, '0'); }

function getToday() { return new Date().toISOString().slice(0, 10); }

/* ============================================
   番茄时钟
   ============================================ */

const POMODORO_TOTAL = 25 * 60; // 1500 秒
let _pomodoroTimer = null;

function loadPomodoroState() {
  try {
    return JSON.parse(localStorage.getItem('tb_pomodoro')) || { endAt: null, running: false };
  } catch { return { endAt: null, running: false }; }
}

function savePomodoroState(state) {
  localStorage.setItem('tb_pomodoro', JSON.stringify(state));
}

function renderPomodoro() {
  const state = loadPomodoroState();
  let remaining = POMODORO_TOTAL;
  if (state.running && state.endAt) {
    remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
  }
  const progress = remaining / POMODORO_TOTAL;
  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;

  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8zm.5-13H11v6l5.2 3.2l.8-1.3l-4.5-2.7V7z"/></svg>
        <span>番茄时钟</span>
      </div>
      <div class="pomodoro-ring">
        <svg viewBox="0 0 120 120" width="200" height="200">
          <circle class="pomodoro-ring-circle-bg" cx="60" cy="60" r="54" fill="none" stroke-width="8"/>
          <circle class="pomodoro-ring-circle-fg" id="pomodoro-fg" cx="60" cy="60" r="54" fill="none" stroke-width="8"
            stroke-dasharray="${(2 * Math.PI * 54).toFixed(2)}"
            stroke-dashoffset="${((1 - progress) * 2 * Math.PI * 54).toFixed(2)}"/>
        </svg>
        <div class="pomodoro-time" id="pomodoro-time">${pad(min)}:${pad(sec)}</div>
      </div>
      <div class="pomodoro-controls">
        <button class="btn btn-primary" id="pomodoro-start">开始</button>
        <button class="btn btn-secondary" id="pomodoro-pause">暂停</button>
        <button class="btn btn-secondary" id="pomodoro-reset">重置</button>
      </div>
    </div>
  `;
}

function startPomodoroTick() {
  if (_pomodoroTimer) clearInterval(_pomodoroTimer);
  _pomodoroTimer = setInterval(() => {
    const state = loadPomodoroState();
    if (!state.running || !state.endAt) {
      clearInterval(_pomodoroTimer);
      _pomodoroTimer = null;
      return;
    }
    const remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    const timeEl = document.getElementById('pomodoro-time');
    if (timeEl) timeEl.textContent = pad(min) + ':' + pad(sec);
    const progress = remaining / POMODORO_TOTAL;
    const fg = document.getElementById('pomodoro-fg');
    if (fg) fg.setAttribute('stroke-dashoffset', ((1 - progress) * 2 * Math.PI * 54).toFixed(2));
    document.title = `${pad(min)}:${pad(sec)} - 课搭子`;

    if (remaining <= 0) {
      clearInterval(_pomodoroTimer);
      _pomodoroTimer = null;
      document.title = '课搭子';
      savePomodoroState({ endAt: null, running: false });
      if (Notification.permission === 'granted') {
        new Notification('番茄时钟', { body: '25 分钟到！休息一下吧' });
      }
      showToast('番茄时钟结束！休息一下吧');
      const grid = document.querySelector('.tb-grid');
      if (grid) {
        const card = grid.querySelector('.tb-card:first-child');
        if (card) card.outerHTML = renderPomodoro();
        bindPomodoro();
      }
    }
  }, 1000);
}

function bindPomodoro() {
  document.getElementById('pomodoro-start')?.addEventListener('click', () => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const endAt = Date.now() + POMODORO_TOTAL * 1000;
    savePomodoroState({ endAt, running: true });
    startPomodoroTick();
  });
  document.getElementById('pomodoro-pause')?.addEventListener('click', () => {
    const state = loadPomodoroState();
    if (!state.running) return;
    const remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    savePomodoroState({ endAt: Date.now() + remaining * 1000, running: false });
    if (_pomodoroTimer) { clearInterval(_pomodoroTimer); _pomodoroTimer = null; }
    document.title = '课搭子';
  });
  document.getElementById('pomodoro-reset')?.addEventListener('click', () => {
    if (_pomodoroTimer) { clearInterval(_pomodoroTimer); _pomodoroTimer = null; }
    savePomodoroState({ endAt: null, running: false });
    document.title = '课搭子';
    const grid = document.querySelector('.tb-grid');
    if (grid) {
      const card = grid.querySelector('.tb-card:first-child');
      if (card) card.outerHTML = renderPomodoro();
      bindPomodoro();
    }
  });
}

/* ============================================
   今日运气值
   ============================================ */

function getLuckValue() {
  const userId = window._currentUser?.id || 'anonymous';
  const date = getToday();
  try {
    const cached = JSON.parse(localStorage.getItem('tb_luck'));
    if (cached && cached.date === date) return cached.value;
  } catch { /* ignore */ }
  const val = hashCode(userId + '_luck_' + date) % 61 + 40;
  localStorage.setItem('tb_luck', JSON.stringify({ value: val, date }));
  return val;
}

function getLuckLabel(val) {
  if (val >= 86) return '好运爆棚';
  if (val >= 71) return '运气不错';
  if (val >= 56) return '好运正在赶来';
  return '运气就在转角';
}

function renderLuck() {
  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14L2 9.27l6.91-1.01L12 2z"/></svg>
        <span>今日运气值</span>
      </div>
      <div class="luck-display" id="luck-display">
        <div class="luck-number" id="luck-number">?</div>
        <button class="btn btn-outline btn-sm" id="luck-reveal-btn">
          <svg class="mi-svg" viewBox="0 0 24 24" width="16" height="16" style="margin-right:4px"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          点击查看
        </button>
        <div class="luck-label" id="luck-label"></div>
      </div>
    </div>
  `;
}

function animateLuck(val) {
  const el = document.getElementById('luck-number');
  const labelEl = document.getElementById('luck-label');
  const btn = document.getElementById('luck-reveal-btn');
  if (!el) return;
  if (btn) btn.style.display = 'none';
  const duration = 1500;
  const start = performance.now();
  const label = getLuckLabel(val);

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * val);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = val;
      if (labelEl) labelEl.textContent = label;
    }
  }
  requestAnimationFrame(tick);
}

function bindLuck() {
  document.getElementById('luck-reveal-btn')?.addEventListener('click', () => {
    const val = getLuckValue();
    animateLuck(val);
  }, { once: true });
}

/* ============================================
   替我抉择
   ============================================ */

function renderDecide(activeTab = 'coin') {
  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
        <span>替我抉择</span>
      </div>
      <div class="decision-tabs md-pills">
        <button class="md-pill-btn ${activeTab === 'coin' ? 'active' : ''}" data-decide="coin">抛硬币</button>
        <button class="md-pill-btn ${activeTab === 'dice' ? 'active' : ''}" data-decide="dice">掷骰子</button>
        <button class="md-pill-btn ${activeTab === 'rand' ? 'active' : ''}" data-decide="rand">随机数</button>
      </div>
      <div class="decision-content" id="decide-content">
        ${activeTab === 'coin' ? renderCoin() : activeTab === 'dice' ? renderDice() : renderRand()}
      </div>
    </div>
  `;
}

/* --- 抛硬币 --- */

function renderCoin(result = null) {
  const showResult = result !== null;
  const faces = { 0: ['正面', '🪙'], 1: ['反面', '🪙'], 2: ['立起来了！', '🪙'] };
  const [text, icon] = result !== null ? faces[result] : ['点击硬币抛一次', '🪙'];
  return `
    <div class="coin-area" id="coin-area">
      <div class="coin-visual ${showResult ? '' : 'coin-idle'}" id="coin-visual">
        <div class="coin-inner">${icon}</div>
      </div>
      <div class="coin-result" id="coin-result">${text}</div>
      <button class="btn btn-primary btn-sm" id="coin-flip-btn">抛一次</button>
    </div>
  `;
}

function flipCoin() {
  const area = document.getElementById('coin-area');
  if (!area || area.querySelector('.coin-flipping')) return;

  const visual = document.getElementById('coin-visual');
  const resultEl = document.getElementById('coin-result');
  const btn = document.getElementById('coin-flip-btn');
  if (btn) btn.disabled = true;

  visual.classList.add('coin-flipping');
  resultEl.textContent = '...';

  setTimeout(() => {
    const rand = Math.random();
    let result;
    if (rand < 0.49) result = 0;
    else if (rand < 0.98) result = 1;
    else result = 2;

    visual.classList.remove('coin-flipping');
    const faces = { 0: ['正面', '🪙'], 1: ['反面', '🪙'], 2: ['立起来了！', '🪙'] };
    resultEl.textContent = faces[result][0];
    visual.querySelector('.coin-inner').textContent = faces[result][1];
    if (btn) btn.disabled = false;
  }, 800);
}

/* --- 掷骰子 --- */

function renderDice(value = null) {
  const display = value !== null ? value : '?';
  return `
    <div class="dice-area" id="dice-area">
      <div class="dice-visual" id="dice-visual">
        <div class="dice-face" id="dice-face">${display}</div>
      </div>
      <button class="btn btn-primary btn-sm" id="dice-roll-btn">掷一次</button>
    </div>
  `;
}

function rollDice() {
  const visual = document.getElementById('dice-visual');
  const faceEl = document.getElementById('dice-face');
  const btn = document.getElementById('dice-roll-btn');
  if (!visual || visual.classList.contains('dice-rolling')) return;
  if (btn) btn.disabled = true;

  visual.classList.add('dice-rolling');
  const finalVal = Math.floor(Math.random() * 6) + 1;

  let count = 0;
  const rapidChange = setInterval(() => {
    faceEl.textContent = Math.floor(Math.random() * 6) + 1;
    count++;
    if (count >= 12) {
      clearInterval(rapidChange);
      faceEl.textContent = finalVal;
      visual.classList.remove('dice-rolling');
      if (btn) btn.disabled = false;
    }
  }, 80);
}

/* --- 随机数 --- */

function renderRand(result = null) {
  return `
    <div class="rand-area">
      <div class="md-input-group" style="margin-bottom:12px">
        <input class="md-input" id="rand-min" type="number" value="1" placeholder=" ">
        <label class="md-label">最小值</label>
        <fieldset class="md-border"><legend><span>最小值</span></legend></fieldset>
      </div>
      <div class="md-input-group" style="margin-bottom:12px">
        <input class="md-input" id="rand-max" type="number" value="100" placeholder=" ">
        <label class="md-label">最大值</label>
        <fieldset class="md-border"><legend><span>最大值</span></legend></fieldset>
      </div>
      <button class="btn btn-primary btn-sm" id="rand-btn" style="width:100%">生成随机数</button>
      <div class="rand-result" id="rand-result">${result !== null ? result : ''}</div>
    </div>
  `;
}

function generateRand() {
  const minEl = document.getElementById('rand-min');
  const maxEl = document.getElementById('rand-max');
  const resultEl = document.getElementById('rand-result');
  if (!minEl || !maxEl || !resultEl) return;
  const min = parseInt(minEl.value) || 1;
  const max = parseInt(maxEl.value) || 100;
  if (min > max) {
    showToast('最小值不能大于最大值');
    return;
  }
  const val = Math.floor(Math.random() * (max - min + 1)) + min;

  let count = 0;
  const scrollAnim = setInterval(() => {
    resultEl.textContent = Math.floor(Math.random() * (max - min + 1)) + min;
    count++;
    if (count >= 10) {
      clearInterval(scrollAnim);
      resultEl.textContent = val;
    }
  }, 60);
}

/* ============================================
   答案之书 — 1000 个答案（每个 ≤10 字）
   ============================================ */

const ANSWER_BOOK_ANSWERS = [
  '放手去做吧','当然可以','没错就是它','勇敢去试试','就是现在','值得一试','尽管去吧','你一定行','毫无疑问','大胆前行',
  '时机正好','就是它了','现在就去','毫无疑问是','这是对的','去实现它','别犹豫了','你可以的','这是正解','天赐良机',
  '现在行动','全力以赴','坚信不疑','不必顾虑','顺势而为','去追逐吧','放手一搏','乘风破浪','去看远方','去发光吧',
  '事在人为','未来可期','势不可挡','一鼓作气','正当其时','志在必得','所向披靡','无往不利','披荆斩棘','破浪前行',
  '向阳而生','追光而去','即刻出发','心之所向','行则将至','做就对了','莫问前程','但行好事','即刻启程','踏上征途',
  '出发吧','说做就做','往前冲','迈出那一步','就是干','拼一把','冲就完了','干就完了','上吧','飞吧',
  '愿你所愿','终将实现','必定如愿','花开有时','静待佳音','好事将近','天随人愿','吉星高照','紫气东来','祥云瑞气',
  '福至心灵','好运连连','喜从天降','万事胜意','得偿所愿','马到成功','旗开得胜','水到渠成','心想事成','万事俱备',
  '只欠东风','风正好','帆已满','天时地利','天地人和','时来运转','转机在即','黎明将至','曙光在前',
  '星辰大海','辽阔天地','前路光明','坦途在前','一片坦途','畅通无阻','大有可为','前程似锦','鹏程万里','扶摇直上',
  '大展宏图','展翅高飞','海阔天空','未来在你手中','乾坤未定','一切皆有可能','大有希望','光芒万丈','熠熠生辉',
  '闪闪发光','你就是答案','答案在手中','自有答案','心知肚明','你早已知晓','听从直觉','第一感觉最准','心里有数','问心无愧',
  '三思而后行','再等等看','现在不是时候','换个方向吧','暂且放下','不必强求','时机未到','别急着决定',
  '先放一放','缓一缓再说','不要冲动','冷静一下','暂缓为妙','且慢','不如搁置','从长计议',
  '不是这条路','此路不通','回头是岸','换条路走','别钻牛角尖','退一步看','绕道而行','另辟蹊径',
  '放弃也是智慧','及时止损','当断则断','不必纠缠','放下吧','算了吧','由它去吧','翻篇了',
  '不太可能','希望渺茫','风险太大','慎重考虑','不太妙','悬而未决','凶多吉少','此非良机',
  '不是最佳选择','有待斟酌','尚需时日','言之过早','为时尚早','还需等待','时候未到','静观其变',
  '别做','别去','别碰','千万别','躲远点','绕开它','避开为妙','敬而远之',
  '多说无益','沉默是金','少说为妙','言多必失','不必多言','保持沉默','守口如瓶','三缄其口',
  '事与愿违','南辕北辙','背道而驰','渐行渐远','覆水难收','木已成舟','尘埃落定','无济于事',
  '算了吧何必呢','不值当','不要也罢','何必自寻烦恼','庸人自扰','多此一举','画蛇添足','过犹不及',
  '你已经很棒了','相信自己','一切都值得','做自己就好','你很了不起','别否定自己','你独一无二','你足够好',
  '坚持下去','再坚持一下','黎明前最暗','熬过去就好','都会好起来的','时间会治愈','伤痕是勋章','杀不死你的',
  '没关系慢慢来','不必完美','允许自己犯错','给自己时间','慢慢成长','不急不躁','按自己的节奏','不必比较',
  '你值得被爱','你很重要','你的存在有意义','这世界需要你','总有人在意你','你被爱着','你并不孤单','有人在等你',
  '加油你可以','挺住意味着一切','撑住','咬咬牙就过了','风雨过后是彩虹','柳暗花明','否极泰来','苦尽甘来',
  '向阳而生吧','心若向阳无畏悲伤','笑对人生','嘴角上扬','记得微笑','开心最重要','快乐很简单','取悦自己',
  '你很美','你很帅','你闪闪发光','你眼里有星星','你笑起来很好看','你声音好听','你的存在就是光','你是礼物',
  '别怕失败','失败是成功之母','错误是成长的阶梯','摔倒了爬起来','跌倒了就躺会儿','歇够了再出发','喘口气也好','休息也是前进',
  '今天辛苦你了','你已经做得很好了','不必逞强','累了就歇歇','困了就睡','饿了就吃','照顾好自己','善待自己',
  '前路漫漫亦灿灿','道阻且长行则将至','路虽远行则将至','事虽难做则必成','念念不忘必有回响','功不唐捐','天道酬勤','厚积薄发',
  '每一小步都算数','聚沙成塔','滴水穿石','积跬步至千里','日拱一卒','星光不负赶路人','岁月不负有心人',
  '春风得意马蹄疾','轻舟已过万重山','守得云开见月明','拨云见日','峰回路转','绝处逢生','涅槃重生',
  '愿你被世界温柔以待','愿你平安喜乐','愿你健康快乐','愿你自由自在','愿你眼里有光','愿你心中有火','愿你脚下有路','愿你前方有灯',
  '你值得更好的','最好的尚未到来','惊喜在路上了','好事多磨','好饭不怕晚','压轴的总在最后','主角都是最后登场','你的剧本还没写完',
  '天将降大任','宝剑锋从磨砺出','梅花香自苦寒来','大器晚成','后来者居上','黑马就是你','逆袭剧本已写好','请开始你的表演',
  '心有灵犀','心意相通','情投意合','一见如故','相见恨晚','命中注定','天生一对','佳偶天成',
  '爱在眼前','珍惜身边人','TA就在你身边','爱要大声说','表白吧','去告白','勇敢说爱','喜欢就去追',
  '缘分已至','缘分妙不可言','有缘千里来相会','缘来是你','在对的时间遇见','相逢即是缘','且行且珍惜','珍惜眼前人',
  '细水长流','日久生情','相濡以沫','执子之手','与子偕老','白头偕老','琴瑟和鸣','举案齐眉',
  '暗恋是糖也是霜','藏在心里也挺好','默默喜欢也是美','远远看着就很好','不打扰是温柔','感谢遇见','遇见就很幸运','谢谢你出现过',
  '放不下就先拿着','时间会冲淡一切','会过去的','各自安好','一别两宽','后会无期','错过了就是错过了','往事随风',
  '下一个更好','总有人翻山越岭而来','你的TA在路上了','月老在牵线了','红绳已系','红线那头是谁','丘比特在瞄准','桃花运将至',
  '等待值得','宁缺毋滥','与其将就不如独行','单身的自由也很美','一个人的精彩','先爱自己再爱人','你若盛开蝴蝶自来','花香蝶自来',
  '朋友一生一起走','友谊长存','知己难得','人生得一知己足矣','兄弟情深','姐妹同心','患难见真情','雪中送炭最珍贵',
  '家人是最温暖的港','常回家看看','打个电话给家人','陪伴是最好的爱','父母在人生尚有来处','家是永远的港湾','归去来兮','倦鸟归林',
  '好久不见甚是想念','去见你想见的人','别等来不及才后悔','趁一切都来得及','活在当下珍惜眼前','来日并不方长','世事无常珍惜当下','明天和意外不知谁先来',
  '释怀吧','原谅自己','与过去和解','放下执念','卸下包袱','别回头往前看','往事清零','重新开始',
  '爱自有天意','情深不寿','慧极必伤','爱是克制','喜欢是放肆','爱是彼此成就','互相照亮','并肩前行',
  '学无止境','温故知新','厚积薄发','学以致用','知行合一','格物致知','博学笃志','切问近思',
  '书山有路勤为径','学海无涯苦作舟','业精于勤荒于嬉','读书破万卷','下笔如有神','腹有诗书气自华','最是书香能致远',
  '别临时抱佛脚','平时不烧香','平时多流汗','考前少流泪','平时多积累','考试不慌张','复习要趁早','别拖到最后',
  '这次考试能过','考试顺利','逢考必过','考的都会','蒙的都对','超常发挥','如有神助','下笔如有神',
  '你的努力不会白费','每一分耕耘都有收获','汗水浇灌出花朵','静待花开','默默扎根','向下扎根向上生长','根深才能叶茂','厚积才能薄发',
  '保持好奇心','永远求知若渴','虚心使人进步','骄傲使人落后','三人行必有我师','处处留心皆学问','学问学问边学边问','勤学好问',
  '专注当下','一心一意','心无旁骛','聚精会神','全神贯注','制心一处','无事不办','专注的力量',
  '图书馆在召唤你','去自习吧','放下手机去学习','书在等你翻开','拿起笔开始写','翻开第一页','迈出第一步','从此刻开始',
  '老师会欣赏你的','请教老师别害羞','多和同学讨论','团队合作力量大','独学而无友则孤陋','找一个学习搭子','并肩作战不孤单','一起变更好',
  '论文会顺利的','答辩一定过','实验会成功的','数据会好看','代码会跑通的','bug能修好','项目能交付','一切顺利',
  '终身学习','活到老学到老','学如逆水行舟','不进则退','学而不思则罔','思而不学则殆','温故而知新','可以为师矣',
  '毕业不是终点','人生处处是考场','学到的谁也拿不走','知识是最好的投资','投资自己永远不亏','学习是终身的事业','今天也要好好学习','明天也要加油',
  '天赋不够努力来凑','勤能补拙是良训','笨鸟先飞','龟兔赛跑','天道酬勤不酬怨','聪明在于勤奋','天才在于积累','水滴石穿',
  '早睡早起身体好','多喝热水','记得吃早饭','好好吃饭','按时吃饭','多吃蔬菜','少吃外卖','别熬夜了',
  '出去走走吧','散个步去','呼吸新鲜空气','拥抱大自然','晒晒太阳','看看天空','数数星星','吹吹晚风',
  '今天适合吃顿好的','犒劳一下自己','奖励自己','给自己买个礼物','买下它','对自己好一点','偶尔放肆一下','偷得浮生半日闲',
  '整理一下房间','断舍离','该扔的就扔','打扫卫生心情好','窗明几净心自安','一屋不扫何以扫天下','收拾收拾换个心情','干净是最好的风水',
  '运动一下吧','跑起来','跳一跳','出出汗','活动活动筋骨','身体是革命的本钱','健康第一','无病无灾就是福',
  '泡杯茶慢慢喝','喝杯咖啡提神','倒杯水歇一歇','点一盏灯读一本书','放一首喜欢的歌','音乐治愈一切','旋律是最好的药','歌声里有答案',
  '养一盆植物','种一株花','看它慢慢长大','养只猫治愈你','撸猫解千愁','狗是人类最好的朋友','小动物很治愈','去摸摸小猫',
  '睡个好觉吧','今晚早点睡','明天又是新的一天','一觉醒来会更好','梦里有答案','好好睡别多想','关掉手机闭上眼','晚安好梦',
  '洗个热水澡放松','泡个脚解解乏','做做拉伸放松肌肉','深呼吸放松','冥想片刻','放空自己','什么都不想','发呆也是一种充电',
  '列个待办清单','一件事一件事来','分清轻重缓急','先做最重要的','别贪多嚼不烂','一次只做一件事','专注一件事做到极致','少即是多',
  '存点钱吧','开源节流','该花的要花','该省的要省','花钱买快乐值得','体验比物品更珍贵','钱是赚不完的','够用就好',
  '换个发型吧','买件新衣服','换个新造型','尝试新风格','换个颜色换个心情','新形象新气象','从头开始','改头换面',
  '按时吃饭按时睡觉','规律作息','养成好习惯','好习惯改变一生','微习惯大力量','每天进步一点点','坚持就是胜利','习惯成就命运',
  '顺其自然','随遇而安','船到桥头自然直','车到山前必有路','柳暗花明又一村','塞翁失马焉知非福','祸兮福所倚',
  '大道至简','返璞归真','少即是多','慢即是快','欲速则不达','过犹不及','物极必反','否极泰来',
  '知足常乐','知止不殆','知足者富','贪多必失','满招损谦受益','月满则亏水满则溢','花看半开酒饮微醺','凡事留三分',
  '静水流深','大音希声','大象无形','大智若愚','大巧若拙','大辩若讷','大勇若怯','大器晚成',
  '无为而无不为','道法自然','天人合一','万物皆有时','春种秋收','瓜熟蒂落','水到渠成','自然而然',
  '一切都会过去','逝者如斯夫','不舍昼夜','时光如流水','岁月不居','时节如流','光阴似箭','白驹过隙',
  '当下即是全部','昨日已过明日未至','活在此刻','此时此刻最重要','拥有当下就是富有','不念过往不畏将来','过去已去未来未来','现在就是礼物',
  '心若不动风又奈何','境由心造','相由心生','心静自然凉','心安即是归处','心宽天地阔','心有多大舞台就有多大','一切唯心造',
  '不以物喜不以己悲','宠辱不惊','去留无意','看庭前花开花落','望天上云卷云舒','闲看花开花落','漫随云卷云舒','淡然处之',
  '上善若水','水善利万物而不争','水利万物','柔能克刚','水滴石穿','海纳百川','有容乃大','无欲则刚',
  '难得糊涂','睁一只眼闭一只眼','看破不说破','心里明白就行了','不必事事较真','糊涂是福','人生难得是糊涂','别想太多',
  '道不远人','道在平常日用间','一花一世界','一叶一菩提','一粒沙里看世界','半瓣花上说人情','微尘中有大千',
  '活在当下','今日事今日毕','明日复明日明日何其多','我生待明日万事成蹉跎','少壮不努力老大徒伤悲','莫等闲白了少年头','及时当勉励岁月不待人','盛年不重来',
  '别做梦了醒醒','你想太多了','洗洗睡吧','梦里什么都有','醒醒吧孩子','别自我感动了','你又来了','差不多得了',
  '这就是命','认命吧','算命的都救不了你','别挣扎了','随缘吧','爱咋咋地','随便吧','无所吊谓',
  '你猜','你猜猜看','你再猜','就不告诉你','无可奉告','佛曰不可说','天机不可泄露','这个不能说',
  '看心情','看情况吧','看缘分','看命','看天意','看运气','看你表现','看你诚意',
  '你自己心里没数吗','你明明知道答案','你其实早就决定了','问我干嘛你知道的','别自欺欺人了','诚实面对自己吧','你需要的不是答案','你需要的是勇气',
  '想peach呢','想多了兄弟','好家伙','真有你的','太卷了吧','别卷了','躺平吧','摆烂也是智慧',
  '打游戏去吧','追剧去吧','刷手机去吧','摸鱼去吧','偷懒一下没事','划水也是门艺术','带薪摸鱼','上班如上坟',
  '吃顿火锅就好了','没有什么是一顿火锅解决不了的','如果有就两顿','烧烤也行','奶茶续命','快乐水拯救世界','甜食治愈一切','吃饱了再说',
  '你开心就好','你高兴就行','你说的都对','你赢了','是在下输了','甘拜下风','这波我服','厉害了我的哥',
  '这就是生活','成年人的世界没有容易二字','除了长胖','除了掉头发','除了变穷','扎心了老铁','人间真实','过于真实',
  '豆瓣拒绝评分','不建议不建议','达咩','漏','NO','别问了','下一个问题','跳过这题',
  '今天不宜做决定','改天再问','择日再问','明日再议','下次一定','改天一定','后天吧','大后天也行',
  '是福不是祸是祸躲不过','看开点','想开点','放宽心','没什么大不了的','天塌不下来','是你的跑不掉的','得之我幸失之我命',
  '小心驶得万年船','警惕身边人','防人之心不可无','害人之心不可有','小心为上','睁大眼睛','擦亮眼睛','提高警惕',
  '谨言慎行','祸从口出','沉默是金','多听少说','三思而后言','言多必失','守心如守城','慎独',
  '别太相信别人','别把底牌全亮出来','给自己留条后路','凡事留有余地','话不说满事不做绝','做人留一线','日后好相见','别把话说死',
  '骄兵必败','得意莫忘形','乐极生悲','喜极而泣','别飘','稳住','低调做人','闷声发大财',
  '有陷阱','前方有坑','注意脚下','小心路滑','看路','当心','留神','警觉',
  '别贪小便宜','天下没有免费的午餐','免费的往往最贵','便宜没好货','天上不会掉馅饼','掉下来也是铁饼','小心糖衣炮弹','甜言蜜语最伤人',
  '酒肉朋友靠不住','遇事见人心','路遥知马力','日久见人心','真金不怕火炼','患难见真情','墙倒众人推','树倒猢狲散',
  '别好了伤疤忘了疼','不要在同一个坑摔两次','吃一堑长一智','前事不忘后事之师','历史总在重演','记住教训','吸取经验',
  '别被表面迷惑','金玉其外败絮其中','知人知面不知心','画龙画虎难画骨','不要被外表欺骗','透过现象看本质','拨开迷雾看真相','真相往往残酷',
  '高处不胜寒','树大招风','人怕出名猪怕壮','枪打出头鸟','木秀于林风必摧之','低调低调再低调','闷声才能发大财','藏拙',
  '你心中已有答案','其实你知道','答案就在你心里','向内求','静下来听听心声','倾听内心的声音','直觉会告诉你','第一反应最真实',
  '一切自有安排','冥冥之中自有天意','命中有时终须有','万事皆有定数','因果不虚','种什么因得什么果','因果循环报应不爽','善恶终有报',
  '宇宙自有安排','交给时间','让子弹飞一会儿','静待花开','耐心等待','好事不怕晚','心急吃不了热豆腐','慢工出细活',
  '这个问题的答案不重要','问错了问题','换个问题问','你确定要问这个吗','跳出框架看问题','换个角度','山不转水转',
  '风知道答案','云会告诉你','雨带来消息','雪藏着秘密','春风十里不如你','夏虫不可语冰','一叶落而知天下秋','冬天来了春天还会远吗',
  '今天不宜问大事','明日再问','吉时未到','良辰吉日再问','初一十五再问','月圆之夜有答案','等到花开时','待到雪化后',
  '天知道','地知道','神知道','鬼知道','只有你自己知道','宇宙知道','月亮知道','星星知道',
  '也许吧','或许吧','大概吧','可能吧','差不多','八九不离十','十有八九','七七八八',
  '不可说','不可思议','玄之又玄','妙不可言','不可思议的奇妙','只可意会不可言传','道可道非常道','名可名非常名',
  '一半一半','各占五成','不好说','说不准','难说','看情况','看造化','看际遇',
  '一切皆空','色即是空空即是色','无即是有','空即是满','虚即是实','梦即是醒','生即是死','一即一切','万物皆备于我',
];

/* ============================================
   薛定谔的待办（盲盒任务）
   ============================================ */

const BLIND_BOX_TASKS = [
  '今天喝满三杯水',
  '站起来伸展一分钟',
  '给一个朋友发一句"加油"',
  '整理一下桌面，哪怕只是把笔放好',
  '闭眼深呼吸 10 次，什么都不想',
  '读一页任何书',
  '对镜子里的自己笑一下',
  '写下今天最想完成的一件事',
  '给通讯录里随机一个人发个表情包',
  '走楼梯而不是坐电梯（至少一次）',
  '吃一个水果',
  '把手机放下 5 分钟，看看窗外',
  '记录今天让你开心的一件事',
  '做 10 个深蹲',
  '给妈妈发一句"我爱你"',
  '收拾一件你一直懒得收的东西',
  '听一首没听过的歌',
  '对自己说三遍"我很棒"',
  '帮陌生人做一件小事',
  '写下一个你想感谢的人的名字',
  '今天不说一句抱怨的话',
  '用左手（或右手）写一行字',
  '拍一张你觉得美的照片',
  '把袜子配对整理好',
  '对自己说：你已经做得很好了'
];

function renderBlindBox(revealedIdx = null) {
  if (revealedIdx !== null) {
    return `
      <div class="tb-card">
        <div class="tb-card-title">
          <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          <span>薛定谔的待办</span>
        </div>
        <div class="blindbox-revealed" id="blindbox-revealed">
          <div class="blindbox-task" id="blindbox-task">${escHtml(BLIND_BOX_TASKS[revealedIdx] || '未知任务')}</div>
          <button class="btn btn-primary btn-sm" id="blindbox-retry-btn" style="margin-top:12px">
            <span class="mi">refresh</span> 再来一次
          </button>
          <button class="btn btn-secondary btn-sm" id="blindbox-share" style="margin-top:8px">
            <span class="mi">share</span> 分享任务
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        <span>薛定谔的待办</span>
      </div>
      <div class="blindbox-sealed" id="blindbox-sealed">
        <div class="blindbox-box-icon">
          <svg viewBox="0 0 80 80" width="80" height="80">
            <rect x="10" y="25" width="60" height="45" rx="8" fill="none" stroke="var(--md-primary)" stroke-width="2.5"/>
            <path d="M10 25 L40 42 L70 25" fill="none" stroke="var(--md-primary)" stroke-width="2.5"/>
            <rect x="32" y="32" width="16" height="18" rx="4" fill="none" stroke="var(--md-primary)" stroke-width="1.5"/>
            <circle cx="40" cy="39" r="2" fill="var(--md-primary)"/>
          </svg>
        </div>
        <p style="font-size:var(--text-sm);color:var(--md-on-surface-variant);margin-top:8px">无限抽取，越玩越上头</p>
        <button class="btn btn-primary btn-sm" id="blindbox-open-btn">🎁 打开盲盒</button>
      </div>
    </div>
  `;
}

function openBlindBox() {
  const sealed = document.getElementById('blindbox-sealed');
  if (!sealed) return;

  const idx = Math.floor(Math.random() * BLIND_BOX_TASKS.length);

  sealed.style.transition = 'transform 0.4s var(--ease-spring), opacity 0.3s var(--ease-standard)';
  sealed.style.transform = 'scale(0.5) rotate(-10deg)';
  sealed.style.opacity = '0';

  setTimeout(() => {
    const card = sealed.closest('.tb-card');
    if (card) card.outerHTML = renderBlindBox(idx);
    bindBlindBox();
  }, 400);
}

function retryBlindBox() {
  const card = document.getElementById('blindbox-revealed')?.closest('.tb-card');
  if (!card) return;

  const idx = Math.floor(Math.random() * BLIND_BOX_TASKS.length);

  // Fade out current task, then reveal new one
  card.style.transition = 'transform 0.3s var(--ease-spring), opacity 0.2s var(--ease-standard)';
  card.style.transform = 'scale(0.95)';
  card.style.opacity = '0.5';

  setTimeout(() => {
    card.outerHTML = renderBlindBox(idx);
    bindBlindBox();
  }, 250);
}

function bindBlindBox() {
  document.getElementById('blindbox-open-btn')?.addEventListener('click', openBlindBox);
  document.getElementById('blindbox-retry-btn')?.addEventListener('click', retryBlindBox);
  document.getElementById('blindbox-share')?.addEventListener('click', () => {
    const taskText = document.getElementById('blindbox-task')?.textContent;
    if (taskText) {
      navigator.clipboard.writeText('【课搭子 · 今日待办】' + taskText).then(() => {
        showToast('已复制到剪贴板');
      }).catch(() => {
        showToast('分享失败，请长按手动复制');
      });
    }
  });
}

/* ============================================
   答案之书
   ============================================ */

function renderAnswerBook(revealedAnswer = null) {
  if (revealedAnswer !== null) {
    return `
      <div class="tb-card">
        <div class="tb-card-title">
          <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5c-1.95 0-4.05.4-5.5 1.5c-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5c.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5c1.35-.85 3.8-1.5 5.5-1.5c1.65 0 3.35.3 4.75 1.05c.1.05.15.05.25.05c.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5c-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5c1.2 0 2.4.15 3.5.5v11.5z"/></svg>
          <span>答案之书</span>
        </div>
        <div class="answerbook-revealed" id="answerbook-revealed">
          <div class="answerbook-answer" id="answerbook-answer">${escHtml(revealedAnswer)}</div>
          <div class="answerbook-actions">
            <button class="btn btn-primary btn-sm" id="answerbook-retry-btn">
              <span class="mi">auto_stories</span> 再翻一页
            </button>
            <button class="btn btn-secondary btn-sm" id="answerbook-share">
              <span class="mi">share</span> 分享答案
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="tb-card">
      <div class="tb-card-title">
        <svg class="mi-svg" viewBox="0 0 24 24" width="22" height="22"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5c-1.95 0-4.05.4-5.5 1.5c-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5c.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5c1.35-.85 3.8-1.5 5.5-1.5c1.65 0 3.35.3 4.75 1.05c.1.05.15.05.25.05c.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5c-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5c1.2 0 2.4.15 3.5.5v11.5z"/></svg>
        <span>答案之书</span>
      </div>
      <div class="answerbook-sealed" id="answerbook-sealed">
        <div class="answerbook-book-icon">
          <svg viewBox="0 0 100 100" width="100" height="100">
            <rect x="40" y="10" width="8" height="80" rx="2" fill="var(--md-primary)" opacity="0.2"/>
            <path d="M40 15 L10 20 L10 85 L40 80 Z" fill="var(--md-surface-container-high)" stroke="var(--md-outline-variant)" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M48 15 L78 20 L78 85 L48 80 Z" fill="var(--md-surface-container-lowest)" stroke="var(--md-outline-variant)" stroke-width="1.5" stroke-linejoin="round"/>
            <line x1="17" y1="32" x2="35" y2="30" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="17" y1="40" x2="35" y2="38" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="17" y1="48" x2="35" y2="46" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="17" y1="56" x2="35" y2="54" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="53" y1="32" x2="72" y2="30" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="53" y1="40" x2="72" y2="38" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="53" y1="48" x2="72" y2="46" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <line x1="53" y1="56" x2="72" y2="54" stroke="var(--md-outline-variant)" stroke-width="1" stroke-linecap="round"/>
            <text x="50" y="70" text-anchor="middle" font-size="18" font-weight="700" fill="var(--md-primary)" font-family="serif">?</text>
          </svg>
        </div>
        <p style="font-size:var(--text-sm);color:var(--md-on-surface-variant);margin-top:8px">心中默念问题，轻触书本翻开答案</p>
        <button class="btn btn-primary btn-sm" id="answerbook-open-btn">
          <span class="mi">auto_stories</span> 翻开答案之书
        </button>
      </div>
    </div>
  `;
}

function drawAnswer() {
  const sealed = document.getElementById('answerbook-sealed');
  if (!sealed) return;

  const idx = Math.floor(Math.random() * ANSWER_BOOK_ANSWERS.length);
  const answer = ANSWER_BOOK_ANSWERS[idx];

  sealed.style.transition = 'transform 0.45s var(--ease-spring), opacity 0.3s var(--ease-standard)';
  sealed.style.transform = 'scale(0.9) rotateY(90deg)';
  sealed.style.opacity = '0';

  setTimeout(() => {
    const card = sealed.closest('.tb-card');
    if (card) card.outerHTML = renderAnswerBook(answer);
    bindAnswerBook();
  }, 400);
}

function retryAnswerBook() {
  const card = document.getElementById('answerbook-revealed')?.closest('.tb-card');
  if (!card) return;

  const idx = Math.floor(Math.random() * ANSWER_BOOK_ANSWERS.length);
  const answer = ANSWER_BOOK_ANSWERS[idx];

  card.style.transition = 'transform 0.3s var(--ease-spring), opacity 0.2s var(--ease-standard)';
  card.style.transform = 'scale(0.95)';
  card.style.opacity = '0.5';

  setTimeout(() => {
    card.outerHTML = renderAnswerBook(answer);
    bindAnswerBook();
  }, 250);
}

function bindAnswerBook() {
  document.getElementById('answerbook-open-btn')?.addEventListener('click', drawAnswer);
  document.getElementById('answerbook-retry-btn')?.addEventListener('click', retryAnswerBook);
  document.getElementById('answerbook-share')?.addEventListener('click', () => {
    const answerText = document.getElementById('answerbook-answer')?.textContent;
    if (answerText) {
      navigator.clipboard.writeText('【课搭子 · 答案之书】' + answerText).then(() => {
        showToast('已复制到剪贴板');
      }).catch(() => {
        showToast('分享失败，请长按手动复制');
      });
    }
  });
}

/* ============================================
   组装 & 事件绑定
   ============================================ */

function renderTreasureBox() {
  return `
    <div class="page-header">
      <h1 class="page-title" style="margin:0">
        <svg class="mi-svg" viewBox="0 0 24 24" width="24" height="24" style="vertical-align:-5px;margin-right:4px"><path d="M21.18 4.35L18.28 2.5c-.55-.35-1.22-.35-1.77 0L13.7 3.93L9.83 1.7c-.55-.35-1.22-.35-1.77 0L2.82 4.35C2.32 4.62 2 5.15 2 5.71V18.3c0 .56.32 1.09.82 1.36l5.24 2.65c.55.28 1.22.28 1.77 0l3.87-2.23l3.87 2.23c.55.28 1.22.28 1.77 0l5.24-2.65c.5-.27.82-.8.82-1.36V5.71c0-.56-.32-1.09-.82-1.36zM12 16c-1.66 0-3-1.34-3-3s1.34-3 3-3s3 1.34 3 3s-1.34 3-3 3z"/></svg>
        百宝箱
      </h1>
    </div>
    <p class="tb-page-desc">工具集合 · 多巴胺自动机 · 纯前端计算</p>
    <div class="tb-grid">
      ${renderPomodoro()}
      ${renderLuck()}
      ${renderDecide('coin')}
      ${renderBlindBox()}
      ${renderAnswerBook()}
    </div>
  `;
}

function bindDecideTabs(container) {
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-decide]');
    if (!tab) return;

    const type = tab.dataset.decide;
    container.querySelectorAll('[data-decide]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const content = document.getElementById('decide-content');
    if (!content) return;

    if (type === 'coin') content.innerHTML = renderCoin();
    else if (type === 'dice') content.innerHTML = renderDice();
    else if (type === 'rand') content.innerHTML = renderRand();

    bindDecideActions();
  });
}

function bindDecideActions() {
  document.getElementById('coin-flip-btn')?.addEventListener('click', flipCoin);
  document.getElementById('dice-roll-btn')?.addEventListener('click', rollDice);
  document.getElementById('rand-btn')?.addEventListener('click', generateRand);
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

registerPage('treasurebox', (container) => {
  container.innerHTML = renderTreasureBox();
  setTimeout(() => {
    bindPomodoro();
    bindLuck();

    const decideCard = document.querySelector('.decision-tabs');
    if (decideCard) bindDecideTabs(decideCard);
    bindDecideActions();

    bindBlindBox();
    bindAnswerBook();

    const pState = loadPomodoroState();
    if (pState.running && pState.endAt) {
      startPomodoroTick();
    }
  }, 0);
});

export { renderTreasureBox };
