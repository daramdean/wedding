/* Curtain — 닫힌 커튼 → 열림 → 양끝으로 사라짐, 그 사이 intro 등장 */
const Curtain = (function () {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = { hold: 600, reveal: 400, open: 1300, rest: 300, leave: 1000 };   // 총 약 3.2초
  const pristine = document.getElementById('intro').cloneNode(true);   // 다시 보기용 원본
  let timers = [];

  function whenVisible() {
    // 화면에 실제로 보이고 있을 때만 시작 (백그라운드·미리 로드 상태에서 혼자 끝나버리지 않게)
    return new Promise(r => {
      if (document.visibilityState === 'visible') return r();
      document.addEventListener('visibilitychange', function h() {
        if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', h); r(); }
      });
    });
  }

  function run() {
    const curtain = document.getElementById('curtain');
    if (!curtain || reduce) { if (curtain) curtain.remove(); root.classList.add('is-revealed'); return; }
    let started = false;
    document.body.classList.add('is-curtain');
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    function open() {
      if (started) return;
      started = true;
      curtain.classList.add('is-opening');
      later(() => root.classList.add('is-revealed'), T.reveal);
      later(() => { curtain.classList.add('is-leaving'); document.body.classList.remove('is-curtain'); }, T.open + T.rest);
      later(() => curtain.remove(), T.open + T.rest + T.leave);
    }

    // 이미지가 준비되면 잠시 보여준 뒤 자동으로 열림 (탭하면 바로 열림)
    // 커튼·인트로 그림과 글꼴이 준비된 뒤 열림 (네트워크가 느려도 최대 3.5초 대기)
    const imgs = Array.from(document.querySelectorAll('#intro img'));
    const ready = Promise.all([
      ...imgs.map(i => (i.decode ? i.decode() : Promise.resolve()).catch(() => {})),
      document.fonts ? document.fonts.ready : Promise.resolve()
    ]);
    Promise.race([ready, new Promise(r => setTimeout(r, 3500))])
      .then(whenVisible)
      .then(() => requestAnimationFrame(() => later(open, T.hold)));
    curtain.addEventListener('click', open);
  }

  function replay() {
    timers.forEach(clearTimeout); timers = [];
    root.classList.remove('is-revealed');
    document.getElementById('intro').replaceWith(pristine.cloneNode(true));
    window.scrollTo(0, 0);
    run();
  }

  run();
  return { replay };
})();

/* Snow — 전체 화면에 은은하게 내리는 눈 */
(function () {
  const canvas = document.getElementById('snow');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, flakes = [];

  /* ⚠ 눈 설정은 확정(2026-11-14). 섹션을 추가해도 변경하지 않음. */
  const SNOW = {
    max: 50,           // 최대 개수
    density: 9000,     // 화면 면적(px²) 당 1개
    fall: [0.18, 0.08, 0.12],   // 낙하 속도 = a + 반지름*b + 랜덤*c  (60fps 기준 px/프레임)
    sway: [0.002, 0.004],       // 좌우 흔들림 속도 범위
    swayAmp: 0.3
  };
  function count() {
    return Math.min(SNOW.max, Math.round((W * H) / SNOW.density));
  }
  function make(randomY) {
    const far = Math.random() < 0.35;              // 뒤쪽 눈: 작고 흐리게 → 깊이감
    const r = far ? Math.random() * 1.2 + 1.2 : Math.random() * 2.2 + 2;
    return {
      x: Math.random() * W,
      y: randomY ? Math.random() * H : -10,
      r,
      vy: SNOW.fall[0] + r * SNOW.fall[1] + Math.random() * SNOW.fall[2],
      sway: Math.random() * Math.PI * 2,
      swaySpeed: SNOW.sway[0] + Math.random() * SNOW.sway[1],
      alpha: far ? 0.55 + Math.random() * 0.2 : 0.8 + Math.random() * 0.2
    };
  }
  // 인앱 브라우저(카톡·인스타 등)는 스크롤 시 툴바가 숨으며 창 높이가 매 프레임 바뀜.
  // 그때마다 캔버스를 다시 만들면 화면이 깜빡이고 눈이 늘어나 보이므로,
  // 처음부터 화면 전체 높이로 넉넉히 잡고 가로폭이 바뀔 때만(또는 더 커질 때만) 다시 만듦.
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w === W && h <= H) return;
    const full = h >= w ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    H = Math.max(h, w === W ? H : 0, full || 0);
    W = w;
    canvas.style.height = H + 'px';
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = count();
    while (flakes.length < n) flakes.push(make(true));
    flakes.length = n;
  }

  // 루프는 항상 하나만 돌고, 화면 주사율(60/120Hz)과 상관없이 같은 속도로 내림
  let rafId = 0, last = 0;
  function frame(now) {
    const k = last ? Math.min((now - last) / (1000 / 60), 3) : 1;   // 60fps 기준 배수
    last = now;
    ctx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.vy * k;
      f.sway += f.swaySpeed * k;
      f.x += Math.sin(f.sway) * SNOW.swayAmp * k;
      if (f.y > H + 10) Object.assign(f, make(false));
      // 흰 눈은 아이보리 배경에 묻히므로 옅은 블루 테두리 + 그림자로 윤곽을 줌
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.shadowColor = 'rgba(74,99,133,.55)';
      ctx.shadowBlur = f.r * 2.6;
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(123,152,180,.35)';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    rafId = requestAnimationFrame(frame);
  }
  function start() { if (!rafId) { last = 0; rafId = requestAnimationFrame(frame); } }
  function stop()  { cancelAnimationFrame(rafId); rafId = 0; }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  resize();
  start();
})();

/* Scroll reveal — 섹션 요소가 화면에 들어오면 부드럽게 등장 */
(function () {
  const els = document.querySelectorAll('.reveal, .pop');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  els.forEach(e => io.observe(e));
})();

/* 02 — 달력 + D-day */
(function () {
  const WEDDING = new Date('2027-01-09T11:00:00+09:00');

  // 달력: 2027년 1월
  const grid = document.getElementById('cal-grid');
  if (grid) {
    const y = 2027, m = 0, today = 9;
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();
    let html = ['일', '월', '화', '수', '목', '금', '토']
      .map((d, i) => `<span class="dow${i === 0 ? ' sun' : ''}" role="columnheader">${d}</span>`).join('');
    for (let i = 0; i < first; i++) html += '<span></span>';
    for (let d = 1; d <= last; d++) {
      const dow = (first + d - 1) % 7;
      const cls = [dow === 0 ? 'sun' : '', d === today ? 'on' : ''].join(' ').trim();
      html += `<span${cls ? ` class="${cls}"` : ''}${d === today ? ' aria-label="1월 9일 예식일"' : ''}>${d}</span>`;
    }
    grid.innerHTML = html;
  }

  // D-day
  const clock = document.getElementById('dday-clock');
  const msg = document.getElementById('dday-msg');
  if (!clock || !msg) return;
  const units = {};
  clock.querySelectorAll('b').forEach(b => (units[b.dataset.unit] = b));
  const pad = n => String(n).padStart(2, '0');

  function tick() {
    const diff = WEDDING - Date.now();
    const s = Math.max(0, Math.floor(diff / 1000));
    units.d.textContent = Math.floor(s / 86400);
    units.h.textContent = pad(Math.floor(s / 3600) % 24);
    units.m.textContent = pad(Math.floor(s / 60) % 60);
    units.s.textContent = pad(s % 60);

    // 한국 날짜 기준 남은 일수
    const kst = t => Math.floor((t + 9 * 3600e3) / 86400e3);
    const days = kst(WEDDING.getTime()) - kst(Date.now());        // 달력 기준 남은 날
    const left = Math.floor(s / 86400);                            // 시계와 같은 숫자
    if (days > 1 || (days === 1 && left >= 1)) msg.innerHTML = `종민 <i class="heart">♥</i> 혜린의 결혼식이 <b>${left}</b>일 남았습니다.`;
    else if (days === 1) msg.innerHTML = `내일, 종민 <i class="heart">♥</i> 혜린이 결혼합니다.`;
    else if (days === 0) msg.innerHTML = `오늘, 종민 <i class="heart">♥</i> 혜린이 결혼합니다.`;
    else msg.innerHTML = `종민 <i class="heart">♥</i> 혜린이 결혼한 지 <b>${-days}</b>일이 되었습니다.`;
  }
  tick();
  setInterval(tick, 1000);
})();

/* 03 — 포토부스: 화면에 들어오면 스트립이 내려옴, 누르면 다시 */
(function () {
  const sec = document.getElementById('booth');
  const machine = document.getElementById('booth-machine');
  if (!sec || !machine) return;
  const play = () => {
    sec.classList.remove('is-printing');
    void sec.offsetWidth;            // 애니메이션 재시작
    sec.classList.add('is-printing');
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting) { play(); io.disconnect(); }
    }, { threshold: 0.55 });
    io.observe(machine);
  } else play();
  machine.addEventListener('click', play);
})();

/* 05 — 인물 스티커 이미지가 준비되면 자리표시를 교체 */
(function () {
  document.querySelectorAll('.person__sticker--placeholder[data-src]').forEach(box => {
    const img = new Image();
    img.onload = () => {
      box.classList.remove('person__sticker--placeholder');
      box.textContent = '';
      img.alt = box.closest('.person--bride') ? '신부 장혜린' : '신랑 박종민';
      box.appendChild(img);
    };
    img.src = box.dataset.src;
  });
})();

/* 06 — 갤러리: 3×4 그리드 + 전체화면 뷰어 (스와이프·버튼, 확대 금지) */
window.GALLERY_READY = fetch('assets/gallery/gallery.json', { cache: 'no-cache' })
  .then(r => r.json()).then(d => d.photos)
  .catch(() => Array.from({ length: 36 }, (_, i) => { const n = String(i + 1).padStart(2, '0'); return { full: `assets/gallery/g${n}.webp`, thumb: `assets/gallery/g${n}-t.webp` }; }))
  .then(photos => initGallery(photos));
function initGallery(photos) {
  const COUNT = photos.length;
  return (function () {
  // 사진 목록은 assets/gallery/gallery.json 에서 읽어옴 (사진이 바뀌면 이 파일과 사진만 교체)
  const grid = document.getElementById('gallery-grid');
  const viewer = document.getElementById('viewer');
  if (!grid || !viewer) return;

  // 그리드 (처음 12장, 3×4)
  grid.innerHTML = photos.slice(0, 12).map((p, i) =>
    `<li><button type="button" data-i="${i}" aria-label="${i + 1}번째 사진 크게 보기">` +
    `<img src="${p.thumb}" alt="" draggable="false"></button></li>`).join('');

  const track = document.getElementById('viewer-track');
  const stage = document.getElementById('viewer-stage');
  const count = document.getElementById('viewer-count');
  const prevBtn = document.getElementById('viewer-prev');
  const nextBtn = document.getElementById('viewer-next');
  track.innerHTML = photos.map(() => '<div class="viewer__slide"></div>').join('');
  const slides = track.children;
  let cur = 0, lastFocus = null;

  function load(i) {                          // 현재 ±1장만 불러옴
    if (i < 0 || i >= COUNT || slides[i].firstChild) return;
    const img = new Image();
    img.src = photos[i].full; img.alt = `${i + 1}번째 사진`; img.draggable = false;
    slides[i].appendChild(img);
  }
  function go(i, anim = true) {
    cur = Math.max(0, Math.min(COUNT - 1, i));
    track.classList.toggle('is-anim', anim);
    track.style.transform = `translateX(${-cur * 100}%)`;
    count.textContent = `${cur + 1} / ${COUNT}`;
    prevBtn.disabled = cur === 0;
    nextBtn.disabled = cur === COUNT - 1;
    load(cur); load(cur + 1); load(cur - 1);
  }
  function open(i) {
    lastFocus = document.activeElement;
    viewer.hidden = false;
    document.body.classList.add('is-viewer');
    go(i, false);
    requestAnimationFrame(() => viewer.classList.add('is-open'));
    document.getElementById('viewer-close').focus();
  }
  function close() {
    viewer.classList.remove('is-open');
    document.body.classList.remove('is-viewer');
    setTimeout(() => { viewer.hidden = true; }, 300);
    if (lastFocus) lastFocus.focus();
  }

  grid.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (b) open(+b.dataset.i);
  });
  document.getElementById('gallery-more').addEventListener('click', () => open(0));
  document.getElementById('viewer-close').addEventListener('click', close);
  prevBtn.addEventListener('click', () => go(cur - 1));
  nextBtn.addEventListener('click', () => go(cur + 1));
  document.addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') go(cur - 1);
    if (e.key === 'ArrowRight') go(cur + 1);
  });

  // 스와이프 (손가락을 따라 움직이다가 놓으면 넘어감)
  let x0 = null, y0 = 0, dx = 0, t0 = 0;
  stage.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; t0 = Date.now();
    track.classList.remove('is-anim');
  }, { passive: true });
  stage.addEventListener('touchmove', e => {
    if (e.touches.length > 1) { e.preventDefault(); return; }   // 핀치 확대 차단
    if (x0 === null) return;
    e.preventDefault();
    dx = e.touches[0].clientX - x0;
    const edge = (cur === 0 && dx > 0) || (cur === COUNT - 1 && dx < 0);
    track.style.transform = `translateX(calc(${-cur * 100}% + ${edge ? dx / 3 : dx}px))`;
  }, { passive: false });
  stage.addEventListener('touchend', () => {
    if (x0 === null) return;
    const w = stage.clientWidth, fast = Math.abs(dx) > 40 && Date.now() - t0 < 300;
    if (dx < -w * 0.2 || (fast && dx < 0)) go(cur + 1);
    else if (dx > w * 0.2 || (fast && dx > 0)) go(cur - 1);
    else go(cur);
    x0 = null;
  });
  return photos;
})();
}

/* 사진 확대 차단 — 핀치·더블탭 확대 (iOS Safari는 viewport 설정을 무시하므로 직접 막음) */
(function () {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t =>
    document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let last = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - last < 300 && e.target.closest('.gallery, .viewer')) e.preventDefault();
    last = now;
  }, { passive: false });
})();

/* 08 LOCATION — 진주 펜던트 조명
   식순의 진주가 섹션 맨 위에 닿으면 줄에 매달려 떨어지고(살짝 튕김),
   한두 번 대롱거리다 멈추는 순간 불이 켜지며 Location 타이틀을 은은하게 비춤 */
(function () {
  const lamp = document.getElementById('loc-lamp');
  const arm = document.getElementById('lamp-arm');
  const title = document.getElementById('loc-title');
  if (!lamp || !arm) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CORD = 74, BULB = 46, S0 = 26 / BULB;     // 줄 길이, 조명 크기, 시작 크기(진주 크기)
  let raf = 0, litTimer = 0;

  function set(c, s, deg) {
    arm.style.setProperty('--cord', c.toFixed(1) + 'px');
    arm.style.setProperty('--s', s.toFixed(3));
    arm.style.transform = `rotate(${deg.toFixed(2)}deg)`;
  }
  function lightOn() { lamp.classList.add('is-lit'); title && title.classList.add('is-lit'); }

  function arrive() {
    cancelAnimationFrame(raf); clearTimeout(litTimer);
    lamp.classList.add('is-hung');
    if (reduce) { set(CORD, 1, 0); lightOn(); return; }
    // 줄 길이: 중력으로 떨어지다 끝에서 스프링처럼 한 번 튕김
    let c = 0, v = 0.18, last = null, t0 = null, settled = false;
    const G = 0.0011, K = 0.0011, D = 0.018;
    const A = 8, W = 2 * Math.PI / 950, TAU = 420;  // 흔들림: 처음 8도, 주기 0.95초, 빠르게 잦아듦
    function frame(now) {
      if (t0 === null) { t0 = last = now; }
      let dt = Math.min(32, now - last); last = now;
      for (let i = 0; i < dt; i += 4) {            // 4ms 단위로 계산
        const h = Math.min(4, dt - i);
        const a = c < CORD ? G : -K * (c - CORD) - D * v;
        v += a * h; c += v * h;
        if (c > CORD && Math.abs(v) < 0.002 && Math.abs(c - CORD) < 0.3) { c = CORD; v = 0; }
      }
      const t = now - t0;
      const s = S0 + (1 - S0) * (1 - Math.pow(1 - Math.min(1, t / 380), 3));
      const deg = A * Math.exp(-t / TAU) * Math.sin(W * t);
      set(Math.max(0, c), s, deg);
      if (!settled && t > 1450) { settled = true; set(CORD, 1, 0); lightOn(); return; }
      raf = requestAnimationFrame(frame);
    }
    set(0, S0, 0);
    raf = requestAnimationFrame(frame);
  }
  function leave() {
    cancelAnimationFrame(raf); clearTimeout(litTimer);
    lamp.classList.remove('is-hung', 'is-lit');
    title && title.classList.remove('is-lit');
    set(0, S0, 0);
  }
  set(0, S0, 0);
  document.addEventListener('pearl:arrive', arrive);
  document.addEventListener('pearl:leave', leave);
})();

/* 07 — 식순: 아이콘 사이를 S자로 잇는 길 + 스크롤에 맞춰 내려가는 진주알 */
(function () {
  const track = document.getElementById('order-track');
  if (!track) return;
  const svg = document.getElementById('order-svg');
  const line = document.getElementById('order-line');
  const done = document.getElementById('order-done');
  const pearl = document.getElementById('order-pearl');
  const items = [...track.querySelectorAll('.order__item')];
  let len = 0, nodes = [], y0 = 0, y1 = 0, lastW = -1, lastH = -1;

  // 각 아이콘의 가운데를 지나는 S자 곡선 만들기
  // (무거운 계산이라 식순 영역의 크기가 실제로 바뀔 때만 다시 그림)
  function build(force) {
    const box = track.getBoundingClientRect();
    const W = box.width, H = box.height;
    if (!force && W === lastW && H === lastH) return;
    lastW = W; lastH = H;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pts = items.map(li => {
      const r = li.querySelector('.order__icon').getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
    });
    // 첫 식순 그림에서 시작해 마지막 그림에서 끝남. 곡선 한 구간이 끝나는 곳이 곧 아이콘 자리
    let d = `M ${pts[0].x} ${pts[0].y}`;
    nodes = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], k = (b.y - a.y) * 0.55;
      d += ` C ${a.x} ${a.y + k}, ${b.x} ${b.y - k}, ${b.x} ${b.y}`;
      done.setAttribute('d', d);
      nodes.push(done.getTotalLength());               // 아이콘 위치가 길 위 어디쯤인지(길이)
    }
    line.setAttribute('d', d);
    len = nodes[nodes.length - 1];
    done.style.strokeDasharray = `${len} ${len}`;
    // 마지막 '감사 추첨'에서 끝나지 않고, 오시는길 섹션 맨 위 가운데까지 이어짐
    const loc = document.getElementById('location');
    let last = pts[pts.length - 1];
    if (loc && document.getElementById('loc-lamp')) {
      const lr = loc.getBoundingClientRect();
      const e = { x: lr.left - box.left + lr.width / 2, y: lr.top - box.top };
      const k = (e.y - last.y) * 0.6;
      d += ` C ${last.x} ${last.y + k}, ${e.x} ${e.y - k}, ${e.x} ${e.y}`;
      last = e;
    }
    line.setAttribute('d', d);
    done.setAttribute('d', d);
    len = done.getTotalLength();
    done.style.strokeDasharray = `${len} ${len}`;
    y0 = pts[0].y; y1 = last.y;
    update();
  }

  function update() {
    if (!len) return;
    const r = track.getBoundingClientRect();
    const focus = window.innerHeight * 0.55;              // 화면 가운데보다 조금 아래가 기준
    const t = Math.max(0, Math.min(1, (focus - r.top - y0) / (y1 - y0)));
    const at = t * len;
    const p = line.getPointAtLength(at);
    pearl.style.transform = `translate(${p.x}px, ${p.y}px)`;
    done.style.strokeDashoffset = len - at;
    items.forEach((li, i) => li.classList.toggle('is-on', at >= nodes[i] - 24));
    // 진주가 오시는길 섹션에 닿으면 조명으로 바뀜 (다시 위로 올라가면 진주로 돌아옴)
    const arrived = t >= 0.999;
    if (arrived !== pearlArrived) {
      pearlArrived = arrived;
      pearl.style.opacity = arrived ? 0 : '';
      document.dispatchEvent(new Event(arrived ? 'pearl:arrive' : 'pearl:leave'));
    }
  }
  let pearlArrived = false;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  // 모바일에서 스크롤하면 주소창이 접히며 창 높이가 계속 바뀜 → 창 크기가 아니라 식순 영역 크기를 지켜봄
  if ('ResizeObserver' in window) new ResizeObserver(() => build()).observe(track);
  else window.addEventListener('resize', () => build());
  // 이미지가 다 그려진 뒤 위치 계산
  const imgs = items.map(li => li.querySelector('img'));
  Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => build(true));
  if (document.fonts) document.fonts.ready.then(() => build(true));
  build(true);
})();

/* 공통 — 토스트 · 복사 버튼 */
function toast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('is-on'), 1800);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-copy]'); if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); toast('복사했어요'); }
  catch (_) { toast(b.dataset.copy); }
});

/* 08 — 오시는 길: 탭 + 카카오맵 */
(function () {
  // 카카오 개발자 콘솔의 JavaScript 키 (JavaScript SDK 도메인에 https://daramdean.github.io 등록됨)
  const KAKAO_JS_KEY = 'f952c8508af578b25d755191be7d0c80';
  const KAKAO_TIMEOUT = 7000;                       // 이 시간 안에 카카오 지도 타일이 안 그려지면 구글 지도로 대체
  const VENUE = { name: '콘래드 서울', lat: 37.5254, lng: 126.9266 };

  const tabs = [...document.querySelectorAll('.loc [role="tab"]')];
  if (!tabs.length) return;
  let map = null;
  let kakaoOk = false;      // 카카오 지도 타일이 실제로 그려졌는지
  let embedded = false;     // 구글 지도로 대체했는지
  let timer = 0;

  function select(tab) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (tab.id === 'tab-map') showMap();
  }
  tabs.forEach(t => t.addEventListener('click', () => select(t)));
  tabs.forEach((t, i) => t.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); select(n);
    }
  }));

  function showMap() {
    if (map) { map.relayout(); map.setCenter(new kakao.maps.LatLng(VENUE.lat, VENUE.lng)); return; }
    if (embedded) return;
    if (!KAKAO_JS_KEY) return embed();              // 키가 없으면 키 없이 쓰는 구글 지도 임베드
    if (!timer) timer = setTimeout(() => { if (!kakaoOk) giveUpKakao(); }, KAKAO_TIMEOUT);
    if (window.kakao && kakao.maps && kakao.maps.Map) return draw();
    if (document.getElementById('kakao-sdk')) return;
    const s = document.createElement('script');
    s.id = 'kakao-sdk';
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    s.onload = () => (window.kakao && kakao.maps ? kakao.maps.load(draw) : giveUpKakao());
    s.onerror = giveUpKakao;                         // 키/도메인 오류 등으로 SDK를 못 불러오면 대체
    document.head.appendChild(s);
  }
  // 키·도메인·카카오맵 사용 설정 문제 등으로 지도가 안 그려지면 구글 지도로 바꿔 보여 준다
  function giveUpKakao() {
    if (kakaoOk || embedded) return;
    clearTimeout(timer);
    map = null;
    document.getElementById('kakao-map').innerHTML = '';
    embed();
  }
  function embed() {
    if (map || embedded) return;
    embedded = true;
    const el = document.getElementById('kakao-map');
    const f = document.createElement('iframe');
    f.src = `https://maps.google.com/maps?q=${encodeURIComponent(VENUE.name)}%40${VENUE.lat},${VENUE.lng}&z=16&hl=ko&output=embed`;
    f.title = `${VENUE.name} 위치 지도`;
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.className = 'map__frame';
    f.onload = () => { const fb = document.getElementById('map-fallback'); if (fb) fb.remove(); };
    el.appendChild(f);
  }
  function draw() {
    if (embedded || map) return;
    const el = document.getElementById('kakao-map');
    const pos = new kakao.maps.LatLng(VENUE.lat, VENUE.lng);
    el.innerHTML = '';
    map = new kakao.maps.Map(el, { center: pos, level: 3 });
    kakao.maps.event.addListener(map, 'tilesloaded', () => { kakaoOk = true; clearTimeout(timer); });
    new kakao.maps.Marker({ map, position: pos });
    map.setZoomable(false);                       // 페이지 스크롤 중 지도 확대 방지
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
  }
})();

/* 09 — 계좌: 신랑측/신부측 탭 */
(function () {
  const body = document.getElementById('acct-body');
  if (!body) return;
  const tabs = [...body.querySelectorAll('[role="tab"]')];
  tabs.forEach(t => t.addEventListener('click', () => tabs.forEach(o => {
    const on = o === t;
    o.setAttribute('aria-selected', on); o.tabIndex = on ? 0 : -1;
    document.getElementById(o.getAttribute('aria-controls')).hidden = !on;
  })));
  // 카카오페이 송금 링크가 아직 없을 때
  body.addEventListener('click', e => {
    if (e.target.closest('[data-kp-empty]')) toast('카카오페이 송금 링크를 준비 중이에요');
  });
})();

/* 참석여부 전달하기 — 구글 스프레드시트(Apps Script)로 전송 */
(function () {
  // ▼ Apps Script 웹 앱 배포 후 받은 URL(https://script.google.com/macros/s/…/exec)을 넣어 주세요.
  //   설치 방법은 저장소 루트의 rsvp-apps-script.gs 맨 위 안내 참고
  const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxj4I0raZWPwk3Tl-8N7BlVS4PlDQlbK9H7ugjSOb2tMK7YxliRAICJALfyHu-5Tx3wNA/exec';
  const READY = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(RSVP_ENDPOINT);

  const wrap = document.getElementById('rsvp');
  const form = document.getElementById('rsvp-form');
  const openBtn = document.getElementById('rsvp-open');
  if (!wrap || !form || !openBtn) return;
  const err = document.getElementById('rsvp-err');
  const submit = document.getElementById('rsvp-submit');
  const f = form.elements;   // form.name 은 폼 자체의 속성이라 elements 로 접근
  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    wrap.hidden = false; document.body.classList.add('is-rsvp');
    requestAnimationFrame(() => wrap.classList.add('is-open'));
    try { const saved = localStorage.getItem('rsvp-name'); if (saved && !f.name.value) f.name.value = saved; } catch (_) {}
    setTimeout(() => f.name.focus({ preventScroll: true }), 350);
  }
  function close() {
    wrap.classList.remove('is-open'); document.body.classList.remove('is-rsvp');
    setTimeout(() => { wrap.hidden = true; }, 400);
    err.textContent = '';
    if (lastFocus) lastFocus.focus();
  }
  openBtn.addEventListener('click', open);
  form.addEventListener('input', () => { err.textContent = ''; });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-rsvp-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !wrap.hidden) close(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = f.name.value.replace(/\s+/g, ' ').trim();
    const side = f.side.value, attend = f.attend.value;
    if (!name) { err.textContent = '성함을 입력해 주세요.'; f.name.focus(); return; }
    if (!side) { err.textContent = '구분을 선택해 주세요.'; return; }
    if (!attend) { err.textContent = '참석여부를 선택해 주세요.'; return; }
    err.textContent = '';
    if (!READY) { err.textContent = '아직 전송 준비 중이에요. 잠시 후 다시 시도해 주세요.'; return; }

    submit.disabled = true; submit.textContent = '전달하는 중…';
    try {
      // text/plain 으로 보내면 브라우저 사전 요청(CORS preflight) 없이 Apps Script에 바로 전달됨
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(RSVP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ name, side, attend }),
        redirect: 'follow',
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      const data = await res.json().catch(() => ({ ok: res.ok }));
      if (!data.ok) throw new Error(data.error || 'fail');
      try { localStorage.setItem('rsvp-name', name); } catch (_) {}
      close(); form.reset();
      toast(data.updated ? '참석여부를 새로 고쳤어요. 감사합니다!' : '참석여부를 전달했어요. 감사합니다!');
    } catch (_) {
      err.textContent = '전달하지 못했어요. 잠시 후 다시 시도해 주세요.';
    } finally {
      submit.disabled = false; submit.textContent = '전달하기';
    }
  });
})();

/* 리소스 미리 불러오기
   - 진입 시: 모든 섹션 그림(HTML 이미지는 즉시 로드) + CSS 배경 그림 + 갤러리 대표 12장(썸네일·원본)
   - 그 뒤 여유가 생기면: 나머지 갤러리 원본을 한 장씩 천천히 */
(function () {
  const CSS_BG = ['assets/img/booth-bg.webp', 'assets/img/invite-card.webp', 'assets/img/gallery-stripe.webp'];
  const load = src => new Promise(res => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = src; });
  CSS_BG.forEach(load);

  const slow = navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ''));
  const idle = cb => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 600));

  (window.GALLERY_READY || Promise.resolve([])).then(photos => {
    if (!photos || !photos.length) return;
    photos.slice(0, 12).forEach(p => load(p.full));               // 대표 12장 원본
    if (slow) return;                                             // 데이터 절약 모드에선 여기까지
    window.addEventListener('load', () => {
      let k = 12;
      const next = () => { if (k >= photos.length) return; load(photos[k++].full).then(() => idle(next)); };
      setTimeout(() => idle(next), 2500);                         // 첫 화면이 다 뜬 뒤 천천히 시작
    });
  });
})();

/* 배경음악 — 기본 켜짐: 열자마자 재생 시도, 브라우저가 막으면 첫 터치 때 잔잔한 음량으로 시작, 오른쪽 위 버튼으로 끄고 켜기 */
(function () {
  const audio = document.getElementById('bgm');
  const btn = document.getElementById('bgm-btn');
  if (!audio || !btn) return;
  const VOLUME = 0.25;                        // 잔잔한 음량 (0~1)
  let ctx = null, gain = null, on = false, started = false;
  let wanted = true;                          // 기본은 켜짐 (끄기는 이번 방문에만 적용)

  btn.hidden = false;                                              // iOS는 미리 불러오지 않아 canplay 를 기다리면 버튼이 안 보임
  audio.addEventListener('error', () => { btn.hidden = true; });   // 음악 파일이 없으면 버튼만 숨김

  function setupGain() {                      // iOS는 audio.volume 이 무시돼서 Web Audio 로 음량 조절
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC(); gain = ctx.createGain(); gain.gain.value = 0;
      ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
    } catch (_) { ctx = null; }
  }
  function fade(to, ms) {
    if (gain && ctx) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.linearRampToValueAtTime(to, ctx.currentTime + ms / 1000); }
    else audio.volume = to;
  }
  async function play() {
    setupGain();
    try {
      const resumed = ctx && ctx.state === 'suspended' ? ctx.resume().catch(() => {}) : null;   // 터치 직후 바로 호출 (iOS)
      if (!ctx) audio.volume = 0;
      await audio.play();
      if (resumed) await Promise.race([resumed, new Promise(r => setTimeout(r, 1000))]);
      if (ctx && ctx.state !== 'running') { audio.pause(); return false; }   // 소리 허용 전이면 무음 재생 대신 다음 터치 때
      fade(VOLUME, 2500);
      on = true; btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', '배경음악 끄기');
      return true;
    } catch (_) { return false; /* 자동 재생이 막히면 다음 터치 때 다시 시도 */ }
  }
  function stop() {
    fade(0, 400); setTimeout(() => audio.pause(), 450);
    on = false; btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', '배경음악 켜기');
  }
  btn.addEventListener('click', e => {
    e.stopPropagation(); started = true;
    wanted = !on;
    wanted ? play() : stop();
  });
  // 브라우저 정책상 소리는 사용자의 첫 동작 뒤에만 재생 가능
  const EVENTS = ['pointerup', 'touchend', 'click', 'keydown'];   // 모바일 사파리는 손을 뗄 때(touchend)만 재생을 허용
  const done = () => EVENTS.forEach(t => document.removeEventListener(t, first, true));
  const first = async e => {
    if (e && btn.contains(e.target)) return;                    // 음악 버튼은 자기 처리기에서 담당
    if (started) return done();
    if (!wanted) { started = true; return done(); }
    if (await play()) { started = true; done(); }               // 실패하면 다음 터치 때 다시 시도
  };
  EVENTS.forEach(t => document.addEventListener(t, first, true));
  // 열자마자 자동 재생 시도 — 허용하는 브라우저에선 바로 시작, 막히면 첫 터치 때 시작
  setTimeout(async () => { if (!started && wanted && await play()) { started = true; done(); } }, 300);
  // 화면을 벗어나면 잠시 멈춤
  document.addEventListener('visibilitychange', () => {
    if (!on) return;
    if (document.hidden) audio.pause(); else audio.play().catch(() => {});
  });
})();

/* 맨 위로 — 위로 스크롤할 때만 나타나고, 아래로 내리거나 맨 위 근처면 숨김 */
(function () {
  const btn = document.getElementById('totop'); if (!btn) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_Y = () => window.innerHeight;   // 한 화면 이상 내려왔을 때만
  const DELTA = 8;                          // 손떨림 정도의 작은 움직임은 무시
  const IDLE = 2500;                        // 멈추고 잠시 뒤 자동으로 숨김
  let lastY = window.scrollY, ticking = false, idle = 0, jumping = false;

  function show(on) {
    btn.classList.toggle('is-on', on);
    btn.tabIndex = on ? 0 : -1;
    clearTimeout(idle);
    if (on) idle = setTimeout(() => show(false), IDLE);
  }
  function update() {
    const y = window.scrollY, d = y - lastY;
    if (y < MIN_Y()) { show(false); jumping = false; }
    else if (jumping) { /* 맨 위로 이동 중에는 다시 나타나지 않게 */ }
    else if (d < -DELTA) show(true);
    else if (d > DELTA) show(false);
    if (Math.abs(d) > DELTA || y < MIN_Y()) lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  btn.addEventListener('click', () => {
    show(false); jumping = true;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
})();
