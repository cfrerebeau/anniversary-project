const conn = new signalR.HubConnectionBuilder()
  .withUrl('/hub')
  .withAutomaticReconnect()
  .build();

const elPlayers = document.getElementById('players');
const elPlayerCount = document.getElementById('player-count');
const elQI = document.getElementById('question-info');
const elQS = document.getElementById('question-section');
const elProgress = document.getElementById('answer-progress');
const elState = document.getElementById('state-indicator');

const btnNext = document.getElementById('btn-next');
const btnReveal = document.getElementById('btn-reveal');
const btnLB = document.getElementById('btn-leaderboard');
const btnReset = document.getElementById('btn-reset');

let currentPhase = 'Lobby';

function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

btnNext.addEventListener('click', () => conn.invoke('NextQuestion'));
btnReveal.addEventListener('click', () => conn.invoke('RevealAnswer'));
btnLB.addEventListener('click', () => conn.invoke('ShowLeaderboard'));
btnReset.addEventListener('click', () => {
  if (confirm('Réinitialiser tous les scores et revenir au lobby ?')) conn.invoke('ResetGame');
});

conn.on('playerList', list => {
  elPlayerCount.textContent = list.length;
  elPlayers.innerHTML = list
    .sort((a, b) => b.score - a.score)
    .map(p => `<li>${escapeHtml(p.pseudo)} — ${p.score} pts</li>`)
    .join('');
});

conn.on('phaseChanged', phase => {
  currentPhase = phase;
  elState.textContent = phase;
  btnReveal.disabled = phase !== 'QuestionActive';
  btnLB.disabled = phase !== 'AnswerRevealed';
  btnNext.disabled = phase === 'QuestionActive' || phase === 'Finished';
  btnNext.textContent =
    phase === 'Lobby' ? 'Démarrer le quiz' :
    phase === 'Finished' ? 'Quiz terminé' :
    phase === 'QuestionActive' ? 'En cours...' :
    'Question suivante';
  if (phase === 'Lobby') elQS.classList.add('hidden');
});

conn.on('questionStarted', q => {
  elQS.classList.remove('hidden');
  elQI.innerHTML = `
    <div>Question ${q.index + 1}/${q.total}</div>
    <div class="qtext">${escapeHtml(q.text)}</div>
    <ol id="opts-list">${q.options.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ol>
  `;
  elProgress.textContent = `0 / ${elPlayerCount.textContent} réponses`;
});

conn.on('answerCount', d => {
  elProgress.textContent = `${d.answered} / ${d.total} réponses`;
});

conn.on('answerRevealed', d => {
  const lis = document.querySelectorAll('#opts-list li');
  lis.forEach((li, i) => {
    if (i === d.correctIndex) li.classList.add('correct');
    li.textContent = `${li.textContent} — ${d.counts[i] || 0} réponse${(d.counts[i] || 0) > 1 ? 's' : ''}`;
  });
});

conn.start()
  .then(() => conn.invoke('RegisterHost'))
  .catch(err => console.error(err));
