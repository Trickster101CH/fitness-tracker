// ========== AUDIO CONTEXT FOR TIMER SIGNAL ==========
let audioCtx = null;

function playTimerSignal() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Three ascending beeps — audible through headphones
  [0, 150, 300].forEach((delay, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 660 + i * 220; // 660, 880, 1100 Hz
    gain.gain.value = 0.3;
    const t = audioCtx.currentTime + delay / 1000;
    osc.start(t);
    osc.stop(t + 0.12);
  });
}

// ========== EXERCISE & PLAN DATA ==========
const EXERCISES = {
  // Workout A
  incline_db:      { name: 'Incline Dumbbell Press', workout: 'A', order: 1, ss: 20, current: 22, icon: '🏋️', invertProgress: false },
  barbell_row:     { name: 'Barbell Row',            workout: 'A', order: 2, ss: 10, current: 15, icon: '🏋️', invertProgress: false },
  db_high_pull:    { name: 'Dumbbell High Pull Ups', workout: 'A', order: 3, ss: 12, current: 12, icon: '💪', invertProgress: false },
  pjr_pullover:    { name: 'PJR Pull Overs',         workout: 'A', order: 4, ss: 18, current: 24, icon: '🏋️', invertProgress: false },
  goblet_squat:    { name: 'Goblet Squats',          workout: 'A', order: 5, ss: 12, current: 12, icon: '🦵', invertProgress: false },
  barbell_rdl:     { name: 'Barbell RDL',             workout: 'A', order: 6, ss: 10, current: 15, icon: '🦵', invertProgress: false },
  // Workout B
  dips:            { name: 'Dips (Assisted)',         workout: 'B', order: 1, ss: 75, current: 54, icon: '💪', invertProgress: true },
  cable_row_1arm:  { name: 'One Arm High Cable Row',  workout: 'B', order: 2, ss: 30, current: 45, icon: '🏋️', invertProgress: false },
  cable_lateral:   { name: 'Cable Lateral Raise',     workout: 'B', order: 3, ss: 7,  current: 16, icon: '🔄', invertProgress: false },
  barbell_curl:    { name: 'Barbell Curls',           workout: 'B', order: 4, ss: 7.5, current: 10, icon: '💪', invertProgress: false },
  tricep_pushdown: { name: 'Tricep Cable Push Down',  workout: 'B', order: 5, ss: 40, current: 60, icon: '💪', invertProgress: false },
};

const RULES = {
  startSetTarget: 12,      // target reps for start set
  miniSetRepsTarget: 20,   // total reps across ALL mini-sets (NOT including start set)
  restSeconds: 18,
  weightUpThreshold: 8,
};

// ========== DATA PERSISTENCE ==========
function loadHistory() {
  try {
    const saved = localStorage.getItem('fittrack_v2');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return generateMockHistory();
}

function saveHistory() {
  try { localStorage.setItem('fittrack_v2', JSON.stringify(history)); } catch (e) { /* ignore */ }
}

function loadMeta() {
  try {
    const saved = localStorage.getItem('fittrack_v2_meta');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return { nextWorkout: 'A', lastWorkoutDate: null };
}

function saveMeta() {
  try { localStorage.setItem('fittrack_v2_meta', JSON.stringify(meta)); } catch (e) { /* ignore */ }
}

function generateMockHistory() {
  const data = {};
  const now = new Date();
  Object.keys(EXERCISES).forEach(exId => {
    const ex = EXERCISES[exId];
    data[exId] = [];
    const startW = ex.ss;
    const endW = ex.current;
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const dayOffset = (steps - i) * 7 + (ex.workout === 'B' ? 2 : 0);
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      const weight = +(startW + (endW - startW) * (i / steps)).toFixed(1);
      const ssReps = 10 + Math.floor(Math.random() * 4);
      // Mini-sets: 20 reps total (independent of start set)
      const miniSets = [];
      let left = 20;
      while (left > 0) {
        const r = Math.min(left, 3 + Math.floor(Math.random() * 3));
        miniSets.push(r);
        left -= r;
      }
      data[exId].push({
        date: date.toISOString().split('T')[0],
        weight,
        startSetReps: ssReps,
        miniSetTotal: 20,
        sets: miniSets,
        volume: (20 + ssReps) * weight
      });
    }
  });
  return data;
}

let history = loadHistory();
let meta = loadMeta();

// ========== MODAL ==========
let modalCallback = null;

function showModal(title, message, confirmText, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-confirm').textContent = confirmText || 'Bestätigen';
  document.getElementById('modal-overlay').classList.add('active');
  modalCallback = onConfirm;
}

document.getElementById('modal-cancel').onclick = () => {
  document.getElementById('modal-overlay').classList.remove('active');
  modalCallback = null;
};
document.getElementById('modal-confirm').onclick = () => {
  document.getElementById('modal-overlay').classList.remove('active');
  if (modalCallback) modalCallback();
  modalCallback = null;
};

// ========== UTILITIES ==========
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function setNav(btn) {
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ========== STEPPER KEYBOARD INPUT ==========
function editStepperValue(el, type) {
  const currentVal = type === 'weight' ? woCurrentWeight : woCurrentReps;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'stepper-input';
  input.value = currentVal;
  input.step = type === 'weight' ? '0.5' : '1';
  input.min = type === 'weight' ? '0' : '1';
  input.setAttribute('inputmode', type === 'weight' ? 'decimal' : 'numeric');

  el.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const val = parseFloat(input.value);
    const display = document.createElement('div');
    display.className = 'stepper-value';
    display.id = type === 'weight' ? 'wo-weight-display' : 'wo-reps-display';
    display.onclick = function () { editStepperValue(this, type); };
    display.setAttribute('role', 'button');
    display.setAttribute('tabindex', '0');
    display.setAttribute('aria-label', (type === 'weight' ? 'Gewicht' : 'Reps') + ' eingeben: Tippen zum Bearbeiten');

    if (!isNaN(val) && val >= 0) {
      if (type === 'weight') {
        woCurrentWeight = Math.max(0, +val.toFixed(1));
      } else {
        woCurrentReps = Math.max(1, Math.round(val));
      }
    }
    display.textContent = type === 'weight' ? woCurrentWeight : woCurrentReps;
    input.replaceWith(display);
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.blur(); }
  });
}

// ========== PROGRESSION LOGIC ==========
function getProgressPercent(exId) {
  const ex = EXERCISES[exId];
  if (ex.invertProgress) {
    if (ex.ss === ex.current) return 0;
    return Math.round(((ex.ss - ex.current) / ex.ss) * 100);
  }
  if (ex.ss === 0) return 0;
  return Math.round(((ex.current - ex.ss) / ex.ss) * 100);
}

function getSuggestion(exId) {
  const h = history[exId] || [];
  const ex = EXERCISES[exId];
  if (h.length === 0) return { weight: ex.current, action: 'start', text: 'Erste Session – starte mit aktuellem Gewicht.' };
  const last = h[h.length - 1];

  if (last.startSetReps <= RULES.weightUpThreshold && !ex.invertProgress) {
    return {
      weight: last.weight, action: 'hold',
      text: `Letztes SS: ${last.startSetReps} Reps. Ziel: ${RULES.startSetTarget} Reps, dann steigern. Bleib bei <strong>${last.weight} kg</strong>.`
    };
  }
  if (last.startSetReps >= RULES.startSetTarget) {
    const increment = ex.invertProgress ? -2.5 : 2.5;
    const newWeight = +(last.weight + increment).toFixed(1);
    const dir = ex.invertProgress ? 'weniger Unterstützung' : 'Gewicht steigern';
    return {
      weight: newWeight, action: 'increase',
      text: `Letztes SS: ${last.startSetReps} Reps – ${dir}! <strong>${newWeight} kg</strong>`
    };
  }
  return {
    weight: last.weight, action: 'progress',
    text: `Letztes SS: ${last.startSetReps} Reps, gut unterwegs. <strong>${last.weight} kg</strong> beibehalten.`
  };
}

function getTrendIcon(exId) {
  const h = history[exId] || [];
  if (h.length < 2) return '<span class="trend-arrow same" aria-label="Gleichbleibend">→</span>';
  const last = h[h.length - 1], prev = h[h.length - 2];
  const ex = EXERCISES[exId];
  const improving = ex.invertProgress ? last.weight < prev.weight : last.weight > prev.weight;
  if (improving) return '<span class="trend-arrow up" aria-label="Steigend">↑</span>';
  if (last.weight === prev.weight) return '<span class="trend-arrow same" aria-label="Gleichbleibend">→</span>';
  return '<span class="trend-arrow down" aria-label="Sinkend">↓</span>';
}

// ========== DASHBOARD ==========
function renderDashboard() {
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('de-DE', opts);

  const sel = document.getElementById('workout-selector');
  const isNextA = meta.nextWorkout === 'A';
  sel.innerHTML = `
    <div class="wo-btn ${isNextA ? 'active next-badge' : ''}" onclick="selectWorkout('A')" role="radio" aria-checked="${isNextA}" tabindex="0">
      <div class="wo-btn-label wo-btn-label-a">A</div>
      <div class="wo-btn-sub">6 Übungen</div>
    </div>
    <div class="wo-btn ${!isNextA ? 'active next-badge' : ''}" onclick="selectWorkout('B')" role="radio" aria-checked="${!isNextA}" tabindex="0">
      <div class="wo-btn-label wo-btn-label-b">B</div>
      <div class="wo-btn-sub">5 Übungen</div>
    </div>`;

  renderExerciseList('A', 'exercises-a');
  renderExerciseList('B', 'exercises-b');

  // Stats
  const allEntries = Object.values(history).flat();
  const thisMonth = allEntries.filter(e => {
    const d = new Date(e.date), now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const uniqueDates = [...new Set(thisMonth.map(e => e.date))];
  document.getElementById('stat-workouts').textContent = uniqueDates.length;

  let increases = 0;
  Object.keys(EXERCISES).forEach(exId => { if (getProgressPercent(exId) > 0) increases++; });
  document.getElementById('stat-prs').textContent = increases;

  document.getElementById('stat-streak').textContent = calculateStreak();
}

function calculateStreak() {
  const allDates = [...new Set(Object.values(history).flat().map(e => e.date))].sort().reverse();
  if (allDates.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Allow gap of up to 3 days between workouts (A/B rotation ~ every 2-3 days)
  let checkDate = today;
  for (let i = 0; i < allDates.length; i++) {
    const d = new Date(allDates[i]);
    d.setHours(0, 0, 0, 0);
    const diffDays = (checkDate - d) / (1000 * 60 * 60 * 24);
    if (diffDays <= 3) {
      streak++;
      checkDate = new Date(d);
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function renderExerciseList(workout, containerId) {
  const container = document.getElementById(containerId);
  const exs = Object.entries(EXERCISES)
    .filter(([, e]) => e.workout === workout)
    .sort((a, b) => a[1].order - b[1].order);

  container.innerHTML = exs.map(([exId, ex]) => {
    const h = history[exId] || [];
    const last = h.length ? h[h.length - 1] : null;
    const sug = getSuggestion(exId);
    const progress = getProgressPercent(exId);
    const progressColor = progress > 0 ? 'var(--green)' : progress < 0 ? 'var(--red)' : 'var(--orange)';
    return `
      <div class="exercise-item" onclick="showExerciseDetail('${exId}')" role="listitem" tabindex="0"
           onkeydown="if(event.key==='Enter')showExerciseDetail('${exId}')" aria-label="${ex.name}, ${ex.current}kg">
        <div class="exercise-icon" aria-hidden="true">${ex.icon}</div>
        <div class="exercise-info">
          <div class="exercise-name">${ex.name}
            ${sug.action === 'increase' ? '<span class="weight-up-badge">↑ STEIGERN</span>' : ''}
          </div>
          <div class="exercise-meta">
            SS: ${ex.ss}kg → Aktuell: ${ex.current}kg
            ${progress !== 0 ? ` · <span style="color:${progressColor}">${progress > 0 ? '+' : ''}${progress}%</span>` : ''}
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(Math.abs(progress), 100)}%; background:${progressColor}"></div>
          </div>
        </div>
        <div class="exercise-weights">
          <div class="current">${ex.current}kg ${getTrendIcon(exId)}</div>
          ${last ? `<div class="start">SS: ${last.startSetReps} reps</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function selectWorkout(w) {
  meta.nextWorkout = w;
  saveMeta();
  renderDashboard();
}

// ========== EXERCISE DETAIL ==========
let weightChart = null, repsChart = null;
let currentDetailExId = null;

function showExerciseDetail(exId) {
  currentDetailExId = exId;
  const ex = EXERCISES[exId];
  showPage('page-detail');
  document.getElementById('detail-title').textContent = ex.name;
  document.getElementById('detail-subtitle').textContent = `Workout ${ex.workout} · SS: ${ex.ss}kg → Aktuell: ${ex.current}kg`;

  const h = history[exId] || [];
  const labels = h.map(e => {
    const d = new Date(e.date);
    return d.getDate() + '.' + (d.getMonth() + 1);
  });

  if (weightChart) weightChart.destroy();
  weightChart = new Chart(document.getElementById('weight-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Gewicht (kg)', data: h.map(e => e.weight),
        borderColor: '#6c5ce7', backgroundColor: 'rgba(108,92,231,.1)',
        fill: true, tension: 0.3, pointRadius: 5,
        pointBackgroundColor: '#6c5ce7', pointBorderColor: '#fff', pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8892a4' }, grid: { color: 'rgba(45,50,68,.5)' } },
        y: { ticks: { color: '#8892a4' }, grid: { color: 'rgba(45,50,68,.5)' } }
      }
    }
  });

  if (repsChart) repsChart.destroy();
  repsChart = new Chart(document.getElementById('reps-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Start-Set Reps', data: h.map(e => e.startSetReps),
        backgroundColor: h.map(e =>
          e.startSetReps >= RULES.startSetTarget ? 'rgba(0,184,148,.7)' :
            e.startSetReps >= RULES.weightUpThreshold ? 'rgba(253,203,110,.7)' : 'rgba(225,112,85,.7)'
        ), borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8892a4' }, grid: { display: false } },
        y: { min: 0, max: 20, ticks: { color: '#8892a4' }, grid: { color: 'rgba(45,50,68,.5)' } }
      }
    }
  });

  const sug = getSuggestion(exId);
  const emoji = sug.action === 'increase' ? '🔥' : sug.action === 'hold' ? '💪' : '⚡';
  document.getElementById('detail-suggestion').innerHTML = `
    <div class="suggestion-title">${emoji} Empfehlung nächste Session</div>
    <div class="suggestion-text">${sug.text}</div>
    <div class="suggestion-rule">
      Regel: SS Reps to Failure (unabhängig) → dann Mini-Sets bis 20 Total · ≥12 SS Reps = Gewicht steigern
    </div>`;

  renderHistoryTable(exId);
}

function renderHistoryTable(exId) {
  const h = history[exId] || [];
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = [...h].reverse().map((e, reverseIdx) => {
    const realIdx = h.length - 1 - reverseIdx;
    const isPR = e.startSetReps >= RULES.startSetTarget;
    const miniTotal = e.miniSetTotal !== undefined ? e.miniSetTotal : (e.totalReps || 20);
    return `<tr>
      <td>${new Date(e.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</td>
      <td>${e.weight} kg</td><td>${e.startSetReps}</td>
      <td>${miniTotal}</td><td>${e.sets.length}</td>
      <td>
        <div class="action-btns">
          ${isPR ? '<span class="pr-badge">12+ ✓</span>' : ''}
          <button class="icon-btn edit" onclick="editEntry('${exId}', ${realIdx})" aria-label="Eintrag bearbeiten" title="Bearbeiten">✏️</button>
          <button class="icon-btn delete" onclick="deleteEntry('${exId}', ${realIdx})" aria-label="Eintrag löschen" title="Löschen">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ========== EDIT / DELETE ENTRIES ==========
let editingExId = null, editingIdx = null;

function editEntry(exId, idx) {
  editingExId = exId;
  editingIdx = idx;
  const entry = history[exId][idx];
  document.getElementById('edit-weight').value = entry.weight;
  document.getElementById('edit-ss-reps').value = entry.startSetReps;
  document.getElementById('edit-total-reps').value = entry.miniSetTotal !== undefined ? entry.miniSetTotal : (entry.totalReps || 20);
  document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('active');
  editingExId = null;
  editingIdx = null;
}

function saveEditEntry() {
  if (editingExId === null || editingIdx === null) return;
  const entry = history[editingExId][editingIdx];
  entry.weight = parseFloat(document.getElementById('edit-weight').value);
  entry.startSetReps = parseInt(document.getElementById('edit-ss-reps').value);
  entry.miniSetTotal = parseInt(document.getElementById('edit-total-reps').value);
  entry.volume = (entry.miniSetTotal + entry.startSetReps) * entry.weight;
  saveHistory();
  closeEditModal();
  showExerciseDetail(editingExId);
  showToast('Eintrag aktualisiert ✓');
}

function deleteEntry(exId, idx) {
  showModal('Eintrag löschen', 'Diesen Eintrag wirklich löschen? Das kann nicht rückgängig gemacht werden.', 'Löschen', () => {
    history[exId].splice(idx, 1);
    saveHistory();
    showExerciseDetail(exId);
    showToast('Eintrag gelöscht');
  });
}

// ========== ACTIVE WORKOUT ==========
let activeWorkout = null;
let woCurrentWeight = 0;
let woCurrentReps = 12;
let workoutLog = [];

function startWorkout() {
  const type = meta.nextWorkout;
  const exs = Object.entries(EXERCISES)
    .filter(([, e]) => e.workout === type)
    .sort((a, b) => a[1].order - b[1].order);
  activeWorkout = {
    type,
    exercises: exs.map(([id]) => id),
    exerciseIndex: 0,
    startSetReps: 0,
    startSetDone: false,
    currentMiniSets: [],
    miniSetTotal: 0
  };
  workoutLog = [];
  showPage('page-workout');
  document.getElementById('workout-header').textContent = `Workout ${type}`;
  loadExerciseIntoWorkout();
}

function loadExerciseIntoWorkout() {
  if (!activeWorkout) return;
  const exId = activeWorkout.exercises[activeWorkout.exerciseIndex];
  const ex = EXERCISES[exId];
  const sug = getSuggestion(exId);
  const total = activeWorkout.exercises.length;
  const current = activeWorkout.exerciseIndex + 1;

  activeWorkout.startSetReps = 0;
  activeWorkout.startSetDone = false;
  activeWorkout.currentMiniSets = [];
  activeWorkout.miniSetTotal = 0;

  woCurrentWeight = sug.weight;
  woCurrentReps = RULES.startSetTarget;

  document.getElementById('workout-progress-text').textContent = `Übung ${current} von ${total}`;
  document.getElementById('wo-exercise-name').textContent = ex.name;
  document.getElementById('wo-exercise-number').textContent = `${current}/${total}`;
  document.getElementById('wo-weight-section').style.display = '';
  document.getElementById('wo-start-set-info').style.display = 'none';
  document.getElementById('wo-start-set-info').classList.remove('visible');

  renderWorkoutState();
}

function renderWorkoutState() {
  if (!activeWorkout) return;
  const isStartSet = !activeWorkout.startSetDone;
  const done = activeWorkout.miniSetTotal >= RULES.miniSetRepsTarget;
  const remaining = RULES.miniSetRepsTarget - activeWorkout.miniSetTotal;

  document.getElementById('wo-weight-display').textContent = woCurrentWeight;
  document.getElementById('wo-reps-display').textContent = woCurrentReps;

  // Start set info banner
  if (activeWorkout.startSetDone) {
    const banner = document.getElementById('wo-start-set-info');
    banner.style.display = '';
    banner.classList.add('visible');
    document.getElementById('wo-start-set-text').textContent =
      `Start Set: ${activeWorkout.startSetReps} Reps @ ${woCurrentWeight}kg (unabhängig)`;
  }

  // Reps label
  if (done) {
    document.getElementById('wo-reps-stepper-label').textContent = '🎉 MINI-SET ZIEL ERREICHT!';
  } else if (isStartSet) {
    document.getElementById('wo-reps-stepper-label').textContent = 'START SET – Reps to Failure';
  } else {
    document.getElementById('wo-reps-stepper-label').textContent = `MINI-SET · noch ${remaining} Reps bis 20`;
    if (woCurrentReps > remaining) {
      woCurrentReps = remaining;
      document.getElementById('wo-reps-display').textContent = woCurrentReps;
    }
  }

  // Progress bar (mini-sets only)
  const pct = Math.min((activeWorkout.miniSetTotal / RULES.miniSetRepsTarget) * 100, 100);
  document.getElementById('wo-reps-progress-fill').style.width = pct + '%';
  document.getElementById('wo-reps-progress-text').textContent = `${activeWorkout.miniSetTotal} / ${RULES.miniSetRepsTarget}`;

  // Logged mini-sets
  const setsLog = document.getElementById('wo-sets-log');
  if (activeWorkout.currentMiniSets.length === 0) {
    setsLog.innerHTML = '';
  } else {
    let cumul = 0;
    setsLog.innerHTML = activeWorkout.currentMiniSets.map((reps, i) => {
      cumul += reps;
      return `<div class="set-entry">
        <div class="set-num">${i + 1}</div>
        <div class="set-reps">${reps} Reps @ ${woCurrentWeight}kg</div>
        <div class="set-cumulative">${cumul}/${RULES.miniSetRepsTarget}</div>
      </div>`;
    }).join('');
  }

  // Hide weight adjustment after start set
  if (!isStartSet) {
    document.getElementById('wo-weight-section').style.display = 'none';
  }

  // Buttons
  document.getElementById('wo-save-btn').style.display = done ? 'none' : '';
  document.getElementById('wo-next-btn').style.display = done ? '' : 'none';

  if (isStartSet) {
    document.getElementById('wo-save-btn').textContent = 'START SET SPEICHERN';
    document.getElementById('wo-save-btn').className = 'btn-save-set orange';
  } else {
    document.getElementById('wo-save-btn').textContent = `MINI-SET SPEICHERN · ${remaining} übrig`;
    document.getElementById('wo-save-btn').className = 'btn-save-set green';
  }

  if (done) {
    const isLast = activeWorkout.exerciseIndex >= activeWorkout.exercises.length - 1;
    document.getElementById('wo-next-btn').textContent = isLast ? '🏁 WORKOUT BEENDEN' : 'NÄCHSTE ÜBUNG →';
  }
}

function adjustWeight(delta) {
  woCurrentWeight = Math.max(0, +(woCurrentWeight + delta).toFixed(1));
  renderWorkoutState();
}

function adjustReps(delta) {
  if (!activeWorkout.startSetDone) {
    woCurrentReps = Math.max(1, woCurrentReps + delta);
  } else {
    const remaining = RULES.miniSetRepsTarget - activeWorkout.miniSetTotal;
    woCurrentReps = Math.max(1, Math.min(woCurrentReps + delta, remaining || 30));
  }
  renderWorkoutState();
}

function logSet() {
  if (!activeWorkout) return;

  if (!activeWorkout.startSetDone) {
    // Start set — recorded separately, does NOT count toward 20 mini-set reps
    activeWorkout.startSetReps = woCurrentReps;
    activeWorkout.startSetDone = true;
    showToast(`Start Set: ${woCurrentReps} Reps ✓`);
    woCurrentReps = Math.min(5, RULES.miniSetRepsTarget);
    renderWorkoutState();
    startTimer();
  } else {
    // Mini-set
    activeWorkout.currentMiniSets.push(woCurrentReps);
    activeWorkout.miniSetTotal += woCurrentReps;

    if (activeWorkout.miniSetTotal >= RULES.miniSetRepsTarget) {
      showToast('20 Mini-Set Reps erreicht! ✓');
      renderWorkoutState();
    } else {
      const remaining = RULES.miniSetRepsTarget - activeWorkout.miniSetTotal;
      woCurrentReps = Math.min(4, remaining);
      renderWorkoutState();
      startTimer();
    }
  }
}

function nextExercise() {
  const exId = activeWorkout.exercises[activeWorkout.exerciseIndex];
  if (!history[exId]) history[exId] = [];
  const entry = {
    date: new Date().toISOString().split('T')[0],
    weight: woCurrentWeight,
    startSetReps: activeWorkout.startSetReps,
    miniSetTotal: activeWorkout.miniSetTotal,
    sets: [...activeWorkout.currentMiniSets],
    volume: (activeWorkout.miniSetTotal + activeWorkout.startSetReps) * woCurrentWeight
  };
  history[exId].push(entry);
  saveHistory();

  workoutLog.push({ exId, ...entry });

  if (activeWorkout.exerciseIndex >= activeWorkout.exercises.length - 1) {
    showWorkoutSummary();
    return;
  }
  activeWorkout.exerciseIndex++;
  loadExerciseIntoWorkout();
}

function confirmEndWorkout() {
  showModal(
    'Workout beenden?',
    'Bist du sicher, dass du das Workout vorzeitig beenden möchtest? Nicht gespeicherte Übungen gehen verloren.',
    'Beenden',
    () => endWorkout()
  );
}

function endWorkout() {
  meta.nextWorkout = meta.nextWorkout === 'A' ? 'B' : 'A';
  meta.lastWorkoutDate = new Date().toISOString().split('T')[0];
  saveMeta();
  activeWorkout = null;
  showPage('page-dashboard');
  setNav(document.getElementById('nav-home'));
  renderDashboard();
  showToast('Workout beendet! 💪');
}

// ========== WORKOUT SUMMARY ==========
function showWorkoutSummary() {
  meta.nextWorkout = meta.nextWorkout === 'A' ? 'B' : 'A';
  meta.lastWorkoutDate = new Date().toISOString().split('T')[0];
  saveMeta();

  const type = activeWorkout.type;
  activeWorkout = null;

  document.getElementById('summary-subtitle').textContent =
    `Workout ${type} · ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  document.getElementById('summary-exercises').textContent = workoutLog.length;

  let totalVolume = 0;
  let weightIncreases = 0;

  const listHtml = workoutLog.map(log => {
    const ex = EXERCISES[log.exId];
    totalVolume += log.volume;
    const h = history[log.exId] || [];
    if (h.length >= 2) {
      const curr = h[h.length - 1].weight;
      const prev = h[h.length - 2].weight;
      if ((!ex.invertProgress && curr > prev) || (ex.invertProgress && curr < prev)) weightIncreases++;
    }
    return `<div class="summary-exercise">
      <div>
        <div class="name">${ex.name}</div>
        <div class="summary-detail">SS: ${log.startSetReps} Reps · Mini: ${log.miniSetTotal} Reps (${log.sets.length} Sets)</div>
      </div>
      <div class="details">
        <div class="weight">${log.weight} kg</div>
        <div>${log.volume.toFixed(0)} kg Vol.</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('summary-volume').textContent = totalVolume.toFixed(0);
  document.getElementById('summary-increases').textContent = weightIncreases;
  document.getElementById('summary-exercises-list').innerHTML = listHtml;

  showPage('page-summary');
}

function closeSummary() {
  showPage('page-dashboard');
  setNav(document.getElementById('nav-home'));
  renderDashboard();
}

// ========== TIMER ==========
let timerInterval = null;
let timerSecondsLeft = 0;

function startTimer() {
  // Unlock audio context on first user interaction
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  timerSecondsLeft = RULES.restSeconds;
  const overlay = document.getElementById('timer-overlay');
  overlay.classList.add('active');

  const circumference = 2 * Math.PI * 120;
  const progress = document.getElementById('timer-progress');
  progress.style.strokeDasharray = circumference;
  progress.style.stroke = 'var(--accent)';

  const remaining = RULES.miniSetRepsTarget - activeWorkout.miniSetTotal;
  document.getElementById('timer-info').innerHTML = `
    Noch <strong>${remaining} Mini-Set Reps</strong> bis zum Ziel<br>
    Set ${activeWorkout.currentMiniSets.length + 1} bereit machen`;

  updateTimerDisplay(circumference);
  timerInterval = setInterval(() => {
    timerSecondsLeft--;
    if (timerSecondsLeft <= 0) {
      clearInterval(timerInterval);
      timerSecondsLeft = 0;
      progress.style.stroke = 'var(--green)';
      document.getElementById('timer-display').textContent = 'GO!';
      document.getElementById('timer-display').style.color = 'var(--green)';
      playTimerSignal();
      setTimeout(() => {
        if (overlay.classList.contains('active')) skipTimer();
      }, 1500);
    }
    updateTimerDisplay(circumference);
  }, 1000);
}

function updateTimerDisplay(circumference) {
  const display = document.getElementById('timer-display');
  if (timerSecondsLeft > 0) {
    display.textContent = timerSecondsLeft;
    display.style.color = 'var(--text)';
  }
  const offset = circumference * (1 - timerSecondsLeft / RULES.restSeconds);
  document.getElementById('timer-progress').style.strokeDashoffset = offset;
}

function skipTimer() {
  clearInterval(timerInterval);
  document.getElementById('timer-overlay').classList.remove('active');
}

// ========== MANUAL LOG ==========
function populateLogSelect() {
  const sel = document.getElementById('log-exercise');
  sel.innerHTML = '<option value="">Übung wählen...</option>';
  ['A', 'B'].forEach(w => {
    const group = document.createElement('optgroup');
    group.label = `Workout ${w}`;
    Object.entries(EXERCISES)
      .filter(([, e]) => e.workout === w)
      .sort((a, b) => a[1].order - b[1].order)
      .forEach(([id, ex]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = ex.name;
        group.appendChild(opt);
      });
    sel.appendChild(group);
  });
}

function saveManualLog() {
  const exId = document.getElementById('log-exercise').value;
  const weight = parseFloat(document.getElementById('log-weight').value);
  const ssReps = parseInt(document.getElementById('log-ss-reps').value);
  const miniTotal = parseInt(document.getElementById('log-total-reps').value);
  const sets = parseInt(document.getElementById('log-sets').value);
  if (!exId || isNaN(weight) || !ssReps || !miniTotal) {
    showToast('Bitte alle Felder ausfüllen!');
    return;
  }

  if (!history[exId]) history[exId] = [];
  const miniSets = [];
  let remaining = miniTotal;
  for (let i = 0; i < sets && remaining > 0; i++) {
    const r = Math.min(remaining, Math.ceil(remaining / (sets - i)));
    miniSets.push(r);
    remaining -= r;
  }
  history[exId].push({
    date: new Date().toISOString().split('T')[0],
    weight,
    startSetReps: ssReps,
    miniSetTotal: miniTotal,
    sets: miniSets,
    volume: (miniTotal + ssReps) * weight
  });
  saveHistory();
  showToast('Eintrag gespeichert! ✓');
  showPage('page-dashboard');
  setNav(document.getElementById('nav-home'));
  renderDashboard();
}

// ========== DATA EXPORT / IMPORT ==========
function exportData() {
  const data = {
    history,
    meta,
    exportDate: new Date().toISOString(),
    version: 'fittrack_v3'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fittrack-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Daten exportiert ✓');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.history) {
        showModal(
          'Daten importieren?',
          `Backup vom ${data.exportDate ? new Date(data.exportDate).toLocaleDateString('de-DE') : 'unbekannt'}. Aktuelle Daten werden überschrieben.`,
          'Importieren',
          () => {
            history = data.history;
            if (data.meta) { meta = data.meta; saveMeta(); }
            saveHistory();
            renderDashboard();
            showToast('Daten importiert ✓');
          }
        );
      } else {
        showToast('Ungültige Datei!');
      }
    } catch (err) {
      showToast('Fehler beim Lesen der Datei!');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function confirmResetData() {
  showModal(
    'Alle Daten löschen?',
    'Alle Trainingsdaten werden unwiderruflich gelöscht. Erstelle vorher ein Backup!',
    'Alles löschen',
    () => {
      localStorage.removeItem('fittrack_v2');
      localStorage.removeItem('fittrack_v2_meta');
      history = {};
      meta = { nextWorkout: 'A', lastWorkoutDate: null };
      renderDashboard();
      showPage('page-dashboard');
      showToast('Daten gelöscht');
    }
  );
}

// ========== INIT ==========
renderDashboard();
