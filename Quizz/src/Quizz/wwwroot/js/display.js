const conn = new signalR.HubConnectionBuilder()
  .withUrl('/hub')
  .withAutomaticReconnect()
  .build();

const content = document.getElementById('content');
let players = [];
let currentPhase = 'Lobby';
let title = 'Quiz';
let joinUrl = '';

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function render(html) { content.innerHTML = html; }

fetch('/api/title').then(r => r.json()).then(d => {
  title = d.title;
  document.title = title;
  if (currentPhase === 'Lobby') renderLobby();
});

fetch('/api/joinurl').then(r => r.json()).then(d => {
  joinUrl = d.url;
  if (currentPhase === 'Lobby') renderLobby();
});

function renderLobby() {
  const qrSrc = '/api/qrcode';
  render(`
    <h1>${escapeHtml(title)}</h1>
    <div class="lobby-join">
      <img class="qr" src="${qrSrc}" alt="QR code pour rejoindre" />
      <div class="lobby-instructions">
        <p>Scanne le QR code</p>
        <p class="muted">ou ouvre <strong>${escapeHtml(joinUrl)}</strong></p>
      </div>
    </div>
    <h2>${players.length} joueur${players.length > 1 ? 's' : ''}</h2>
    <div class="player-grid">
      ${players.map(p => `<div class="player-bubble">${escapeHtml(p.pseudo)}</div>`).join('')}
    </div>
  `);
}

conn.on('playerList', list => {
  players = list;
  if (currentPhase === 'Lobby') renderLobby();
});

conn.on('phaseChanged', phase => {
  currentPhase = phase;
  if (phase === 'Lobby') renderLobby();
});

conn.on('questionStarted', q => {
  const colsClass = q.options.length === 1 ? 'cols-1' : q.options.length === 3 ? 'cols-3' : '';
  render(`
    <div class="question-meta">Question ${q.index + 1} / ${q.total}</div>
    <h2 class="question-text">${escapeHtml(q.text)}</h2>
    <div class="big-options ${colsClass}" id="big-opts">
      ${q.options.map((o, i) => `
        <div class="big-option opt-${i}" data-i="${i}">
          <span class="num">${i + 1}</span>
          <span class="label">${escapeHtml(o)}</span>
        </div>
      `).join('')}
    </div>
    <div class="timer-bar">
      <div class="timer-fill" style="animation-duration: ${q.timeLimit}s"></div>
    </div>
    <div class="answer-count" id="answer-count">0 / ${players.length} réponses</div>
  `);
});

conn.on('answerCount', d => {
  const el = document.getElementById('answer-count');
  if (el) el.textContent = `${d.answered} / ${d.total} réponses`;
});

conn.on('answerRevealed', d => {
  const opts = document.querySelectorAll('.big-option');
  opts.forEach((el, i) => {
    if (i === d.correctIndex) el.classList.add('correct');
    else el.classList.add('wrong');
    const c = d.counts[i] || 0;
    const span = document.createElement('span');
    span.className = 'count';
    span.textContent = c;
    el.appendChild(span);
  });
});

conn.on('leaderboard', top => {
  render(`
    <h1>Classement</h1>
    <ol class="leaderboard-display">
      ${top.map(p => `
        <li class="rank-${p.rank}">
          <span class="rank">${p.rank}</span>
          <span class="name">${escapeHtml(p.pseudo)}</span>
          <span class="score">${p.score} pts</span>
          ${p.lastQuestionGain ? `<span class="gain">+${p.lastQuestionGain}</span>` : ''}
        </li>
      `).join('')}
    </ol>
  `);
});

conn.on('finalLeaderboard', top => {
  render(`
    <h1>🏆 Classement final</h1>
    <ol class="leaderboard-display">
      ${top.map(p => `
        <li class="rank-${p.rank}">
          <span class="rank">${p.rank}</span>
          <span class="name">${escapeHtml(p.pseudo)}</span>
          <span class="score">${p.score} pts</span>
        </li>
      `).join('')}
    </ol>
  `);
});

conn.start()
  .then(() => conn.invoke('RegisterDisplay'))
  .catch(err => console.error(err));
