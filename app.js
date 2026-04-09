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
const DEFAULT_EXERCISES = {
  incline_db:      { name: 'Incline Dumbbell Press', workout: 'A', order: 1, ss: 20, current: 22, icon: '🏋️', invertProgress: false, muscles: 'Obere Brust, vorderer Delta, Trizeps' },
  barbell_row:     { name: 'Barbell Row',            workout: 'A', order: 2, ss: 10, current: 15, icon: '🏋️', invertProgress: false, muscles: 'Lat, Rhomboiden, hinterer Delta, Bizeps' },
  db_high_pull:    { name: 'Dumbbell High Pull Ups', workout: 'A', order: 3, ss: 12, current: 12, icon: '💪', invertProgress: false, muscles: 'Hinterer Delta, Trapez, Rhomboiden' },
  pjr_pullover:    { name: 'PJR Pull Overs',         workout: 'A', order: 4, ss: 18, current: 24, icon: '🏋️', invertProgress: false, muscles: 'Lat, langer Trizeps, untere Brust' },
  goblet_squat:    { name: 'Goblet Squats',          workout: 'A', order: 5, ss: 12, current: 12, icon: '🦵', invertProgress: false, muscles: 'Quadrizeps, Gluteus, Adduktoren, Core' },
  barbell_rdl:     { name: 'Barbell RDL',            workout: 'A', order: 6, ss: 10, current: 15, icon: '🦵', invertProgress: false, muscles: 'Hamstrings, Gluteus, unterer Rücken' },
  reverse_curl:    { name: 'Reverse Barbell Curls',  workout: 'A', order: 7, ss: 10, current: 10, icon: '💪', invertProgress: false, muscles: 'Brachioradialis, Unterarme, Griffkraft, Bizeps' },
  dips:            { name: 'Dips (Assisted)',        workout: 'B', order: 1, ss: 75, current: 54, icon: '💪', invertProgress: true,  muscles: 'Untere Brust, Trizeps, vorderer Delta' },
  cable_row_1arm:  { name: 'One Arm High Cable Row', workout: 'B', order: 2, ss: 30, current: 45, icon: '🏋️', invertProgress: false, muscles: 'Lat, Rhomboiden, hinterer Delta, Bizeps' },
  cable_lateral:   { name: 'Cable Lateral Raise',    workout: 'B', order: 3, ss: 7,  current: 16, icon: '🔄', invertProgress: false, muscles: 'Mittlerer Delta' },
  barbell_curl:    { name: 'Barbell Curls',          workout: 'B', order: 4, ss: 7.5, current: 10, icon: '💪', invertProgress: false, muscles: 'Bizeps, Brachialis, Unterarme' },
  tricep_pushdown: { name: 'Tricep Cable Push Down', workout: 'B', order: 5, ss: 40, current: 60, icon: '💪', invertProgress: false, muscles: 'Trizeps (alle Köpfe)' },
  bulgarian_split: { name: 'Bulgarian Split Squats', workout: 'B', order: 6, ss: 10, current: 10, icon: '🦵', invertProgress: false, muscles: 'Quadrizeps, Gluteus, Adduktoren, Stabilisatoren' },
};

// Dynamic exercises — loaded from localStorage, falls back to defaults
let EXERCISES = loadExercises();

function loadExercises() {
  try {
    const saved = localStorage.getItem('fittrack_exercises');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate: backfill muscles field from defaults if missing
      Object.keys(parsed).forEach(id => {
        if (!parsed[id].muscles && DEFAULT_EXERCISES[id]) {
          parsed[id].muscles = DEFAULT_EXERCISES[id].muscles;
        }
      });
      // Migrate: add any new default exercises that don't exist yet
      let added = false;
      Object.keys(DEFAULT_EXERCISES).forEach(id => {
        if (!parsed[id]) {
          parsed[id] = JSON.parse(JSON.stringify(DEFAULT_EXERCISES[id]));
          added = true;
        }
      });
      if (added) {
        try { localStorage.setItem('fittrack_exercises', JSON.stringify(parsed)); } catch (e) { /* ignore */ }
      }
      return parsed;
    }
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_EXERCISES));
}

function saveExercises() {
  try { localStorage.setItem('fittrack_exercises', JSON.stringify(EXERCISES)); } catch (e) { /* ignore */ }
}

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
  return {};
}

function saveHistory() {
  try { localStorage.setItem('fittrack_v2', JSON.stringify(history)); } catch (e) { /* ignore */ }
}

function loadMeta() {
  try {
    const saved = localStorage.getItem('fittrack_v2_meta');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  return { nextWorkout: 'B', lastWorkoutDate: null };
}

function saveMeta() {
  try { localStorage.setItem('fittrack_v2_meta', JSON.stringify(meta)); } catch (e) { /* ignore */ }
}

let history = loadHistory();
let meta = loadMeta();

// ========== ACTIVE WORKOUT PERSISTENCE ==========
function saveActiveWorkout() {
  try {
    if (activeWorkout) {
      localStorage.setItem('fittrack_active', JSON.stringify({ activeWorkout, workoutLog }));
    } else {
      localStorage.removeItem('fittrack_active');
    }
  } catch (e) { /* ignore */ }
}

function loadActiveWorkout() {
  try {
    const saved = localStorage.getItem('fittrack_active');
    if (saved) {
      const data = JSON.parse(saved);
      return data;
    }
  } catch (e) { /* ignore */ }
  return null;
}

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

  // Analyze mini-set weight progression: if user pushed weight beyond SS during mini-sets,
  // and last mini-set still had ≥ weightUpThreshold reps, the SS weight is too low
  let miniSetMaxWeight = last.weight;
  let lastMiniSetStrong = false;
  if (last.sets && last.sets.length > 0) {
    last.sets.forEach(s => {
      if (typeof s === 'object' && s.weight != null) {
        if (ex.invertProgress) {
          if (s.weight < miniSetMaxWeight) miniSetMaxWeight = s.weight;
        } else {
          if (s.weight > miniSetMaxWeight) miniSetMaxWeight = s.weight;
        }
      }
    });
    const lastSet = last.sets[last.sets.length - 1];
    if (typeof lastSet === 'object' && lastSet.reps >= RULES.weightUpThreshold) {
      lastMiniSetStrong = true;
    }
  }
  const miniSetPushed = ex.invertProgress
    ? miniSetMaxWeight < last.weight
    : miniSetMaxWeight > last.weight;

  if (last.startSetReps <= RULES.weightUpThreshold && !ex.invertProgress) {
    return {
      weight: last.weight, action: 'hold',
      text: `Letztes SS: ${last.startSetReps} Reps. Ziel: ${RULES.startSetTarget} Reps, dann steigern. Bleib bei <strong>${last.weight} kg</strong>.`
    };
  }
  if (last.startSetReps >= RULES.startSetTarget) {
    const increment = ex.invertProgress ? -2.5 : 2.5;
    let newWeight = +(last.weight + increment).toFixed(1);
    let bonusText = '';
    // Bonus boost: if mini-sets pushed weight even higher AND last mini-set was still strong,
    // jump straight to that higher weight
    if (miniSetPushed && lastMiniSetStrong) {
      const pushedWeight = ex.invertProgress
        ? Math.min(newWeight, miniSetMaxWeight)
        : Math.max(newWeight, miniSetMaxWeight);
      if (pushedWeight !== newWeight) {
        newWeight = pushedWeight;
        bonusText = ' (Mini-Sets waren stark → Sprung)';
      }
    }
    const dir = ex.invertProgress ? 'weniger Unterstützung' : 'Gewicht steigern';
    return {
      weight: newWeight, action: 'increase',
      text: `Letztes SS: ${last.startSetReps} Reps – ${dir}!${bonusText} <strong>${newWeight} kg</strong>`
    };
  }
  // 8-12 SS reps: hold weight, but if mini-sets pushed higher, suggest the pushed weight
  if (miniSetPushed && lastMiniSetStrong) {
    return {
      weight: miniSetMaxWeight, action: 'progress',
      text: `Letztes SS: ${last.startSetReps} Reps. Mini-Sets erreichten <strong>${miniSetMaxWeight}kg</strong> – versuche heute direkt damit zu starten.`
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
  const countA = Object.values(EXERCISES).filter(e => e.workout === 'A').length;
  const countB = Object.values(EXERCISES).filter(e => e.workout === 'B').length;
  sel.innerHTML = `
    <div class="wo-btn ${isNextA ? 'active next-badge' : ''}" onclick="selectWorkout('A')" role="radio" aria-checked="${isNextA}" tabindex="0">
      <div class="wo-btn-label wo-btn-label-a">A</div>
      <div class="wo-btn-sub">${countA} Übungen</div>
    </div>
    <div class="wo-btn ${!isNextA ? 'active next-badge' : ''}" onclick="selectWorkout('B')" role="radio" aria-checked="${!isNextA}" tabindex="0">
      <div class="wo-btn-label wo-btn-label-b">B</div>
      <div class="wo-btn-sub">${countB} Übungen</div>
    </div>`;

  renderExerciseList('A', 'exercises-a');
  renderExerciseList('B', 'exercises-b');

  // Update FAB to show "Resume" if a workout is running
  const fab = document.querySelector('.fab');
  if (fab) {
    if (activeWorkout) {
      fab.textContent = '⏵';
      fab.setAttribute('aria-label', 'Workout fortsetzen');
      fab.classList.add('resume');
    } else {
      fab.textContent = '▶';
      fab.setAttribute('aria-label', 'Workout starten');
      fab.classList.remove('resume');
    }
  }

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

  renderHeatmap();
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
          ${ex.muscles ? `<div class="exercise-muscles">${ex.muscles}</div>` : ''}
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
let weightChart = null, repsChart = null, volumeChart = null;
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
  // Build stacked bar: Start Set + each Mini-Set as separate dataset
  // Find max number of mini-sets across all sessions
  const maxMiniSets = h.reduce((max, e) => Math.max(max, (e.sets || []).length), 0);
  const miniSetColors = [
    'rgba(108,92,231,.75)',  // accent purple
    'rgba(0,184,148,.75)',    // green
    'rgba(253,203,110,.75)', // orange
    'rgba(162,155,254,.75)', // light purple
    'rgba(0,206,201,.75)',   // teal
    'rgba(255,159,67,.75)',  // amber
    'rgba(255,107,129,.75)', // pink
    'rgba(72,219,251,.75)',  // sky
  ];
  const ssDataset = {
    label: 'Start Set',
    data: h.map(e => e.startSetReps),
    backgroundColor: 'rgba(225,112,85,.85)', // orange/red for SS
    borderRadius: 4,
    stack: 'reps',
    // Store weights for tooltips
    weights: h.map(e => e.weight)
  };
  const miniSetDatasets = [];
  for (let i = 0; i < maxMiniSets; i++) {
    miniSetDatasets.push({
      label: `Mini-Set ${i + 1}`,
      data: h.map(e => {
        const s = (e.sets || [])[i];
        if (!s) return 0;
        return typeof s === 'object' ? s.reps : s;
      }),
      backgroundColor: miniSetColors[i % miniSetColors.length],
      borderRadius: 4,
      stack: 'reps',
      weights: h.map(e => {
        const s = (e.sets || [])[i];
        if (!s) return null;
        return typeof s === 'object' ? s.weight : e.weight;
      })
    });
  }
  repsChart = new Chart(document.getElementById('reps-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [ssDataset, ...miniSetDatasets]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: '#8892a4', font: { size: 10 }, boxWidth: 12, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const ds = ctx.dataset;
              const reps = ctx.parsed.y;
              if (reps === 0) return null;
              const weight = ds.weights ? ds.weights[ctx.dataIndex] : null;
              const w = weight != null ? ` @ ${weight}kg` : '';
              return `${ds.label}: ${reps} Reps${w}`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#8892a4' }, grid: { display: false } },
        y: {
          stacked: true,
          min: 0,
          suggestedMax: 32,
          ticks: { color: '#8892a4', stepSize: 5 },
          grid: { color: 'rgba(45,50,68,.5)' }
        }
      }
    }
  });

  // Volume trend chart
  if (volumeChart) volumeChart.destroy();
  const volumeData = h.map(e => e.volume || 0);
  volumeChart = new Chart(document.getElementById('volume-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Volumen (kg)', data: volumeData,
        borderColor: '#00b894', backgroundColor: 'rgba(0,184,148,.1)',
        fill: true, tension: 0.3, pointRadius: 5,
        pointBackgroundColor: '#00b894', pointBorderColor: '#fff', pointBorderWidth: 2
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
  // Build mini-set rows
  const miniSets = (entry.sets || []).map(s =>
    typeof s === 'object' ? { reps: s.reps, weight: s.weight } : { reps: s, weight: entry.weight }
  );
  renderEditMiniSets(miniSets);
  document.getElementById('edit-modal').classList.add('active');
}

function renderEditMiniSets(miniSets) {
  const container = document.getElementById('edit-mini-sets-list');
  container.innerHTML = miniSets.map((s, i) => `
    <div class="edit-mini-set-row" data-idx="${i}">
      <div class="edit-mini-set-num">${i + 1}</div>
      <div class="form-group">
        <label>Reps</label>
        <input type="number" class="edit-mini-reps" value="${s.reps}" min="0">
      </div>
      <div class="form-group">
        <label>kg</label>
        <input type="number" class="edit-mini-weight" value="${s.weight}" step="0.5" min="0">
      </div>
      <button type="button" class="edit-mini-remove" onclick="removeEditMiniSet(${i})" aria-label="Mini-Set entfernen">✕</button>
    </div>
  `).join('');
}

function getEditMiniSetsFromDOM() {
  const rows = document.querySelectorAll('#edit-mini-sets-list .edit-mini-set-row');
  const result = [];
  rows.forEach(row => {
    const reps = parseInt(row.querySelector('.edit-mini-reps').value) || 0;
    const weight = parseFloat(row.querySelector('.edit-mini-weight').value) || 0;
    if (reps > 0) result.push({ reps, weight });
  });
  return result;
}

function addEditMiniSet() {
  const current = getEditMiniSetsFromDOM();
  const ssWeight = parseFloat(document.getElementById('edit-weight').value) || 0;
  current.push({ reps: 4, weight: ssWeight });
  renderEditMiniSets(current);
}

function removeEditMiniSet(idx) {
  const current = getEditMiniSetsFromDOM();
  current.splice(idx, 1);
  renderEditMiniSets(current);
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
  const miniSets = getEditMiniSetsFromDOM();
  entry.sets = miniSets;
  entry.miniSetTotal = miniSets.reduce((sum, s) => sum + s.reps, 0);
  // Recalculate volume
  const miniSetVolume = miniSets.reduce((sum, s) => sum + s.reps * s.weight, 0);
  entry.volume = entry.startSetReps * entry.weight + miniSetVolume;
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
  // Try to load saved active workout from localStorage
  if (!activeWorkout) {
    const saved = loadActiveWorkout();
    if (saved && saved.activeWorkout) {
      activeWorkout = saved.activeWorkout;
      workoutLog = saved.workoutLog || [];
      // Restore stepper values from saved state
      woCurrentWeight = activeWorkout._woCurrentWeight || 0;
      woCurrentReps = activeWorkout._woCurrentReps || RULES.startSetTarget;
    }
  }
  // If a workout is already active, resume it instead of restarting
  if (activeWorkout) {
    showPage('page-workout');
    document.getElementById('workout-header').textContent = `Workout ${activeWorkout.type}`;
    renderExerciseNav();
    renderLastSessionInfo(activeWorkout.exercises[activeWorkout.exerciseIndex]);
    renderWorkoutState();
    return;
  }
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
  activeWorkout.startSetWeight = 0;
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

  renderExerciseNav();
  renderLastSessionInfo(exId);
  renderWorkoutState();
}

function renderExerciseNav() {
  if (!activeWorkout) return;
  const nav = document.getElementById('exercise-nav');
  const skippedIds = new Set(workoutLog.filter(l => l.skipped).map(l => l.exId));
  const doneIds = new Set(workoutLog.filter(l => !l.skipped).map(l => l.exId));
  nav.innerHTML = activeWorkout.exercises.map((id, i) => {
    const ex = EXERCISES[id];
    const isActive = i === activeWorkout.exerciseIndex;
    const isDone = doneIds.has(id);
    const isSkipped = skippedIds.has(id);
    let cls = 'exercise-nav-pill';
    if (isActive) cls += ' active';
    else if (isDone) cls += ' done';
    else if (isSkipped) cls += ' skipped';
    return `<button class="${cls}" onclick="jumpToExercise(${i})">${ex.name}</button>`;
  }).join('');
  // Scroll active pill into view
  const activePill = nav.querySelector('.active');
  if (activePill) activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function jumpToExercise(index) {
  if (!activeWorkout || index === activeWorkout.exerciseIndex) return;
  // If current exercise has a completed start set but mini-sets aren't done, confirm
  if (activeWorkout.startSetDone && activeWorkout.miniSetTotal < RULES.miniSetRepsTarget) {
    showModal(
      'Übung wechseln?',
      'Die aktuelle Übung ist noch nicht abgeschlossen. Fortschritt geht verloren.',
      'Wechseln',
      () => { doJumpToExercise(index); }
    );
  } else {
    doJumpToExercise(index);
  }
}

function doJumpToExercise(index) {
  // Don't save incomplete exercise
  activeWorkout.exerciseIndex = index;
  loadExerciseIntoWorkout();
}

function renderLastSessionInfo(exId) {
  const box = document.getElementById('wo-last-info');
  const h = history[exId] || [];
  if (h.length === 0) {
    box.style.display = 'none';
    return;
  }
  const last = h[h.length - 1];
  const sug = getSuggestion(exId);
  let html = `<div class="last-info-title">Letztes Workout</div>`;
  // Start set row with last weight vs suggested
  html += `<div class="last-info-row">
    <span class="last-info-label">Start Set</span>
    <span class="last-info-value">${last.startSetReps} Reps @ ${last.weight}kg</span>
  </div>`;
  if (sug.weight !== last.weight) {
    html += `<div class="last-info-row">
      <span class="last-info-label">Vorschlag heute</span>
      <span class="last-info-value" style="color:var(--accent-light)">${sug.weight}kg</span>
    </div>`;
  }
  // Mini-sets from last session
  if (last.sets && last.sets.length > 0) {
    const miniSetDetails = last.sets.map((s, i) => {
      if (typeof s === 'object') return `${s.reps}×${s.weight}kg`;
      return `${s} Reps`;
    }).join(' · ');
    html += `<div class="last-info-row" style="margin-top:4px">
      <span class="last-info-label">Mini-Sets</span>
      <span class="last-info-value">${miniSetDetails}</span>
    </div>`;
  }
  box.innerHTML = html;
  box.style.display = '';
}

function renderWorkoutState() {
  if (!activeWorkout) return;
  // Persist current stepper values for reload
  activeWorkout._woCurrentWeight = woCurrentWeight;
  activeWorkout._woCurrentReps = woCurrentReps;
  saveActiveWorkout();
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
      `Start Set: ${activeWorkout.startSetReps} Reps @ ${activeWorkout.startSetWeight}kg (unabhängig)`;
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
    setsLog.innerHTML = activeWorkout.currentMiniSets.map((entry, i) => {
      const reps = typeof entry === 'object' ? entry.reps : entry;
      const w = typeof entry === 'object' ? entry.weight : woCurrentWeight;
      cumul += reps;
      return `<div class="set-entry">
        <div class="set-num">${i + 1}</div>
        <div class="set-reps">${reps} Reps @ ${w}kg</div>
        <div class="set-cumulative">${cumul}/${RULES.miniSetRepsTarget}</div>
      </div>`;
    }).join('');
  }

  // Show last weight hint in stepper
  const exId = activeWorkout.exercises[activeWorkout.exerciseIndex];
  const lastH = (history[exId] || []);
  const lastEntry = lastH.length > 0 ? lastH[lastH.length - 1] : null;
  const weightHint = document.querySelector('#wo-weight-section .stepper-unit');
  if (lastEntry && !isStartSet) {
    const miniSetIdx = activeWorkout.currentMiniSets.length;
    const lastSets = lastEntry.sets || [];
    if (miniSetIdx < lastSets.length && typeof lastSets[miniSetIdx] === 'object') {
      weightHint.textContent = `kg (±2.5) · Letztes Mal Mini-Set ${miniSetIdx + 1}: ${lastSets[miniSetIdx].weight}kg`;
    } else {
      weightHint.textContent = `kg (±2.5) · Letztes Mal SS: ${lastEntry.weight}kg`;
    }
  } else if (lastEntry) {
    weightHint.textContent = `kg (±2.5) · Letztes Mal: ${lastEntry.weight}kg`;
  } else {
    weightHint.textContent = 'kg (±2.5) · Tippe auf Zahl zum Eintippen';
  }

  // Weight stepper always visible (user can adjust weight for mini-sets too)
  document.getElementById('wo-weight-section').style.display = '';

  // Undo button: show if any set has been done
  const hasAnySets = activeWorkout.startSetDone || activeWorkout.currentMiniSets.length > 0;
  document.getElementById('wo-undo-btn').style.display = hasAnySets && !done ? '' : 'none';

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
    const handledIds = new Set(workoutLog.map(l => l.exId));
    // Check if this is the last undone exercise
    const remainingUndone = activeWorkout.exercises.filter((id, i) =>
      i !== activeWorkout.exerciseIndex && !handledIds.has(id)
    );
    const isLast = remainingUndone.length === 0;
    document.getElementById('wo-next-btn').textContent = isLast ? '🏁 WORKOUT BEENDEN' : 'NÄCHSTE ÜBUNG →';
  }

  // Hide skip button if exercise is already in progress (sets logged)
  const hasProgress = activeWorkout.startSetDone || activeWorkout.currentMiniSets.length > 0;
  document.getElementById('wo-skip-btn').style.display = (hasProgress || done) ? 'none' : '';
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
    activeWorkout.startSetWeight = woCurrentWeight;
    activeWorkout.startSetDone = true;
    showToast(`Start Set: ${woCurrentReps} Reps @ ${woCurrentWeight}kg ✓`);
    woCurrentReps = Math.min(5, RULES.miniSetRepsTarget);
    renderWorkoutState();
    startTimer();
  } else {
    // Mini-set — store with weight
    activeWorkout.currentMiniSets.push({ reps: woCurrentReps, weight: woCurrentWeight });
    activeWorkout.miniSetTotal += woCurrentReps;

    if (activeWorkout.miniSetTotal >= RULES.miniSetRepsTarget) {
      showToast('20 Mini-Set Reps erreicht! ✓');
      renderWorkoutState();
    } else {
      // If ≥8 reps in this mini-set → adjust weight for next mini-set
      if (woCurrentReps >= RULES.weightUpThreshold) {
        const exId = activeWorkout.exercises[activeWorkout.exerciseIndex];
        const ex = EXERCISES[exId];
        const delta = ex.invertProgress ? -2.5 : 2.5;
        woCurrentWeight = Math.max(0, +(woCurrentWeight + delta).toFixed(1));
        if (ex.invertProgress) {
          showToast(`${woCurrentReps} Reps → Unterstützung auf ${woCurrentWeight}kg reduziert!`);
        } else {
          showToast(`${woCurrentReps} Reps → Gewicht auf ${woCurrentWeight}kg erhöht!`);
        }
      }
      const remaining = RULES.miniSetRepsTarget - activeWorkout.miniSetTotal;
      woCurrentReps = Math.min(4, remaining);
      renderWorkoutState();
      startTimer();
    }
  }
}

function skipExercise() {
  if (!activeWorkout) return;
  showModal(
    'Übung überspringen?',
    'Diese Übung wird übersprungen und nicht gespeichert.',
    'Überspringen',
    () => {
      const exId = activeWorkout.exercises[activeWorkout.exerciseIndex];
      // Mark as skipped in workoutLog so nav can grey it out
      workoutLog.push({ exId, skipped: true });

      if (activeWorkout.exerciseIndex >= activeWorkout.exercises.length - 1) {
        // Check if there are still undone exercises before summary
        const doneOrSkipped = new Set(workoutLog.map(l => l.exId));
        const remaining = activeWorkout.exercises.filter(id => !doneOrSkipped.has(id));
        if (remaining.length === 0) {
          showWorkoutSummary();
          return;
        }
        // Jump to first remaining
        activeWorkout.exerciseIndex = activeWorkout.exercises.indexOf(remaining[0]);
        loadExerciseIntoWorkout();
        return;
      }
      // Find next undone exercise
      const doneIds = new Set(workoutLog.map(l => l.exId));
      let nextIdx = activeWorkout.exerciseIndex + 1;
      while (nextIdx < activeWorkout.exercises.length && doneIds.has(activeWorkout.exercises[nextIdx])) {
        nextIdx++;
      }
      if (nextIdx >= activeWorkout.exercises.length) {
        // Loop back to find any unskipped earlier
        const remaining = activeWorkout.exercises.filter(id => !doneIds.has(id));
        if (remaining.length === 0) {
          showWorkoutSummary();
          return;
        }
        activeWorkout.exerciseIndex = activeWorkout.exercises.indexOf(remaining[0]);
      } else {
        activeWorkout.exerciseIndex = nextIdx;
      }
      loadExerciseIntoWorkout();
    }
  );
}

function nextExercise() {
  const exId = activeWorkout.exercises[activeWorkout.exerciseIndex];
  if (!history[exId]) history[exId] = [];
  // Calculate volume: start set uses its own weight, mini-sets may have different weights
  const startSetWeight = activeWorkout.startSetWeight || woCurrentWeight;
  let miniSetVolume = 0;
  activeWorkout.currentMiniSets.forEach(entry => {
    if (typeof entry === 'object') {
      miniSetVolume += entry.reps * entry.weight;
    } else {
      miniSetVolume += entry * woCurrentWeight;
    }
  });
  const totalVolume = (activeWorkout.startSetReps * startSetWeight) + miniSetVolume;
  // Store mini-sets with weights
  const miniSetsWithWeights = activeWorkout.currentMiniSets.map(e =>
    typeof e === 'object' ? { reps: e.reps, weight: e.weight } : { reps: e, weight: woCurrentWeight }
  );
  const entry = {
    date: new Date().toISOString().split('T')[0],
    weight: startSetWeight,
    startSetReps: activeWorkout.startSetReps,
    miniSetTotal: activeWorkout.miniSetTotal,
    sets: miniSetsWithWeights,
    volume: totalVolume
  };
  history[exId].push(entry);
  saveHistory();

  workoutLog.push({ exId, ...entry });

  // Find next exercise that hasn't been done or skipped yet
  const handledIds = new Set(workoutLog.map(l => l.exId));
  const remainingExs = activeWorkout.exercises.filter(id => !handledIds.has(id));
  if (remainingExs.length === 0) {
    showWorkoutSummary();
    return;
  }
  // Prefer next in order after current index
  let nextIdx = activeWorkout.exerciseIndex + 1;
  while (nextIdx < activeWorkout.exercises.length && handledIds.has(activeWorkout.exercises[nextIdx])) {
    nextIdx++;
  }
  if (nextIdx >= activeWorkout.exercises.length) {
    // Wrap around to first remaining
    nextIdx = activeWorkout.exercises.indexOf(remainingExs[0]);
  }
  activeWorkout.exerciseIndex = nextIdx;
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
  workoutLog = [];
  saveActiveWorkout();
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
  saveActiveWorkout();

  document.getElementById('summary-subtitle').textContent =
    `Workout ${type} · ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`;

  const completedLog = workoutLog.filter(l => !l.skipped);
  document.getElementById('summary-exercises').textContent = completedLog.length;

  let totalVolume = 0;
  let weightIncreases = 0;

  const listHtml = workoutLog.map(log => {
    const ex = EXERCISES[log.exId];
    if (log.skipped) {
      return `<div class="summary-exercise skipped">
        <div>
          <div class="name">${ex.name}</div>
          <div class="summary-detail">⏭ Übersprungen</div>
        </div>
      </div>`;
    }
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
    exercises: EXERCISES,
    exportDate: new Date().toISOString(),
    version: 'fittrack_v3'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fittrack-${new Date().toISOString().split('T')[0]}.json`;
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
            if (data.exercises) { EXERCISES = data.exercises; saveExercises(); }
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
      localStorage.removeItem('fittrack_exercises');
      history = {};
      meta = { nextWorkout: 'A', lastWorkoutDate: null };
      EXERCISES = JSON.parse(JSON.stringify(DEFAULT_EXERCISES));
      renderDashboard();
      showPage('page-dashboard');
      showToast('Daten gelöscht');
    }
  );
}

// ========== HEATMAP ==========
function renderHeatmap() {
  const container = document.getElementById('heatmap-container');
  const allDates = {};
  Object.values(history).flat().forEach(e => {
    allDates[e.date] = (allDates[e.date] || 0) + 1;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeks = 16;
  const totalDays = weeks * 7;

  // Find the start: go back to the Monday of (weeks) ago
  const endDay = new Date(today);
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - totalDays + 1);
  // Align to Monday
  const dayOfWeek = startDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startDay.setDate(startDay.getDate() + mondayOffset);

  // Build day cells
  const days = [];
  const d = new Date(startDay);
  while (d <= endDay) {
    const dateStr = d.toISOString().split('T')[0];
    const count = allDates[dateStr] || 0;
    const isToday = d.getTime() === today.getTime();
    let level = 0;
    if (count >= 5) level = 3;
    else if (count >= 3) level = 2;
    else if (count >= 1) level = 1;
    days.push({ dateStr, level, isToday, date: new Date(d) });
    d.setDate(d.getDate() + 1);
  }

  // Month labels
  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  let monthLabelsHtml = '<div class="heatmap-month-labels">';
  let lastMonth = -1;
  for (let i = 0; i < days.length; i += 7) {
    const m = days[i].date.getMonth();
    if (m !== lastMonth) {
      monthLabelsHtml += `<span class="month-label">${monthNames[m]}</span>`;
      lastMonth = m;
    } else {
      monthLabelsHtml += `<span class="month-label"></span>`;
    }
  }
  monthLabelsHtml += '</div>';

  // Day labels
  const dayLabels = ['Mo', '', 'Mi', '', 'Fr', '', 'So'];
  const dayLabelsHtml = `<div class="heatmap-day-labels">${dayLabels.map(l => `<span>${l}</span>`).join('')}</div>`;

  // Grid
  const gridHtml = days.map(day => {
    const cls = `heatmap-day level-${day.level}${day.isToday ? ' today' : ''}`;
    const title = `${new Date(day.dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
    return `<div class="${cls}" title="${title}"></div>`;
  }).join('');

  container.innerHTML = `
    <div style="display:flex">
      ${dayLabelsHtml}
      <div class="heatmap-wrapper">
        ${monthLabelsHtml}
        <div class="heatmap">${gridHtml}</div>
      </div>
    </div>
    <div class="heatmap-legend">
      <span>Weniger</span>
      <div class="swatch heatmap-day"></div>
      <div class="swatch heatmap-day level-1"></div>
      <div class="swatch heatmap-day level-2"></div>
      <div class="swatch heatmap-day level-3"></div>
      <span>Mehr</span>
    </div>`;

  // Auto-scroll to the right end so the most recent week (today) is visible
  const wrapper = container.querySelector('.heatmap-wrapper');
  if (wrapper) wrapper.scrollLeft = wrapper.scrollWidth;
}

// ========== UNDO LAST SET ==========
function undoLastSet() {
  if (!activeWorkout) return;

  if (activeWorkout.currentMiniSets.length > 0) {
    // Undo last mini-set
    const last = activeWorkout.currentMiniSets.pop();
    const reps = typeof last === 'object' ? last.reps : last;
    const weight = typeof last === 'object' ? last.weight : woCurrentWeight;
    activeWorkout.miniSetTotal -= reps;
    woCurrentReps = reps;
    woCurrentWeight = weight;
    showToast(`Mini-Set rückgängig: ${reps} Reps`);
    renderWorkoutState();
  } else if (activeWorkout.startSetDone) {
    // Undo start set
    woCurrentReps = activeWorkout.startSetReps;
    woCurrentWeight = activeWorkout.startSetWeight;
    activeWorkout.startSetReps = 0;
    activeWorkout.startSetDone = false;
    activeWorkout.startSetWeight = 0;
    document.getElementById('wo-start-set-info').style.display = 'none';
    document.getElementById('wo-start-set-info').classList.remove('visible');
    showToast('Start Set rückgängig');
    renderWorkoutState();
  }
}

// ========== EXERCISE MANAGEMENT ==========
let editingExerciseId = null;

function renderExerciseManageList() {
  const container = document.getElementById('exercise-manage-list');
  const sorted = Object.entries(EXERCISES).sort((a, b) => {
    if (a[1].workout !== b[1].workout) return a[1].workout.localeCompare(b[1].workout);
    return a[1].order - b[1].order;
  });

  container.innerHTML = sorted.map(([id, ex]) => {
    const badgeClass = ex.workout === 'A' ? 'workout-badge-a' : 'workout-badge-b';
    return `<div class="exercise-manage-item">
      <div class="exercise-manage-info">
        <div class="exercise-manage-name">
          <span class="workout-badge ${badgeClass}">${ex.workout}</span>
          ${ex.icon} ${ex.name}
        </div>
        <div class="exercise-manage-meta">
          ${ex.ss}kg → ${ex.current}kg${ex.invertProgress ? ' (Unterstützung)' : ''}
        </div>
      </div>
      <div class="exercise-manage-actions">
        <button class="icon-btn edit" onclick="openEditExercise('${id}')" title="Bearbeiten" aria-label="${ex.name} bearbeiten">✏️</button>
        <button class="icon-btn delete" onclick="deleteExercise('${id}')" title="Löschen" aria-label="${ex.name} löschen">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function openAddExercise() {
  editingExerciseId = null;
  document.getElementById('exercise-modal-title').textContent = 'Übung hinzufügen';
  document.getElementById('ex-name').value = '';
  document.getElementById('ex-muscles').value = '';
  document.getElementById('ex-workout').value = 'A';
  document.getElementById('ex-icon').value = '🏋️';
  document.getElementById('ex-start-weight').value = '10';
  document.getElementById('ex-current-weight').value = '10';
  document.getElementById('ex-invert').checked = false;
  document.getElementById('exercise-modal').classList.add('active');
}

function openEditExercise(id) {
  editingExerciseId = id;
  const ex = EXERCISES[id];
  document.getElementById('exercise-modal-title').textContent = 'Übung bearbeiten';
  document.getElementById('ex-name').value = ex.name;
  document.getElementById('ex-muscles').value = ex.muscles || '';
  document.getElementById('ex-workout').value = ex.workout;
  document.getElementById('ex-icon').value = ex.icon;
  document.getElementById('ex-start-weight').value = ex.ss;
  document.getElementById('ex-current-weight').value = ex.current;
  document.getElementById('ex-invert').checked = ex.invertProgress;
  document.getElementById('exercise-modal').classList.add('active');
}

function closeExerciseModal() {
  document.getElementById('exercise-modal').classList.remove('active');
  editingExerciseId = null;
}

function saveExercise() {
  const name = document.getElementById('ex-name').value.trim();
  const muscles = document.getElementById('ex-muscles').value.trim();
  const workout = document.getElementById('ex-workout').value;
  const icon = document.getElementById('ex-icon').value;
  const ss = parseFloat(document.getElementById('ex-start-weight').value);
  const current = parseFloat(document.getElementById('ex-current-weight').value);
  const invertProgress = document.getElementById('ex-invert').checked;

  if (!name) { showToast('Bitte Name eingeben!'); return; }
  if (isNaN(ss) || isNaN(current)) { showToast('Bitte gültige Gewichte eingeben!'); return; }

  // Calculate order: append at end of workout group
  const sameWorkout = Object.values(EXERCISES).filter(e => e.workout === workout);
  const maxOrder = sameWorkout.length > 0 ? Math.max(...sameWorkout.map(e => e.order)) : 0;

  if (editingExerciseId) {
    // Edit existing
    const ex = EXERCISES[editingExerciseId];
    ex.name = name;
    ex.muscles = muscles;
    ex.workout = workout;
    ex.icon = icon;
    ex.ss = ss;
    ex.current = current;
    ex.invertProgress = invertProgress;
  } else {
    // Create new — generate ID from name
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
    const uniqueId = EXERCISES[id] ? id + '_' + Date.now() : id;
    EXERCISES[uniqueId] = { name, muscles, workout, order: maxOrder + 1, ss, current, icon, invertProgress };
  }

  saveExercises();
  closeExerciseModal();
  renderExerciseManageList();
  showToast(editingExerciseId ? 'Übung aktualisiert ✓' : 'Übung hinzugefügt ✓');
}

function deleteExercise(id) {
  const ex = EXERCISES[id];
  showModal(
    'Übung löschen?',
    `"${ex.name}" wirklich löschen? Die Trainingshistorie bleibt erhalten.`,
    'Löschen',
    () => {
      delete EXERCISES[id];
      saveExercises();
      renderExerciseManageList();
      showToast('Übung gelöscht');
    }
  );
}

// ========== INIT ==========
// Restore active workout from localStorage if present
(function initActiveWorkout() {
  const saved = loadActiveWorkout();
  if (saved && saved.activeWorkout) {
    activeWorkout = saved.activeWorkout;
    workoutLog = saved.workoutLog || [];
    woCurrentWeight = activeWorkout._woCurrentWeight || 0;
    woCurrentReps = activeWorkout._woCurrentReps || RULES.startSetTarget;
  }
})();
renderDashboard();

// ========== PWA SERVICE WORKER ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
  });
}
