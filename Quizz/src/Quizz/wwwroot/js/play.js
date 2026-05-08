function getCookie(name) {
  const v = document.cookie.split('; ').find(r => r.startsWith(name + '='));
  return v ? v.split('=')[1] : null;
}

const playerId = getCookie('playerId');
const pseudo = localStorage.getItem('pseudo');

if (!playerId || !pseudo) {
  location.href = '/';
  throw new Error('Pas de session, redirection');
}

document.getElementById('my-pseudo').textContent = pseudo;
const myScoreEl = document.getElementById('my-score');
const content = document.getElementById('content');
let myScore = 0;
let timerInterval;

function render(html) { content.innerHTML = html; }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function startCountdown(seconds) {
  clearInterval(timerInterval);
  const el = document.getElementById('timer');
  let rem = seconds;
  timerInterval = setInterval(() => {
    rem--;
    if (el) el.textContent = `${Math.max(0, rem)}s`;
    if (rem <= 0) clearInterval(timerInterval);
  }, 1000);
}

const conn = new signalR.HubConnectionBuilder()
  .withUrl('/hub')
  .withAutomaticReconnect()
  .build();

conn.on('registered', d => {
  myScore = d.score;
  myScoreEl.textContent = `${myScore} pts`;
});

conn.on('phaseChanged', phase => {
  if (phase === 'Lobby') render(`<div class="waiting">Le quiz va bientôt commencer...</div>`);
  if (phase === 'Finished') render(`<div class="waiting">Quiz terminé !<br>Score final : <strong>${myScore} pts</strong></div>`);
});

conn.on('questionStarted', q => {
  const optionsHtml = q.options.map((opt, i) =>
    `<button class="option opt-${i}" data-i="${i}">${escapeHtml(opt)}</button>`
  ).join('');
  render(`
    <div class="question-meta">Question ${q.index + 1} / ${q.total}</div>
    <div class="question-text">${escapeHtml(q.text)}</div>
    <div class="options">${optionsHtml}</div>
    <div class="timer" id="timer">${q.timeLimit}s</div>
  `);
  document.querySelectorAll('.option').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.option').forEach(x => x.disabled = true);
      b.classList.add('selected');
      conn.invoke('SubmitAnswer', parseInt(b.dataset.i));
    });
  });
  startCountdown(q.timeLimit);
});

conn.on('answerAccepted', () => {
  const t = document.getElementById('timer');
  if (t) t.textContent = 'Réponse envoyée';
});

conn.on('yourResult', r => {
  clearInterval(timerInterval);
  myScore = r.score;
  myScoreEl.textContent = `${myScore} pts`;
  const html = r.correct
    ? `<div class="result correct">✓ Bonne réponse<br><small>+${r.lastQuestionGain} pts</small></div>`
    : (r.yourAnswer === null || r.yourAnswer === undefined
        ? `<div class="result wrong">⏱ Trop tard</div>`
        : `<div class="result wrong">✗ Mauvaise réponse</div>`);
  render(html + `<div class="total">Total : <strong>${myScore} pts</strong></div>`);
});

conn.on('leaderboard', top => {
  const inTop = top.find(p => p.id === playerId);
  const items = top.map(p =>
    `<li><span>${p.rank}. ${escapeHtml(p.pseudo)}</span><span>${p.score} pts</span></li>`
  ).join('');
  const myLine = inTop
    ? `<div class="my-rank">Tu es ${inTop.rank}${inTop.rank === 1 ? 'er' : 'ème'} !</div>`
    : `<div class="my-rank">Hors top 5 — ${myScore} pts</div>`;
  render(`<h2 style="text-align:center">Top 5</h2><ol class="leaderboard">${items}</ol>${myLine}`);
});

conn.on('finalLeaderboard', top => {
  const inTop = top.find(p => p.id === playerId);
  const items = top.map(p =>
    `<li><span>${p.rank}. ${escapeHtml(p.pseudo)}</span><span>${p.score} pts</span></li>`
  ).join('');
  render(`
    <h2 style="text-align:center">🏆 Classement final</h2>
    <ol class="leaderboard">${items}</ol>
    <div class="my-rank">${inTop ? `Tu es ${inTop.rank}${inTop.rank === 1 ? 'er' : 'ème'} avec ${myScore} pts` : `Score final : ${myScore} pts`}</div>
  `);
});

conn.start()
  .then(() => conn.invoke('RegisterPlayer', playerId, pseudo))
  .catch(err => {
    render(`<div class="waiting">Erreur de connexion. Recharge la page.</div>`);
    console.error(err);
  });
