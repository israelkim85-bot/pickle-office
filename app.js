/* 민수 AI 오피스 — pickle-office Firestore 연동 PWA */
(function () {
  'use strict';

  /* ── Firebase 설정 (공개 클라이언트 설정) ── */
  const firebaseConfig = {
    apiKey: 'AIzaSyAc9O77pmZkBmoThTysqMiknd-cDG-QRIs',
    authDomain: 'pickle-office.firebaseapp.com',
    projectId: 'pickle-office',
    storageBucket: 'pickle-office.firebasestorage.app',
    messagingSenderId: '525719336167',
    appId: '1:525719336167:web:ce36d6ada504c3df665e42'
  };

  /* 컬렉션에 문서가 없을 때 쓰는 기본 표시값 */
  const AGENT_META = {
    pickle:  { emoji: '🧡', color: '#fbe6cd', name: '솜찬대디', role: '민수님 전용 비서 · 사역·일상 총괄' },
    muse:    { emoji: '🖥️', color: '#e6e9f7', name: '뮤즈',     role: 'PC 오케스트레이션 총괄' },
    muse3:   { emoji: '📱', color: '#e4ecf8', name: '뮤즈 3호기', role: '스톡·이모티콘·블로그 채널' },
    musech:  { emoji: '💠', color: '#e2f2f4', name: '뮤즈 CH',   role: '콘텐츠·채널 운영' },
    keyring: { emoji: '🔑', color: '#f7ebe4', name: '키링',      role: '설문·기프티콘·주문/배송' },
    buoy:    { emoji: '🛟', color: '#e9f0e6', name: '부이',      role: '재정·지원금·출석체크' },
    boss:    { emoji: '👤', color: '#f6e7d4', name: '대장님',    role: '민수님' }
  };

  const state = {
    view: 'meeting',
    room: 'lobby',
    rooms: {},
    agents: [],
    messages: [],
    memos: [],
    limits: [],
    events: [],
    lotto: [],
    status: 'connecting', // connecting | live | down
    calCursor: new Date(),
    calSelected: null,
    draw: null,
    lastSnapAt: null
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  const dateKey = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  function toDate(v) {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate();
    if (v instanceof Date) return v;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtTime(v) {
    var d = toDate(v);
    if (!d) return '방금';
    var h = d.getHours(), ap = h < 12 ? '오전' : '오후';
    h = h % 12; if (h === 0) h = 12;
    return ap + ' ' + h + ':' + pad(d.getMinutes());
  }
  function fmtShort(v) {
    var d = toDate(v);
    if (!d) return '';
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + fmtTime(d);
  }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  /* ── 토스트 ── */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  /* ── 모달 ── */
  var modalSubmit = null;
  function openModal(title, fields, onSubmit) {
    $('#modalTitle').textContent = title;
    var body = $('#modalBody');
    body.innerHTML = '';
    fields.forEach(function (f) {
      var el;
      if (f.type === 'select') {
        el = document.createElement('select');
        (f.options || []).forEach(function (o) {
          var op = document.createElement('option');
          op.value = o.value; op.textContent = o.label;
          if (o.value === f.value) op.selected = true;
          el.appendChild(op);
        });
      } else {
        el = document.createElement('input');
        el.type = f.type || 'text';
        el.placeholder = f.placeholder || '';
        if (f.value != null) el.value = f.value;
        if (f.type === 'number') { el.min = '0'; el.inputMode = 'numeric'; }
      }
      el.id = 'mf_' + f.name;
      if (f.label) {
        var lab = document.createElement('label');
        lab.textContent = f.label;
        lab.style.cssText = 'font-size:12.5px;font-weight:700;color:var(--ink-3)';
        body.appendChild(lab);
      }
      body.appendChild(el);
    });
    modalSubmit = function () {
      var values = {};
      fields.forEach(function (f) {
        var el = $('#mf_' + f.name);
        values[f.name] = el ? el.value : '';
      });
      return onSubmit(values);
    };
    $('#modal').hidden = false;
    var first = body.querySelector('input,select');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }
  function closeModal() { $('#modal').hidden = true; modalSubmit = null; }

  /* ── Firebase ── */
  var db = null;
  function initFirebase() {
    try {
      if (typeof firebase === 'undefined') throw new Error('SDK 미로드');
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      try {
        db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
      } catch (e) { /* 사파리 사설모드 등 */ }
      return true;
    } catch (e) {
      console.error(e);
      setStatus('down');
      return false;
    }
  }

  function setStatus(s) {
    state.status = s;
    var pill = $('#serverPill'), stateEl = $('#serverState'), dot = $('#ownerDot'), label = $('.server-label');
    pill.classList.toggle('is-live', s === 'live');
    pill.classList.toggle('is-down', s === 'down');
    if (s === 'live') { stateEl.textContent = 'ON'; label.textContent = 'AI 서버'; }
    else if (s === 'down') { stateEl.textContent = 'OFF'; label.textContent = 'AI 서버'; }
    else { stateEl.textContent = '···'; }
    dot.classList.toggle('off', s !== 'live');
  }

  function norm(doc) {
    var d = doc.data() || {};
    return { id: doc.id, data: d };
  }

  function listen() {
    if (!db) return;
    var any = false;
    function ok() { if (!any) { any = true; } setStatus('live'); state.lastSnapAt = Date.now(); }
    function fail(err) {
      console.error('listen error', err);
      if (!any) setStatus('down');
    }

    db.collection('rooms').onSnapshot(function (snap) {
      var map = {};
      snap.forEach(function (doc) { map[doc.id] = doc.data() || {}; });
      state.rooms = map;
      ok(); renderRoomMeta(); renderDashboard();
    }, fail);

    db.collection('agents').onSnapshot(function (snap) {
      var list = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        list.push({
          id: doc.id,
          displayName: d.displayName || (AGENT_META[doc.id] || {}).name || doc.id,
          role: d.role || (AGENT_META[doc.id] || {}).role || '',
          emoji: d.emoji || (AGENT_META[doc.id] || {}).emoji || '🤖',
          color: d.color || (AGENT_META[doc.id] || {}).color || '#e6e9f7',
          online: !!d.online,
          order: typeof d.order === 'number' ? d.order : 99,
          lastSeenAt: d.lastSeenAt
        });
      });
      list.sort(function (a, b) { return a.order - b.order; });
      state.agents = list;
      ok(); renderRoomMeta(); renderAgents(); renderFloor(); renderDashboard();
    }, fail);

    db.collection('messages').orderBy('createdAt', 'desc').limit(300).onSnapshot(function (snap) {
      var list = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        list.push({
          id: doc.id,
          roomId: d.roomId || 'lobby',
          agent: d.agent || 'muse',
          author: d.author || '',
          text: d.text || '',
          type: d.type || 'text',
          createdAt: toDate(d.createdAt)
        });
      });
      list.sort(function (a, b) {
        var ta = a.createdAt ? a.createdAt.getTime() : Date.now();
        var tb = b.createdAt ? b.createdAt.getTime() : Date.now();
        return ta - tb;
      });
      state.messages = list;
      ok(); renderChat(); renderDashboard();
    }, fail);

    db.collection('memos').orderBy('createdAt', 'desc').limit(60).onSnapshot(function (snap) {
      var list = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        list.push({ id: doc.id, text: d.text || '', agent: d.agent || 'pickle', createdAt: toDate(d.createdAt) });
      });
      state.memos = list;
      ok(); renderMemos(); renderDashboard();
    }, fail);

    db.collection('limits').onSnapshot(function (snap) {
      var list = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        list.push({ id: doc.id, used: Number(d.used || 0), total: Number(d.total || 0), label: d.label || '' });
      });
      state.limits = list;
      ok(); renderLimits();
    }, fail);

    db.collection('events').onSnapshot(function (snap) {
      var list = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        if (d.date) list.push({ id: doc.id, date: d.date, title: d.title || '(제목 없음)', agent: d.agent || 'pickle' });
      });
      state.events = list;
      ok(); renderCalendar();
    }, fail);

    db.collection('lotto').orderBy('createdAt', 'desc').limit(20).onSnapshot(function (snap) {
      var list = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        list.push({ id: doc.id, numbers: d.numbers || [], createdAt: toDate(d.createdAt) });
      });
      state.lotto = list;
      ok(); renderLotto();
    }, fail);
  }

  /* ── 공용 렌더 ── */
  function agentOf(id) {
    var found = null;
    state.agents.forEach(function (a) { if (a.id === id) found = a; });
    if (found) return found;
    var m = AGENT_META[id] || AGENT_META.muse;
    return { id: id, displayName: id === 'boss' ? '대장님' : (m.name || id), emoji: m.emoji, color: m.color, role: m.role, online: false };
  }
  function onlineCount() { return state.agents.filter(function (a) { return a.online; }).length; }

  function renderRoomMeta() {
    var r = state.rooms[state.room] || {};
    var emoji = r.emoji || (state.room === 'lobby' ? '🏛️' : state.room === 'command' ? '🩵' : '☕');
    var name = r.name || (state.room === 'lobby' ? '대회의실' : state.room === 'command' ? '지휘실' : '라운지');
    var desc = r.description || '공모전 · 프로젝트';
    $('#roomMeta').textContent = emoji + ' ' + name + ' · ' + desc + ' · ON ' + onlineCount() + '명';
  }

  function renderChat() {
    var box = $('#chatList');
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    var msgs = state.messages.filter(function (m) { return m.roomId === state.room; });
    if (!msgs.length) {
      box.innerHTML = '<div class="chat-empty"><strong>아직 대화가 없습니다</strong>아래 입력창에 지시를 한 줄 남겨 보세요.<br>@all 을 붙이면 전원에게 전달됩니다.</div>';
      return;
    }
    var html = msgs.slice(-120).map(function (m) {
      var a = agentOf(m.agent);
      var isMe = m.agent === 'boss';
      var name = isMe ? '대장님' : (m.author || a.displayName);
      return '<div class="msg' + (isMe ? ' is-me' : '') + '">' +
        '<div class="msg-avatar" style="background:' + esc(a.color) + '">' + a.emoji + '</div>' +
        '<div class="msg-body">' +
        '<div class="msg-head"><span class="msg-name">' + esc(name) + '</span>' +
        '<span class="msg-time">' + fmtTime(m.createdAt) + '</span></div>' +
        '<div class="msg-bubble">' + esc(m.text) + '</div>' +
        '</div></div>';
    }).join('');
    box.innerHTML = html;
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }

  function renderAgents() {
    var box = $('#agentList');
    if (!state.agents.length) {
      box.innerHTML = '<div class="empty">참여 에이전트 정보를 불러오는 중입니다.<br>agents 컬렉션이 비어 있으면 시드가 필요합니다.</div>';
      return;
    }
    box.innerHTML = state.agents.map(function (a) {
      return '<div class="agent-card">' +
        '<div class="agent-emoji" style="background:' + esc(a.color) + '">' + a.emoji + '</div>' +
        '<div><div class="agent-name">' + esc(a.displayName) + '</div>' +
        '<div class="agent-role">' + esc(a.role) + '</div></div>' +
        '<div class="agent-state' + (a.online ? ' on' : '') + '"><i></i>' + (a.online ? '근무 중' : '대기') + '</div>' +
        '</div>';
    }).join('');
  }

  function renderFloor() {
    var box = $('#floorMap');
    if (!state.agents.length) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1">에이전트 위치를 불러오는 중입니다.</div>';
      return;
    }
    box.innerHTML = state.agents.map(function (a) {
      return '<div class="floor-node">' +
        '<span class="fn-emoji">' + a.emoji + '</span>' +
        '<div><div class="fn-name">' + esc(a.displayName) + '</div>' +
        '<div class="fn-role">' + esc(a.role) + '</div></div>' +
        '<span class="fn-dot' + (a.online ? ' on' : '') + '"></span>' +
        '</div>';
    }).join('');
  }

  function renderDashboard() {
    var now = new Date();
    var todayMsgs = state.messages.filter(function (m) { return m.createdAt && sameDay(m.createdAt, now); });
    var stats = [
      { n: onlineCount() + '/' + state.agents.length, l: '근무 중 에이전트' },
      { n: String(todayMsgs.length), l: '오늘 메시지' },
      { n: String(state.memos.length), l: '저장된 메모' },
      { n: String(state.events.length), l: '등록된 일정' }
    ];
    $('#statGrid').innerHTML = stats.map(function (s) {
      return '<div class="stat"><b>' + esc(s.n) + '</b><span>' + esc(s.l) + '</span></div>';
    }).join('');

    var rooms = ['lobby', 'command', 'lounge'];
    var max = 1;
    var counts = rooms.map(function (r) {
      var c = state.messages.filter(function (m) { return m.roomId === r; }).length;
      if (c > max) max = c;
      return { id: r, c: c };
    });
    $('#roomBars').innerHTML = counts.map(function (x) {
      var r = state.rooms[x.id] || {};
      var nm = (r.emoji || '💬') + ' ' + (r.name || x.id);
      return '<div class="room-bar"><div class="rb-head"><span>' + esc(nm) + '</span><span>' + x.c + '건</span></div>' +
        '<div class="rb-track"><div class="rb-fill" style="width:' + Math.round((x.c / max) * 100) + '%"></div></div></div>';
    }).join('');

    var recent = state.messages.slice(-6).reverse();
    $('#activityList').innerHTML = recent.length ? recent.map(function (m) {
      var a = agentOf(m.agent);
      var who = m.agent === 'boss' ? '대장님' : (m.author || a.displayName);
      return '<div class="act"><span>' + a.emoji + '</span><div style="min-width:0"><div class="act-who">' + esc(who) + '</div>' +
        '<div class="act-text">' + esc(m.text.slice(0, 60)) + (m.text.length > 60 ? '…' : '') + '</div></div>' +
        '<span class="act-time">' + fmtTime(m.createdAt) + '</span></div>';
    }).join('') : '<div class="empty">아직 활동 기록이 없습니다.</div>';
  }

  function renderCalendar() {
    var cur = state.calCursor;
    var y = cur.getFullYear(), m = cur.getMonth();
    $('#calLabel').textContent = y + '년 ' + (m + 1) + '월';
    var first = new Date(y, m, 1);
    var startDow = first.getDay();
    var last = new Date(y, m + 1, 0).getDate();
    var prevLast = new Date(y, m, 0).getDate();
    var today = new Date();
    var sel = state.calSelected;
    var html = WEEK.map(function (w, i) { return '<div class="cal-dow' + (i === 0 ? ' sun' : '') + '">' + w + '</div>'; }).join('');

    var cells = [];
    for (var i = 0; i < startDow; i++) cells.push({ d: prevLast - startDow + 1 + i, mute: true, date: null });
    for (var day = 1; day <= last; day++) cells.push({ d: day, mute: false, date: new Date(y, m, day) });
    var tail = (7 - (cells.length % 7)) % 7;
    for (var j = 1; j <= tail; j++) cells.push({ d: j, mute: true, date: null });

    html += cells.map(function (c) {
      var key = c.date ? dateKey(c.date) : '';
      var has = key && state.events.some(function (e) { return e.date === key; });
      var cls = 'cal-cell';
      if (c.mute) cls += ' mute';
      if (c.date && c.date.getDay() === 0) cls += ' sun';
      if (c.date && sameDay(c.date, today)) cls += ' today';
      if (key && sel === key) cls += ' sel';
      return '<button type="button" class="' + cls + '" data-date="' + key + '">' + c.d +
        (has ? '<span class="ev"></span>' : '') + '</button>';
    }).join('');
    $('#calGrid').innerHTML = html;

    var monthKey = y + '-' + pad(m + 1);
    var list = state.events.filter(function (e) { return e.date.indexOf(monthKey) === 0; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    $('#eventList').innerHTML = list.length ? list.map(function (e) {
      return '<div class="event-item"><span class="ev-date">' + esc(e.date.slice(5).replace('-', '/')) + '</span>' +
        '<span class="ev-title">' + esc(e.title) + '</span>' +
        '<button class="ev-del" data-del-event="' + esc(e.id) + '" aria-label="삭제">✕</button></div>';
    }).join('') : '<div class="empty">이번 달에 등록된 일정이 없습니다.</div>';
  }

  function renderLimits() {
    var box = $('#limitList');
    if (!state.limits.length) {
      box.innerHTML = '<div class="empty">아직 기록이 없습니다.<br>아래 버튼으로 에이전트별 사용량을 기록하면<br>막대그래프로 보여 드립니다.</div>';
      return;
    }
    box.innerHTML = state.limits.map(function (l) {
      var a = agentOf(l.id);
      var pct = l.total > 0 ? Math.min(100, Math.round((l.used / l.total) * 100)) : 0;
      var cls = pct >= 90 ? ' hot' : pct >= 70 ? ' warn' : '';
      return '<div class="limit"><div class="lm-head">' + a.emoji + ' ' + esc(l.label || a.displayName) +
        '<span>' + l.used.toLocaleString() + ' / ' + l.total.toLocaleString() + ' (' + pct + '%)</span></div>' +
        '<div class="lm-track"><div class="lm-fill' + cls + '" style="width:' + pct + '%"></div></div></div>';
    }).join('');
  }

  function ballClass(n) {
    if (n <= 10) return 'g1';
    if (n <= 20) return 'g2';
    if (n <= 30) return 'g3';
    if (n <= 40) return 'g4';
    return 'g5';
  }
  function renderLotto() {
    var box = $('#lottoBalls');
    var nums = state.draw;
    box.innerHTML = (nums || [null, null, null, null, null, null]).map(function (n) {
      return n == null ? '<div class="ball">?</div>' : '<div class="ball ' + ballClass(n) + '">' + n + '</div>';
    }).join('');
    $('#saveLottoBtn').disabled = !nums;
    var list = state.lotto;
    $('#lottoList').innerHTML = list.length ? list.map(function (l) {
      return '<div class="event-item"><span class="ev-date">' + fmtShort(l.createdAt) + '</span>' +
        '<span class="ev-title">' + (l.numbers || []).join(' · ') + '</span>' +
        '<button class="ev-del" data-del-lotto="' + esc(l.id) + '" aria-label="삭제">✕</button></div>';
    }).join('') : '<div class="empty">저장된 번호가 없습니다.</div>';
  }

  function renderMemos() {
    var box = $('#memoList');
    if (!state.memos.length) {
      box.innerHTML = '<div class="empty">위 칸에 한 줄 메모를 남겨 보세요.<br>memos 컬렉션에 저장되고 모든 기기에서 보입니다.</div>';
      return;
    }
    box.innerHTML = state.memos.map(function (m) {
      var a = agentOf(m.agent);
      return '<div class="memo"><button class="memo-del" data-del-memo="' + esc(m.id) + '" aria-label="삭제">✕</button>' +
        '<div class="memo-text">' + esc(m.text) + '</div>' +
        '<div class="memo-foot"><span>' + a.emoji + ' ' + esc(a.displayName) + '</span><span>·</span><span>' + fmtShort(m.createdAt) + '</span></div></div>';
    }).join('');
  }

  /* ── 화면 전환 ── */
  function showView(view) {
    state.view = view;
    $$('.view').forEach(function (s) { s.hidden = s.id !== 'view-' + view; });
    $$('.menu-item').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-view') === view); });
    var bottomMap = { meeting: 'meeting', agents: 'agents', memos: 'memos' };
    $$('.tab').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-bottom') === bottomMap[view]); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setRoom(room) {
    state.room = room;
    $$('.subtab').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-room') === room); });
    renderRoomMeta(); renderChat();
  }

  /* ── 쓰기 ── */
  function sendMessage(text) {
    text = (text || '').trim();
    if (!text) return;
    if (!db) { toast('AI 서버에 연결되지 않았습니다.'); return; }
    var payload = {
      roomId: state.room,
      agent: 'boss',
      author: '대장님',
      text: text,
      type: 'text',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('messages').add(payload).then(function () {
      db.collection('rooms').doc(state.room).set({
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(function () {});
      if (text.indexOf('@all') >= 0) toast('전원에게 전달했습니다.');
    }).catch(function (err) {
      console.error(err);
      toast('전송 실패: ' + (err.code || '권한 또는 네트워크 확인'));
    });
  }

  /* ── 이벤트 연결 ── */
  function bind() {
    $$('.menu-item').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
    });
    $$('.tab').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.getAttribute('data-bottom')); });
    });
    $$('.subtab').forEach(function (b) {
      b.addEventListener('click', function () { setRoom(b.getAttribute('data-room')); });
    });

    $('#composer').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#msgInput');
      sendMessage(input.value);
      input.value = '';
      $('#quickRow').hidden = true;
    });

    var quick = ['@all 출근 보고 부탁합니다', '@all 오늘 현황 정리해서 보고', '잠시 10분 쉬어 갑시다', '@all 작업 우선순위 확인'];
    $('#quickRow').innerHTML = quick.map(function (q) {
      return '<button type="button" class="quick-chip">' + esc(q) + '</button>';
    }).join('');
    $$('#quickRow .quick-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        $('#msgInput').value = b.textContent;
        $('#msgInput').focus();
      });
    });
    $('#plusBtn').addEventListener('click', function () { $('#quickRow').hidden = !$('#quickRow').hidden; });

    $('#serverPill').addEventListener('click', function () {
      var t = state.status === 'live' ? 'pickle-office 연결됨 · 실시간 수신 중'
        : state.status === 'down' ? 'AI 서버 연결 실패 — 보안 규칙 만료(2026-12-26)나 네트워크 확인'
        : '연결 중…';
      toast(t);
    });

    $('#themeBtn').addEventListener('click', function () {
      document.body.classList.toggle('dim');
      var dim = document.body.classList.contains('dim');
      $('#themeBtn').textContent = dim ? '🌙' : '☀️';
      document.querySelector('meta[name="theme-color"]').setAttribute('content', dim ? '#241c16' : '#f5ede0');
    });

    /* 캘린더 */
    $('#calPrev').addEventListener('click', function () {
      state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() - 1, 1);
      renderCalendar();
    });
    $('#calNext').addEventListener('click', function () {
      state.calCursor = new Date(state.calCursor.getFullYear(), state.calCursor.getMonth() + 1, 1);
      renderCalendar();
    });
    $('#calGrid').addEventListener('click', function (e) {
      var b = e.target.closest('.cal-cell');
      if (!b || !b.getAttribute('data-date')) return;
      state.calSelected = b.getAttribute('data-date');
      renderCalendar();
    });
    $('#addEventBtn').addEventListener('click', function () {
      var d = state.calSelected || dateKey(new Date());
      openModal('일정 추가', [
        { name: 'date', type: 'date', label: '날짜', value: d },
        { name: 'title', type: 'text', label: '일정', placeholder: '예: 1청년부 소그룹 모임' }
      ], function (v) {
        if (!v.title.trim()) { toast('일정을 입력해 주세요.'); return false; }
        db.collection('events').add({
          date: v.date, title: v.title.trim(), agent: 'pickle',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () { toast('일정을 저장했습니다.'); })
          .catch(function () { toast('저장 실패'); });
        return true;
      });
    });
    $('#eventList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-event]');
      if (!b) return;
      if (!confirm('이 일정을 삭제할까요?')) return;
      db.collection('events').doc(b.getAttribute('data-del-event')).delete()
        .then(function () { toast('삭제했습니다.'); })
        .catch(function () { toast('삭제 실패'); });
    });

    /* 한도 */
    $('#addLimitBtn').addEventListener('click', function () {
      openModal('사용량 기록', [
        { name: 'agent', type: 'select', label: '에이전트', options: (state.agents.length ? state.agents : Object.keys(AGENT_META).filter(function (k) { return k !== 'boss'; }).map(function (k) { return { id: k, displayName: AGENT_META[k].name }; })).map(function (a) { return { value: a.id, label: a.displayName }; }) },
        { name: 'used', type: 'number', label: '사용량', placeholder: '0' },
        { name: 'total', type: 'number', label: '한도', placeholder: '100' }
      ], function (v) {
        var used = Number(v.used || 0), total = Number(v.total || 0);
        if (!total) { toast('한도를 입력해 주세요.'); return false; }
        db.collection('limits').doc(v.agent).set({ used: used, total: total, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
          .then(function () { toast('기록했습니다.'); })
          .catch(function () { toast('저장 실패'); });
        return true;
      });
    });

    /* 로또 */
    $('#drawBtn').addEventListener('click', function () {
      var pool = [];
      for (var i = 1; i <= 45; i++) pool.push(i);
      var pick = [];
      for (var k = 0; k < 6; k++) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      pick.sort(function (a, b) { return a - b; });
      state.draw = pick;
      renderLotto();
    });
    $('#saveLottoBtn').addEventListener('click', function () {
      if (!state.draw || !db) return;
      db.collection('lotto').add({ numbers: state.draw, agent: 'pickle', createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(function () { toast('번호를 저장했습니다.'); })
        .catch(function () { toast('저장 실패'); });
    });
    $('#lottoList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-lotto]');
      if (!b) return;
      if (!confirm('이 번호를 삭제할까요?')) return;
      db.collection('lotto').doc(b.getAttribute('data-del-lotto')).delete().catch(function () { toast('삭제 실패'); });
    });

    /* 메모 */
    $('#memoForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#memoInput');
      var text = input.value.trim();
      if (!text || !db) return;
      db.collection('memos').add({ text: text, agent: 'boss', createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        .then(function () { input.value = ''; toast('메모를 저장했습니다.'); })
        .catch(function () { toast('저장 실패'); });
    });
    $('#memoList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-del-memo]');
      if (!b) return;
      if (!confirm('이 메모를 삭제할까요?')) return;
      db.collection('memos').doc(b.getAttribute('data-del-memo')).delete().catch(function () { toast('삭제 실패'); });
    });

    /* 모달 */
    $('#modalCancel').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
    $('#modalOk').addEventListener('click', function () {
      if (!modalSubmit) return closeModal();
      var ok = modalSubmit();
      if (ok !== false) closeModal();
    });
  }

  function boot() {
    bind();
    setStatus('connecting');
    state.calSelected = dateKey(new Date());
    renderRoomMeta(); renderChat(); renderAgents(); renderFloor();
    renderDashboard(); renderCalendar(); renderLimits(); renderLotto(); renderMemos();
    if (initFirebase()) { listen(); } else { toast('Firebase를 불러오지 못했습니다.'); }

    window.addEventListener('online', function () { if (db) setStatus('connecting'); });
    window.addEventListener('offline', function () { setStatus('down'); });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && state.status === 'down' && db && navigator.onLine) setStatus('connecting');
    });

    /* 매니페스트 바로가기: ?room=lobby|command|lounge, ?view=memos|agents */
    try {
      var q = new URLSearchParams(location.search);
      var room = q.get('room');
      if (room && ['lobby', 'command', 'lounge'].indexOf(room) >= 0) { setRoom(room); showView('meeting'); }
      var view = q.get('view');
      if (view && ['meeting', 'map', 'dashboard', 'calendar', 'limits', 'lotto', 'agents', 'memos'].indexOf(view) >= 0) showView(view);
    } catch (e) { /* 구형 브라우저 */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
