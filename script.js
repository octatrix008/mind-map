// 📌 Full-featured Mind Map Script with Top Toolbar, Custom Color & Emoji Support

document.addEventListener("DOMContentLoaded", () => {
  // 🌐 UI Elements
  const addNodeBtn = document.getElementById("addNodeBtn");
  const saveMapBtn = document.getElementById("saveMapBtn");
  const loadMapBtn = document.getElementById("loadMapBtn");
  const resetViewBtn = document.getElementById("resetViewBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importInput = document.getElementById("importInput");
  const mapContainer = document.getElementById("mapContainer");
  const mapViewport = document.getElementById("mapViewport");
  const connectionSvg = document.getElementById("connectionLines");
  const minimap = document.getElementById("minimap");
  const minimapCtx = minimap.getContext("2d");
  const darkModeToggle = document.getElementById("toggleDarkModeBtn");
  const contextMenu = document.getElementById("contextMenu");
  let contextTarget = null;

  // 🌓 Dark Mode Toggle
  function applyDarkMode(enabled) {
    document.body.classList.toggle("dark-mode", enabled);
    localStorage.setItem("darkMode", enabled);
    darkModeToggle.innerText = enabled ? "☀️ Light Mode" : "🌙 Dark Mode";
  }

  applyDarkMode(localStorage.getItem("darkMode") === "true");
  darkModeToggle.addEventListener("click", () => applyDarkMode(!document.body.classList.contains("dark-mode")));

  // 🧠 Mind Map State
  let nodeCount = 0;
  let nodeIdCounter = 0;
  let selectedNode = null;
  let connections = [];
  let nodeMap = {};

  let panX = 0, panY = 0, zoomLevel = 1;
  const GRID_SIZE = 20;

  // 🎯 Transform Canvas
  function applyTransform() {
    mapContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    updateConnectionPositions();
    updateMinimap();
  }

  // 🗺️ Minimap
  function updateMinimap() {
    const scaleFactor = 0.1;
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
    Object.values(nodeMap).forEach(node => {
      const x = parseFloat(node.style.left) * scaleFactor;
      const y = parseFloat(node.style.top) * scaleFactor;
      minimapCtx.fillStyle = "#666";
      minimapCtx.fillRect(x, y, 10, 10);
    });
    connections.forEach(({ from, to }) => {
      const x1 = parseFloat(from.style.left) * scaleFactor + 5;
      const y1 = parseFloat(from.style.top) * scaleFactor + 5;
      const x2 = parseFloat(to.style.left) * scaleFactor + 5;
      const y2 = parseFloat(to.style.top) * scaleFactor + 5;
      minimapCtx.strokeStyle = "#aaa";
      minimapCtx.beginPath();
      minimapCtx.moveTo(x1, y1);
      minimapCtx.lineTo(x2, y2);
      minimapCtx.stroke();
    });
  }

  minimap.addEventListener("click", (e) => {
    const rect = minimap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleFactor = 0.1;
    panX = -x / scaleFactor + mapViewport.clientWidth / 2 / zoomLevel;
    panY = -y / scaleFactor + mapViewport.clientHeight / 2 / zoomLevel;
    applyTransform();
  });

  // 🧱 Create Node
  function createNode(text, x = 100, y = 100, id = null, color = "#ffffff", icon = "") {
    const node = document.createElement("div");
    node.classList.add("mind-node");
    node.dataset.id = id || "node_" + (++nodeIdCounter);
    node.dataset.color = color;
    node.dataset.icon = icon;
    node.innerHTML = `<span class="emoji">${icon}</span> ${text}`;
    node.style.backgroundColor = color;
    node.style.left = x + "px";
    node.style.top = y + "px";
    nodeMap[node.dataset.id] = node;
    makeDraggable(node);
    mapContainer.appendChild(node);
    updateMinimap();
  }

  // ↔️ Draggable Nodes with Context Menu
  function makeDraggable(el) {
    let pointerMoveHandler;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const initialLeft = parseFloat(el.style.left);
      const initialTop = parseFloat(el.style.top);
      el.setPointerCapture(e.pointerId);
      pointerMoveHandler = (e) => {
        let newX = Math.round((initialLeft + (e.clientX - startX)) / GRID_SIZE) * GRID_SIZE;
        let newY = Math.round((initialTop + (e.clientY - startY)) / GRID_SIZE) * GRID_SIZE;
        el.style.left = newX + "px";
        el.style.top = newY + "px";
        updateConnectionPositions();
        updateMinimap();
      };
      el.addEventListener("pointermove", pointerMoveHandler);
      el.addEventListener("pointerup", () => {
        el.removeEventListener("pointermove", pointerMoveHandler);
        el.releasePointerCapture(e.pointerId);
      }, { once: true });
    });

    el.addEventListener("dblclick", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = el.innerText;
      el.innerHTML = "";
      el.appendChild(input);
      input.focus();
      input.addEventListener("keydown", e => e.key === "Enter" && finish());
      input.addEventListener("blur", finish);
      function finish() {
        const icon = el.dataset.icon || "";
        el.innerHTML = `<span class="emoji">${icon}</span> ${input.value || "Untitled"}`;
      }
    });

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      contextTarget = el;
      contextMenu.style.left = e.pageX + "px";
      contextMenu.style.top = e.pageY + "px";
      contextMenu.style.display = "block";
    });

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!selectedNode) {
        selectedNode = el;
        el.classList.add("selected");
      } else if (selectedNode !== el) {
        createConnection(selectedNode, el);
        selectedNode.classList.remove("selected");
        selectedNode = null;
      } else {
        el.classList.remove("selected");
        selectedNode = null;
      }
    });
  }

  // 🔗 Connection Handling
  function createConnection(fromNode, toNode) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "#444");
    line.setAttribute("stroke-width", "2");
    connectionSvg.appendChild(line);
    const connection = { from: fromNode, to: toNode, line };
    connections.push(connection);
    updateConnectionPositions();
    updateMinimap();
    line.addEventListener("click", () => {
      if (confirm("Delete this connection?")) {
        connectionSvg.removeChild(line);
        connections = connections.filter(c => c !== connection);
        updateMinimap();
      }
    });
  }

  function updateConnectionPositions() {
    connections.forEach(({ from, to, line }) => {
      const x1 = parseFloat(from.style.left) * zoomLevel + panX + from.offsetWidth * zoomLevel / 2;
      const y1 = parseFloat(from.style.top) * zoomLevel + panY + from.offsetHeight * zoomLevel / 2;
      const x2 = parseFloat(to.style.left) * zoomLevel + panX + to.offsetWidth * zoomLevel / 2;
      const y2 = parseFloat(to.style.top) * zoomLevel + panY + to.offsetHeight * zoomLevel / 2;
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
    });
  }

  function removeConnectionsForNode(node) {
    connections = connections.filter(({ from, to, line }) => {
      if (from === node || to === node) {
        connectionSvg.removeChild(line);
        return false;
      }
      return true;
    });
  }

  // 📜 Context Menu Actions
  contextMenu.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    if (!contextTarget) return;
    if (action === "edit") {
      contextTarget.dispatchEvent(new Event("dblclick"));
    } else if (action === "delete") {
      contextTarget.remove();
      removeConnectionsForNode(contextTarget);
      delete nodeMap[contextTarget.dataset.id];
      updateMinimap();
    } else if (action === "connect") {
      if (selectedNode) selectedNode.classList.remove("selected");
      selectedNode = contextTarget;
      selectedNode.classList.add("selected");
    } else if (action === "disconnect") {
      removeConnectionsForNode(contextTarget);
      updateMinimap();
    } else if (action === "color") {
      const input = document.createElement("input");
      input.type = "color";
      input.value = contextTarget.dataset.color || "#ffffff";
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.click();
      input.addEventListener("input", () => {
        contextTarget.style.backgroundColor = input.value;
        contextTarget.dataset.color = input.value;
        document.body.removeChild(input);
      });
    } else if (action === "icon") {
      const icon = prompt("Enter emoji/icon (e.g. ✅, 💡, 📌):", contextTarget.dataset.icon || "");
      if (icon !== null) {
        contextTarget.dataset.icon = icon;
        const text = contextTarget.innerText;
        contextTarget.innerHTML = `<span class="emoji">${icon}</span> ${text}`;
      }
    }
    contextMenu.style.display = "none";
  });

  document.addEventListener("click", () => contextMenu.style.display = "none");

  // 🖱️ Zoom & Pan
  mapViewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const oldZoom = zoomLevel;
    zoomLevel *= e.deltaY < 0 ? 1 + zoomFactor : 1 - zoomFactor;
    zoomLevel = Math.max(0.3, Math.min(zoomLevel, 3));
    const rect = mapViewport.getBoundingClientRect();
    const dx = e.clientX - rect.left - panX;
    const dy = e.clientY - rect.top - panY;
    panX -= dx * (zoomLevel / oldZoom - 1);
    panY -= dy * (zoomLevel / oldZoom - 1);
    applyTransform();
  });

  mapViewport.addEventListener("mousedown", (e) => {
    if (e.target.closest(".mind-node")) return;
    const startX = e.clientX, startY = e.clientY;
    const startPanX = panX, startPanY = panY;
    function moveHandler(e) {
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      applyTransform();
    }
    function upHandler() {
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);
    }
    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", upHandler);
  });

  // 💾 Save/Load
  addNodeBtn.addEventListener("click", () => createNode("Node " + (++nodeCount)));
  saveMapBtn.addEventListener("click", () => {
    const nodes = Object.values(nodeMap).map(n => ({
      id: n.dataset.id,
      text: n.innerText,
      x: parseFloat(n.style.left),
      y: parseFloat(n.style.top),
      color: n.dataset.color,
      icon: n.dataset.icon
    }));
    const links = connections.map(c => ({ fromId: c.from.dataset.id, toId: c.to.dataset.id }));
    localStorage.setItem("mindmap", JSON.stringify({ nodes, links }));
    alert("Map saved!");
  });

  loadMapBtn.addEventListener("click", () => {
    const saved = localStorage.getItem("mindmap");
    if (!saved) return alert("No map found");
    const data = JSON.parse(saved);
    Object.values(nodeMap).forEach(n => n.remove());
    connectionSvg.innerHTML = "";
    connections = [];
    nodeMap = {};
    data.nodes.forEach(n => createNode(n.text, n.x, n.y, n.id, n.color, n.icon));
    data.links.forEach(l => {
      const from = nodeMap[l.fromId];
      const to = nodeMap[l.toId];
      if (from && to) createConnection(from, to);
    });
  });

  resetViewBtn.addEventListener("click", () => {
    panX = panY = 0;
    zoomLevel = 1;
    applyTransform();
  });

  exportBtn.addEventListener("click", () => {
    const data = localStorage.getItem("mindmap");
    const blob = new Blob([data], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mindmap.json";
    link.click();
  });

  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem("mindmap", reader.result);
      loadMapBtn.click();
    };
    reader.readAsText(file);
  });
});
