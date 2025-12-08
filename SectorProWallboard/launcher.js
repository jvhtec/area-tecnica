// launcher.js

// ============================================
// SCREENSAVER PREVENTION METHODS
// ============================================
let wakeLock = null;
let activityInterval = null;

// Method 1: Wake Lock API (modern browsers)
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock acquired');

      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
      });

      return true;
    } catch (err) {
      console.log('Wake Lock not supported or failed:', err);
      return false;
    }
  }
  return false;
}

// Method 2: Periodic simulated activity (mouse/touch events)
function startActivitySimulation() {
  if (activityInterval) return;

  activityInterval = setInterval(() => {
    // Simulate a tiny mouse movement
    const event = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 1,
      clientY: 1
    });
    document.dispatchEvent(event);

    // Also simulate a touch event for touch displays
    const touchEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: []
    });
    document.dispatchEvent(touchEvent);
  }, 30000); // Every 30 seconds

  console.log('Activity simulation started');
}

function stopActivitySimulation() {
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
    console.log('Activity simulation stopped');
  }
}

// Method 3: Hidden video playback
function startVideoBlocker() {
  const video = document.getElementById('screensaver-blocker');
  if (video) {
    video.play().then(() => {
      console.log('Screensaver blocker video playing');
    }).catch(err => {
      console.log('Video blocker failed:', err);
    });
  }
}

function stopVideoBlocker() {
  const video = document.getElementById('screensaver-blocker');
  if (video) {
    video.pause();
    console.log('Screensaver blocker video stopped');
  }
}

// Initialize all screensaver prevention methods
async function initScreensaverPrevention() {
  await requestWakeLock();
  startActivitySimulation();
  startVideoBlocker();
}

// Stop all screensaver prevention methods
function stopScreensaverPrevention() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
  stopActivitySimulation();
  stopVideoBlocker();
}

// Re-acquire wake lock on visibility change (if page becomes visible again)
document.addEventListener('visibilitychange', async () => {
  if (!document.hidden && isViewing) {
    await requestWakeLock();
  }
});

// ============================================
// ORIGINAL CODE
// ============================================

const SOURCES = [
  {
    id: "produccion",
    name: "Producción",
    description: "Wallboard de producción",
    url: "https://sector-pro.work/wallboard/public/f3c98b2df1a4e7650fbd44c9ce19ab73c6d7a0e49b3f25ea18fd6740a2ce9b1d/produccion"
  },
  {
    id: "almacen",
    name: "Almacén",
    description: "Wallboard de almacén",
    url: "https://sector-pro.work/wallboard/public/f3c98b2df1a4e7650fbd44c9ce19ab73c6d7a0e49b3f25ea18fd6740a2ce9b1d/almacen"
  },
  {
    id: "oficinas",
    name: "Oficinas",
    description: "Wallboard de oficinas",
    url: "https://sector-pro.work/wallboard/public/f3c98b2df1a4e7650fbd44c9ce19ab73c6d7a0e49b3f25ea18fd6740a2ce9b1d/oficinas"
  }
];

let isViewing = false;

function initMenu() {
  const list = document.getElementById("source-list");
  list.innerHTML = "";

  SOURCES.forEach((src, index) => {
    const card = document.createElement("button");
    card.className = "source-card";
    card.setAttribute("data-id", src.id);
    card.setAttribute("tabindex", "0");

    card.innerHTML = `
      <div class="source-name">${src.name}</div>
      <div class="source-desc">${src.description}</div>
    `;

    card.addEventListener("click", () => loadSource(src.id));
    list.appendChild(card);

    if (index === 0) {
      card.classList.add("selected");
    }
  });

  document.addEventListener("keydown", handleGlobalKeys);
}

function handleGlobalKeys(e) {
  // LG WebOS Back button is 461. Escape is for PC testing.
  if (e.keyCode === 461 || e.key === "Escape") {
    if (isViewing) {
      backToMenu();
      e.preventDefault(); 
    }
    return;
  }

  if (!isViewing) {
    handleMenuNav(e);
  }
}

function handleMenuNav(e) {
  const cards = Array.from(document.querySelectorAll(".source-card"));
  if (!cards.length) return;

  const currentIndex = cards.findIndex(c => c.classList.contains("selected"));
  let idx = currentIndex >= 0 ? currentIndex : 0;

  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    idx = (idx + 1) % cards.length;
    setSelected(cards, idx);
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    idx = (idx - 1 + cards.length) % cards.length;
    setSelected(cards, idx);
  } else if (e.key === "Enter" || e.keyCode === 13) {
    const card = cards[idx];
    if (card) {
      loadSource(card.getAttribute("data-id"));
    }
  }
}

function setSelected(cards, index) {
  cards.forEach(c => c.classList.remove("selected"));
  const target = cards[index];
  if (target) {
    target.classList.add("selected");
    target.focus();
  }
}

function loadSource(id) {
  const src = SOURCES.find(s => s.id === id);
  if (!src) return;

  const iframe = document.getElementById("content-frame");
  iframe.src = src.url;

  document.getElementById("menu-screen").classList.add("hidden");
  document.getElementById("viewer-screen").classList.remove("hidden");
  
  isViewing = true;
  iframe.focus();
}

function backToMenu() {
  const iframe = document.getElementById("content-frame");
  iframe.src = "about:blank"; // Free up memory
  
  document.getElementById("viewer-screen").classList.add("hidden");
  document.getElementById("menu-screen").classList.remove("hidden");
  
  isViewing = false;

  const firstCard = document.querySelector(".source-card");
  if (firstCard) {
    const cards = Array.from(document.querySelectorAll(".source-card"));
    setSelected(cards, 0);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initScreensaverPrevention();
});
