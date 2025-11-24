// launcher.js

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
});
