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
const connectorLines = document.getElementById('connector-lines');
const connectNodeBtn = document.getElementById("connectNodeBtn");

// === 📌 State Variables ===
let state = {
  nodes: [], // The single source of truth for all nodes
  connections: [] // Stores connections between nodes
};
let undoStack = [];
let redoStack = [];
let contextTarget = null;
let isDarkMode = false;
let isConnecting = false;
let firstNode = null;

// === 🧠 Node Management ===
function addNodeToState(x, y, text = "New Node", id = null, icon = "🧠") {
  const newNode = {
    id: id || Date.now(),
    x,
    y,
    text,
    icon,
    color: '#ffffff' // Default color
  };
  state.nodes.push(newNode);
  saveState();
  renderMindMap();
}

// === 🖱️ Drag Node ===
function dragNode(e) {
  e.preventDefault();
  if (isConnecting) return;
  const node = e.currentTarget;
  const nodeId = node.dataset.id;
  let offsetX = e.clientX - node.offsetLeft;
  let offsetY = e.clientY - node.offsetTop;

  function moveAt(ev) {
    // Update style directly for performance during drag
    node.style.left = `${ev.clientX - offsetX}px`;
    node.style.top = `${ev.clientY - offsetY}px`;
    drawConnections();
    updateMinimap(); // This can still be slow, but better than full re-render
  }

  function stopDrag() {
    window.removeEventListener("mousemove", moveAt);
    window.removeEventListener("mouseup", stopDrag); // This correctly removes the named function listener

    // Update the central state object after the drag is complete
    const nodeState = state.nodes.find(n => n.id == nodeId);
    if (nodeState) {
      // BUG FIX: Read the final position from the element's style. ev is not defined in this scope.
      nodeState.x = parseInt(node.style.left, 10);
      nodeState.y = parseInt(node.style.top, 10);
    }
    saveState();
    renderMindMap(); // Re-render to ensure consistency
  }

  window.addEventListener("mousemove", moveAt);
  window.addEventListener("mouseup", stopDrag);
}

// === 🎨 Rendering ===
function renderMindMap() {
  mapContainer.innerHTML = ''; // Clear the container
  state.nodes.forEach(nodeData => {
    const nodeEl = document.createElement("div");
    nodeEl.className = "mind-node";
    nodeEl.innerHTML = `<span class="icon">${nodeData.icon}</span> <span class="text">${nodeData.text}</span>`;
    nodeEl.style.left = `${nodeData.x}px`;
    nodeEl.style.top = `${nodeData.y}px`;
    nodeEl.style.background = nodeData.color;
    nodeEl.dataset.id = nodeData.id;

    nodeEl.addEventListener("mousedown", dragNode);
    nodeEl.addEventListener("contextmenu", showContextMenu);
    nodeEl.addEventListener("click", handleNodeClick);

    mapContainer.appendChild(nodeEl);
  });
  drawConnections();
  updateMinimap();
}

// === 🔗 Draw Connections ===
function drawConnections() {
  connectorLines.innerHTML = '';
  state.connections.forEach(connection => {
    const fromNode = state.nodes.find(n => n.id == connection.from);
    const toNode = state.nodes.find(n => n.id == connection.to);

    if (fromNode && toNode) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromNode.x + 50); // Adjust for node width
      line.setAttribute('y1', fromNode.y + 25); // Adjust for node height
      line.setAttribute('x2', toNode.x + 50);
      line.setAttribute('y2', toNode.y + 25);
      line.setAttribute('stroke', isDarkMode ? '#fff' : '#000');
      connectorLines.appendChild(line);
    }
  });
}

// === 🖱️ Context Menu ===
function showContextMenu(e) {
  e.preventDefault();
  contextTarget = e.currentTarget;
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.display = "block";
}

contextMenu.addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action || !contextTarget) return;

  switch (action) {
    case "edit": {
      const textEl = contextTarget.querySelector(".text");
      const nodeState = state.nodes.find(n => n.id == contextTarget.dataset.id);
      const newText = prompt("Edit node text:", nodeState.text);
      if (newText !== null && nodeState) nodeState.text = newText;
      break;
    }
    case "delete": {
      const nodeId = contextTarget.dataset.id;
      state.nodes = state.nodes.filter((n) => n.id != nodeId);
      state.connections = state.connections.filter(c => c.from != nodeId && c.to != nodeId);
      break;
    }
    case "color": {
      const nodeState = state.nodes.find(n => n.id == contextTarget.dataset.id);
      const newColor = prompt("Enter background color (e.g. #ffcc00 or red):");
      if (newColor && nodeState) nodeState.color = newColor;
      break;
    }
    case "icon": {
      const nodeState = state.nodes.find(n => n.id == contextTarget.dataset.id);
      const newIcon = prompt("Enter emoji or icon text:", nodeState.icon);
      if (newIcon !== null && nodeState) nodeState.icon = newIcon;
      break;
    }
  }

  contextMenu.style.display = "none";
  saveState();
  renderMindMap();
});

// === 🔗 Connect Nodes ===
connectNodeBtn.addEventListener("click", () => {
  isConnecting = !isConnecting;
  if (isConnecting) {
    connectNodeBtn.style.background = '#a0a0a0';
  } else {
    connectNodeBtn.style.background = '';
    firstNode = null;
    document.querySelectorAll('.mind-node.selected').forEach(node => node.classList.remove('selected'));
  }
});

function handleNodeClick(e) {
  if (!isConnecting) return;

  const clickedNodeId = e.currentTarget.dataset.id;

  if (!firstNode) {
    firstNode = clickedNodeId;
    e.currentTarget.classList.add('selected');
  } else {
    const secondNode = clickedNodeId;
    if (firstNode !== secondNode) {
      state.connections.push({ from: firstNode, to: secondNode });
      saveState();
      renderMindMap();
    }
    firstNode = null;
    document.querySelectorAll('.mind-node.selected').forEach(node => node.classList.remove('selected'));
    isConnecting = false;
    connectNodeBtn.style.background = '';
  }
}

// === 🌗 Toggle Dark Mode ===
toggleDarkModeBtn.addEventListener("click", () => {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle("dark-mode", isDarkMode);
  toggleDarkModeBtn.textContent = isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode";
  drawConnections();
  updateMinimap(); // More efficient: only the minimap background needs an update
});

// === ➕ Add Node Button ===
addNodeBtn.addEventListener("click", () => {
  const x = window.innerWidth / 2 + Math.random() * 100 - 50;
  const y = window.innerHeight / 2 + Math.random() * 100 - 50;
  addNodeToState(x, y);
});

// === 🧭 Minimap Rendering ===
function updateMinimap() {
  ctxMini.clearRect(0, 0, minimap.width, minimap.height);
  ctxMini.fillStyle = isDarkMode ? "#333" : "#f0f0f0";
  ctxMini.fillRect(0, 0, minimap.width, minimap.height);

  const scale = 0.1;
  for (const nodeData of state.nodes) {
    const x = nodeData.x * scale;
    const y = nodeData.y * scale;
    // Use the node's actual color, with a fallback for default white nodes to make them visible
    ctxMini.fillStyle = nodeData.color === '#ffffff' ? (isDarkMode ? '#bbbbbb' : '#555555') : nodeData.color;
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
  return state;
}

function loadMindMapFromJson(jsonData) {
  // Basic validation
  if (typeof jsonData === 'object' && jsonData !== null && Array.isArray(jsonData.nodes) && Array.isArray(jsonData.connections)) {
    state = jsonData;
  } else if (Array.isArray(jsonData)) { // For backwards compatibility
    state.nodes = jsonData;
    state.connections = [];
  }
  saveState();
  renderMindMap();
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
    loadMindMapFromJson(parsed);
    jsonPanel.style.display = 'none';
  } catch (e) {
    alert("Invalid JSON:\n" + e.message);
  }
};

// === ♻️ Undo / Redo ===
function saveState() {
  redoStack = []; // Clear redo stack on new action
  // Push a deep copy of the state to the undo stack
  const snapshot = JSON.parse(JSON.stringify(state));
  undoStack.push(snapshot);
}

function undo() {
  // Keep at least one state (the initial one) in the undo stack
  if (undoStack.length <= 1) return;

  const currentState = undoStack.pop();
  redoStack.push(currentState);

  // Set state to the previous one (peek at the new top of the stack)
  state = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
  renderMindMap();
}

function redo() {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  undoStack.push(next);
  state = JSON.parse(JSON.stringify(next));
  renderMindMap();
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

// === 🚀 Initial Load ===
saveState(); // Save the initial empty state for the undo history
renderMindMap(); // Initial render
