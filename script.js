// === 🌐 DOM Elements ===
const mapContainer = document.getElementById("mapContainer");
const addNodeBtn = document.getElementById("addNodeBtn");
const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
const contextMenu = document.getElementById("contextMenu");
const minimap = document.getElementById("minimap");
const ctxMini = minimap.getContext("2d");
const jsonToggleBtn = document.getElementById('jsonToggleBtn');
const jsonPanel = document.getElementById('jsonPanel');
const jsonTextarea = document.getElementById('jsonTextarea');
const applyJsonBtn = document.getElementById('applyJsonBtn');
const closeJsonBtn = document.getElementById('closeJsonBtn');

// === 📌 State Variables ===
let nodes = [];
let undoStack = [];
let redoStack = [];
let selectedNode = null;
let contextTarget = null;
let isDarkMode = false;

// === 🧠 Create Node ===
function createNode(x, y, text = "New Node", id = null, icon = "🧠") {
  const node = document.createElement("div");
  node.className = "mind-node";
  node.innerHTML = `<span class="icon">${icon}</span> <span class="text">${text}</span>`;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  node.dataset.id = id || Date.now();

  node.addEventListener("mousedown", dragNode);
  node.addEventListener("contextmenu", showContextMenu);

  mapContainer.appendChild(node);
  nodes.push(node);
  updateMinimap();
  return node;
}

// === 🖱️ Drag Node ===
function dragNode(e) {
  e.preventDefault();
  const node = e.currentTarget;
  let offsetX = e.clientX - node.offsetLeft;
  let offsetY = e.clientY - node.offsetTop;

  function moveAt(ev) {
    node.style.left = `${ev.clientX - offsetX}px`;
    node.style.top = `${ev.clientY - offsetY}px`;
    updateMinimap();
  }

  function stopDrag() {
    window.removeEventListener("mousemove", moveAt);
    window.removeEventListener("mouseup", stopDrag);
    saveState();
  }

  window.addEventListener("mousemove", moveAt);
  window.addEventListener("mouseup", stopDrag);
}

// === 🖱️ Right Click Context Menu ===
function showContextMenu(e) {
  e.preventDefault();
  contextTarget = e.currentTarget;
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.display = "block";
}

// === 📋 Context Menu Actions ===
contextMenu.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action || !contextTarget) return;

  switch (action) {
    case "edit": {
      const textEl = contextTarget.querySelector(".text");
      const newText = prompt("Edit node text:", textEl.textContent);
      if (newText !== null) textEl.textContent = newText;
      break;
    }
    case "delete": {
      mapContainer.removeChild(contextTarget);
      nodes = nodes.filter((n) => n !== contextTarget);
      break;
    }
    case "color": {
      const newColor = prompt("Enter background color (e.g. #ffcc00 or red):");
      if (newColor) contextTarget.style.background = newColor;
      break;
    }
    case "icon": {
      const iconEl = contextTarget.querySelector(".icon");
      const newIcon = prompt("Enter emoji or icon text:", iconEl.textContent);
      if (newIcon !== null) iconEl.textContent = newIcon;
      break;
    }
  }

  contextMenu.style.display = "none";
  updateMinimap();
  saveState();
});

// === 🌗 Toggle Dark Mode ===
toggleDarkModeBtn.addEventListener("click", () => {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle("dark-mode", isDarkMode);
  toggleDarkModeBtn.textContent = isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode";
  updateMinimap();
});

// === ➕ Add Node Button ===
addNodeBtn.addEventListener("click", () => {
  const x = window.innerWidth / 2 + Math.random() * 100 - 50;
  const y = window.innerHeight / 2 + Math.random() * 100 - 50;
  createNode(x, y);
  saveState();
});

// === 🧭 Minimap Rendering ===
function updateMinimap() {
  ctxMini.clearRect(0, 0, minimap.width, minimap.height);
  ctxMini.fillStyle = isDarkMode ? "#222" : "#fff";
  ctxMini.fillRect(0, 0, minimap.width, minimap.height);

  const scale = 0.1;
  for (const node of nodes) {
    const x = parseInt(node.style.left) * scale;
    const y = parseInt(node.style.top) * scale;
    ctxMini.fillStyle = "#007bff";
    ctxMini.fillRect(x, y, 10, 6);
  }
}

// === 🧹 Hide Context Menu on Click Outside ===
window.addEventListener("click", (e) => {
  if (!contextMenu.contains(e.target)) {
    contextMenu.style.display = "none";
  }
});

// === 🚫 Prevent Default Right Click Menu ===
mapContainer.addEventListener("contextmenu", (e) => {
  if (e.target === mapContainer) {
    e.preventDefault();
    contextMenu.style.display = "none";
  }
});

// === 🧾 JSON Utilities ===
function getMindMapData() {
  return nodes.map(node => ({
    id: node.dataset.id,
    text: node.querySelector(".text").textContent,
    x: parseInt(node.style.left),
    y: parseInt(node.style.top),
    icon: node.querySelector(".icon").textContent
  }));
}

function loadMindMapFromJson(jsonData) {
  nodes.forEach(n => n.remove());
  nodes.length = 0;

  jsonData.forEach(data => {
    createNode(data.x, data.y, data.text, data.id, data.icon);
  });
  saveState();
}

jsonToggleBtn.onclick = () => {
  jsonTextarea.value = JSON.stringify(getMindMapData(), null, 2);
  jsonPanel.style.display = 'flex';
};

closeJsonBtn.onclick = () => {
  jsonPanel.style.display = 'none';
};

applyJsonBtn.onclick = () => {
  try {
    const parsed = JSON.parse(jsonTextarea.value);
    if (Array.isArray(parsed)) {
      loadMindMapFromJson(parsed);
      jsonPanel.style.display = 'none';
    } else {
      alert("JSON must be an array of nodes.");
    }
  } catch (e) {
    alert("Invalid JSON:\n" + e.message);
  }
};

// === ♻️ Undo / Redo ===
function saveState() {
  const snapshot = JSON.stringify(getMindMapData());
  undoStack.push(snapshot);
  redoStack = [];
}

function renderNodes() {
  nodes.forEach(n => n.remove());
  nodes.length = 0;
  const currentState = JSON.parse(undoStack[undoStack.length - 1]);
  currentState.forEach(data => createNode(data.x, data.y, data.text, data.id, data.icon));
}

function undo() {
  if (undoStack.length <= 1) return;
  const current = undoStack.pop();
  redoStack.push(current);
  renderNodes();
}

function redo() {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  undoStack.push(next);
  renderNodes();
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});
