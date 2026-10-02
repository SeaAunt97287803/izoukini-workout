(function () {
  "use strict";

  const STORAGE_KEY = "izoukini-workout-state-v1";
  const workout = JSON.parse(document.getElementById("workout-data").textContent);
  const totalSets = workout.exercises.reduce(function (total, exercise) {
    return total + exercise.sets.length;
  }, 0);

  const elements = {
    exerciseList: document.getElementById("exercise-list"),
    setsProgress: document.getElementById("sets-progress"),
    exercisesProgress: document.getElementById("exercises-progress"),
    progressPercent: document.getElementById("progress-percent"),
    progressTrack: document.getElementById("progress-track"),
    progressFill: document.getElementById("progress-fill"),
    sessionTime: document.getElementById("session-time"),
    startSession: document.getElementById("start-session"),
    resetWorkout: document.getElementById("reset-workout"),
    restDock: document.getElementById("rest-dock"),
    restRing: document.getElementById("rest-ring"),
    restTime: document.getElementById("rest-time"),
    restTitle: document.getElementById("rest-title"),
    restStatus: document.getElementById("rest-status"),
    pauseRest: document.getElementById("pause-rest"),
    skipRest: document.getElementById("skip-rest"),
    toast: document.getElementById("toast"),
    installButton: document.getElementById("install-button"),
    installDialog: document.getElementById("install-dialog")
  };

  const blankState = function () {
    return {
      sets: {},
      exercises: {},
      sessionStartedAt: null,
      sessionFinishedAt: null
    };
  };

  let state = loadState();
  let deferredInstallPrompt = null;
  let toastTimeout = null;
  const plankTimers = new Map();
  const restTimer = {
    total: 0,
    remaining: 0,
    running: false,
    endAt: 0,
    title: "Entre les séries",
    visible: false
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") {
        return blankState();
      }

      return {
        sets: saved.sets && typeof saved.sets === "object" ? saved.sets : {},
        exercises: saved.exercises && typeof saved.exercises === "object" ? saved.exercises : {},
        sessionStartedAt: Number.isFinite(saved.sessionStartedAt) ? saved.sessionStartedAt : null,
        sessionFinishedAt: Number.isFinite(saved.sessionFinishedAt) ? saved.sessionFinishedAt : null
      };
    } catch (error) {
      return blankState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("La progression ne peut pas être sauvegardée sur cet appareil.");
    }
  }

  function setKey(exerciseId, setIndex) {
    return exerciseId + ":" + setIndex;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function checkIcon() {
    return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg>';
  }

  function renderWorkout() {
    elements.exerciseList.innerHTML = workout.exercises.map(function (exercise, exerciseIndex) {
      const sets = exercise.sets.map(function (set, setIndex) {
        const key = setKey(exercise.id, setIndex);
        const checked = Boolean(state.sets[key]);
        const timerControls = exercise.kind === "timed"
          ? '<div class="plank-timer" data-plank-timer="' + setIndex + '">' +
              '<strong class="plank-time">' + formatClock(set.duration) + '</strong>' +
              '<button class="timer-button" type="button" data-action="toggle-plank" data-set-index="' + setIndex + '">Démarrer</button>' +
              '<button class="timer-button" type="button" data-action="reset-plank" data-set-index="' + setIndex + '">↺</button>' +
            '</div>'
          : "";

        return '<div class="set-row' + (checked ? " is-checked" : "") + '" data-set-row="' + setIndex + '">' +
          '<label class="set-check">' +
            '<input class="set-checkbox" type="checkbox" data-exercise-id="' + exercise.id + '" data-set-index="' + setIndex + '"' + (checked ? " checked" : "") + '>' +
            '<span class="check-ui">' + checkIcon() + '</span>' +
            '<span class="set-details"><strong>' + escapeHtml(set.label) + '</strong><span>' + escapeHtml(set.target) + '</span></span>' +
          '</label>' +
          timerControls +
        '</div>';
      }).join("");

      const allSetsDone = exercise.sets.every(function (_set, setIndex) {
        return Boolean(state.sets[setKey(exercise.id, setIndex)]);
      });
      const exerciseDone = Boolean(state.exercises[exercise.id]) && allSetsDone;

      return '<article class="exercise-card' + (exerciseDone ? " is-complete" : "") + '" data-exercise-card="' + exercise.id + '">' +
        '<header class="exercise-card-header">' +
          '<span class="exercise-number">' + String(exerciseIndex + 1).padStart(2, "0") + '</span>' +
          '<div><span class="exercise-kicker">EXERCICE ' + String(exerciseIndex + 1).padStart(2, "0") + '</span><h3>' + escapeHtml(exercise.name) + '</h3></div>' +
          '<span class="exercise-status">' + (exerciseDone ? "TERMINÉ" : "À FAIRE") + '</span>' +
        '</header>' +
        '<div class="sets-list">' + sets + '</div>' +
        '<div class="exercise-complete-wrap">' +
          '<label class="exercise-complete">' +
            '<input class="exercise-checkbox" type="checkbox" data-exercise-id="' + exercise.id + '"' + (exerciseDone ? " checked" : "") + (allSetsDone ? "" : " disabled") + '>' +
            '<span class="check-ui">' + checkIcon() + '</span>' +
            '<span>' + (exercise.id === "push-ups" ? "Séance terminée" : "J’ai terminé cet exercice") + '</span>' +
          '</label>' +
        '</div>' +
      '</article>';
    }).join("");

    initializePlankTimers();
    updateProgress();
  }

  function initializePlankTimers() {
    const plank = workout.exercises.find(function (exercise) {
      return exercise.kind === "timed";
    });

    if (!plank) {
      return;
    }

    plank.sets.forEach(function (set, index) {
      if (!plankTimers.has(index)) {
        plankTimers.set(index, {
          duration: set.duration,
          remaining: set.duration,
          running: false,
          endAt: 0,
          completed: false
        });
      }
      updatePlankTimer(index);
    });
  }

  function exerciseById(exerciseId) {
    return workout.exercises.find(function (exercise) {
      return exercise.id === exerciseId;
    });
  }

  function exerciseIndexById(exerciseId) {
    return workout.exercises.findIndex(function (exercise) {
      return exercise.id === exerciseId;
    });
  }

  function allSetsDone(exercise) {
    return exercise.sets.every(function (_set, setIndex) {
      return Boolean(state.sets[setKey(exercise.id, setIndex)]);
    });
  }

  function handleSetChange(input) {
    const exercise = exerciseById(input.dataset.exerciseId);
    const setIndex = Number(input.dataset.setIndex);
    if (!exercise || !Number.isInteger(setIndex)) {
      return;
    }

    ensureSessionStarted();
    state.sets[setKey(exercise.id, setIndex)] = input.checked;

    if (!input.checked) {
      state.exercises[exercise.id] = false;
      state.sessionFinishedAt = null;
    } else if (setIndex < exercise.sets.length - 1) {
      startRest(workout.restBetweenSets, "Repos avant la série " + (setIndex + 2));
    }

    saveState();
    updateExerciseCard(exercise);
    updateProgress();
  }

  function handleExerciseChange(input) {
    const exercise = exerciseById(input.dataset.exerciseId);
    if (!exercise) {
      return;
    }

    if (!allSetsDone(exercise)) {
      input.checked = false;
      return;
    }

    ensureSessionStarted();
    state.exercises[exercise.id] = input.checked;
    if (!input.checked) {
      state.sessionFinishedAt = null;
    } else if (exerciseIndexById(exercise.id) < workout.exercises.length - 1) {
      startRest(workout.restBetweenExercises, "Repos après " + exercise.name);
    }

    saveState();
    updateExerciseCard(exercise);
    updateProgress();
  }

  function updateExerciseCard(exercise) {
    const card = elements.exerciseList.querySelector('[data-exercise-card="' + exercise.id + '"]');
    if (!card) {
      return;
    }

    exercise.sets.forEach(function (_set, setIndex) {
      const row = card.querySelector('[data-set-row="' + setIndex + '"]');
      const checkbox = row ? row.querySelector(".set-checkbox") : null;
      const checked = Boolean(state.sets[setKey(exercise.id, setIndex)]);
      if (row) {
        row.classList.toggle("is-checked", checked);
      }
      if (checkbox && checkbox.checked !== checked) {
        checkbox.checked = checked;
      }
    });

    const ready = allSetsDone(exercise);
    const completeInput = card.querySelector(".exercise-checkbox");
    if (!ready) {
      state.exercises[exercise.id] = false;
    }
    const completed = ready && Boolean(state.exercises[exercise.id]);
    completeInput.disabled = !ready;
    completeInput.checked = completed;
    card.classList.toggle("is-complete", completed);
    card.querySelector(".exercise-status").textContent = completed ? "TERMINÉ" : "À FAIRE";
  }

  function updateProgress() {
    let finishedSets = 0;
    let finishedExercises = 0;

    workout.exercises.forEach(function (exercise) {
      exercise.sets.forEach(function (_set, setIndex) {
        if (state.sets[setKey(exercise.id, setIndex)]) {
          finishedSets += 1;
        }
      });
      if (state.exercises[exercise.id] && allSetsDone(exercise)) {
        finishedExercises += 1;
      }
    });

    const percent = Math.round((finishedSets / totalSets) * 100);
    elements.setsProgress.textContent = finishedSets + "/" + totalSets;
    elements.exercisesProgress.textContent = finishedExercises + "/" + workout.exercises.length;
    elements.progressPercent.textContent = percent + "%";
    elements.progressFill.style.width = percent + "%";
    elements.progressTrack.setAttribute("aria-valuenow", String(percent));

    if (finishedExercises === workout.exercises.length && !state.sessionFinishedAt) {
      state.sessionFinishedAt = Date.now();
      saveState();
      signalCompletion();
      showToast("Séance terminée. Bravo !");
    }
  }

  function ensureSessionStarted() {
    if (!state.sessionStartedAt) {
      state.sessionStartedAt = Date.now();
      state.sessionFinishedAt = null;
      saveState();
      updateSessionClock();
    }
  }

  function updateSessionClock() {
    if (!state.sessionStartedAt) {
      elements.sessionTime.textContent = "00:00";
      elements.startSession.textContent = "Démarrer la séance";
      elements.startSession.disabled = false;
      return;
    }

    const end = state.sessionFinishedAt || Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((end - state.sessionStartedAt) / 1000));
    elements.sessionTime.textContent = formatLongClock(elapsedSeconds);
    elements.startSession.textContent = state.sessionFinishedAt ? "Séance terminée" : "Séance en cours";
    elements.startSession.disabled = Boolean(state.sessionFinishedAt);
  }

  function startRest(seconds, title) {
    restTimer.total = seconds;
    restTimer.remaining = seconds;
    restTimer.running = true;
    restTimer.endAt = Date.now() + seconds * 1000;
    restTimer.title = title;
    restTimer.visible = true;
    elements.restStatus.textContent = "Respire et prépare la suite.";
    updateRestTimer();
  }

  function toggleRestPause() {
    if (!restTimer.visible) {
      return;
    }

    if (restTimer.remaining <= 0) {
      hideRestTimer();
      return;
    }

    if (restTimer.running) {
      restTimer.remaining = secondsUntil(restTimer.endAt);
      restTimer.running = false;
    } else {
      restTimer.endAt = Date.now() + restTimer.remaining * 1000;
      restTimer.running = true;
    }
    updateRestTimer();
  }

  function hideRestTimer() {
    restTimer.running = false;
    restTimer.visible = false;
    elements.restDock.classList.remove("is-visible");
    elements.restDock.setAttribute("aria-hidden", "true");
  }

  function updateRestTimer() {
    if (!restTimer.visible) {
      return;
    }

    if (restTimer.running) {
      restTimer.remaining = secondsUntil(restTimer.endAt);
    }

    if (restTimer.running && restTimer.remaining <= 0) {
      restTimer.running = false;
      restTimer.remaining = 0;
      elements.restStatus.textContent = "C’est reparti !";
      signalCompletion();
      showToast("Repos terminé");
    }

    const progress = restTimer.total > 0 ? (restTimer.remaining / restTimer.total) * 100 : 0;
    elements.restDock.classList.add("is-visible");
    elements.restDock.setAttribute("aria-hidden", "false");
    elements.restRing.style.setProperty("--rest-progress", progress + "%");
    elements.restTime.textContent = formatClock(restTimer.remaining);
    elements.restTitle.textContent = restTimer.remaining <= 0 ? "Repos terminé" : restTimer.title;
    elements.pauseRest.textContent = restTimer.remaining <= 0 ? "Fermer" : (restTimer.running ? "Pause" : "Reprendre");
  }

  function togglePlankTimer(setIndex) {
    const timer = plankTimers.get(setIndex);
    if (!timer) {
      return;
    }

    ensureSessionStarted();
    plankTimers.forEach(function (otherTimer, otherIndex) {
      if (otherIndex !== setIndex && otherTimer.running) {
        otherTimer.remaining = secondsUntil(otherTimer.endAt);
        otherTimer.running = false;
        updatePlankTimer(otherIndex);
      }
    });

    if (timer.running) {
      timer.remaining = secondsUntil(timer.endAt);
      timer.running = false;
    } else {
      if (timer.remaining <= 0) {
        timer.remaining = timer.duration;
        timer.completed = false;
      }
      timer.endAt = Date.now() + timer.remaining * 1000;
      timer.running = true;
    }
    updatePlankTimer(setIndex);
  }

  function resetPlankTimer(setIndex) {
    const timer = plankTimers.get(setIndex);
    if (!timer) {
      return;
    }
    timer.remaining = timer.duration;
    timer.running = false;
    timer.completed = false;
    updatePlankTimer(setIndex);
  }

  function tickPlankTimers() {
    plankTimers.forEach(function (timer, setIndex) {
      if (!timer.running) {
        return;
      }

      timer.remaining = secondsUntil(timer.endAt);
      if (timer.remaining <= 0) {
        timer.remaining = 0;
        timer.running = false;
        timer.completed = true;
        signalCompletion();
        showToast("Planche terminée — coche la série !");
      }
      updatePlankTimer(setIndex);
    });
  }

  function updatePlankTimer(setIndex) {
    const timer = plankTimers.get(setIndex);
    const container = elements.exerciseList.querySelector('[data-plank-timer="' + setIndex + '"]');
    if (!timer || !container) {
      return;
    }

    container.querySelector(".plank-time").textContent = formatClock(timer.remaining);
    const toggleButton = container.querySelector('[data-action="toggle-plank"]');
    toggleButton.textContent = timer.running ? "Pause" : (timer.remaining < timer.duration && timer.remaining > 0 ? "Reprendre" : "Démarrer");
    toggleButton.setAttribute("aria-label", toggleButton.textContent + " la minuterie de la série " + (setIndex + 1));
  }

  function secondsUntil(endAt) {
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }

  function formatClock(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = Math.floor(safeSeconds % 60);
    return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
  }

  function formatLongClock(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    if (hours > 0) {
      return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
    }
    return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
  }

  function signalCompletion() {
    if (navigator.vibrate) {
      navigator.vibrate([160, 90, 160]);
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        return;
      }
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.32);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.34);
      oscillator.addEventListener("ended", function () {
        context.close();
      });
    } catch (error) {
      // The visual timer still works when a browser blocks audio.
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimeout);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimeout = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 2600);
  }

  function resetWorkout() {
    const confirmed = window.confirm("Recommencer toute la séance et effacer les cases cochées ?");
    if (!confirmed) {
      return;
    }

    state = blankState();
    saveState();
    hideRestTimer();
    plankTimers.clear();
    renderWorkout();
    updateSessionClock();
    showToast("Nouvelle séance prête");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openInstallHelp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(function () {
        deferredInstallPrompt = null;
      });
      return;
    }
    elements.installDialog.showModal();
  }

  elements.exerciseList.addEventListener("change", function (event) {
    if (event.target.matches(".set-checkbox")) {
      handleSetChange(event.target);
    } else if (event.target.matches(".exercise-checkbox")) {
      handleExerciseChange(event.target);
    }
  });

  elements.exerciseList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    const setIndex = Number(button.dataset.setIndex);
    if (button.dataset.action === "toggle-plank") {
      togglePlankTimer(setIndex);
    } else if (button.dataset.action === "reset-plank") {
      resetPlankTimer(setIndex);
    }
  });

  elements.startSession.addEventListener("click", function () {
    ensureSessionStarted();
    document.getElementById("workout-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.pauseRest.addEventListener("click", toggleRestPause);
  elements.skipRest.addEventListener("click", hideRestTimer);
  elements.resetWorkout.addEventListener("click", resetWorkout);
  elements.installButton.addEventListener("click", openInstallHelp);

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  window.addEventListener("appinstalled", function () {
    showToast("Application ajoutée à l’écran d’accueil");
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {
        // The app remains usable online even if offline caching is unavailable.
      });
    });
  }

  renderWorkout();
  updateSessionClock();
  window.setInterval(function () {
    updateSessionClock();
    updateRestTimer();
    tickPlankTimers();
  }, 250);
})();
