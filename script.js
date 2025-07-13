// Mind Map Script with Minimap View and Fixed Connection Alignment

document.addEventListener("DOMContentLoaded", () => {
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
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const sidebar = document.getElementById("sidebar");
  const minimap = document.getElementById("minimap");
  const minimapCtx = minimap.getContext("2d");

  toggleSidebarBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

  let nodeCount = 0;
  let nodeIdCounter = 0;
  let selectedNode = null;
  let connections = [];
  let nodeMap = {};

  let panX = 0;
  let panY = 0;
  let zoomLevel = 1;
  const GRID_SIZE = 20;

  function applyTransform() {
    const transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    mapContainer.style.transform = transform;
    updateConnectionPositions();
    updateMinimap();
  }

  function updateMinimap() {
    const canvasWidth = minimap.width;
    const canvasHeight = minimap.height;
    const scaleFactor = 0.1;

    minimapCtx.clearRect(0, 0, canvasWidth, canvasHeight);

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
      minimapCtx.lineWidth = 1;
      minimapCtx.beginPath();
      minimapCtx.moveTo(x1, y1);
      minimapCtx.lineTo(x2, y2);
      minimapCtx.stroke();
    });

    minimapCtx.strokeStyle = "#007bff";
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(-panX * scaleFactor, -panY * scaleFactor, mapViewport.clientWidth * scaleFactor / zoomLevel, mapViewport.clientHeight * scaleFactor / zoomLevel);
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

  function createNode(text, x = Math.random() * 500, y = Math.random() * 300, id = null) {
    const node = document.createElement("div");
    node.classList.add("mind-node");
    node.innerText = text;
    node.style.left = x + "px";
    node.style.top = y + "px";
    const nodeId = id || "node_" + (++nodeIdCounter);
    node.dataset.id = nodeId;
    nodeMap[nodeId] = node;
    makeDraggable(node);
    mapContainer.appendChild(node);
    updateMinimap();
  }

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
        let newX = initialLeft + (e.clientX - startX);
        let newY = initialTop + (e.clientY - startY);
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
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
      input.style.width = "100%";
      el.innerHTML = "";
      el.appendChild(input);
      input.focus();
      const save = () => el.innerText = input.value || "Untitled";
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
      input.addEventListener("blur", save);
    });

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      el.remove();
      removeConnectionsForNode(el);
      delete nodeMap[el.dataset.id];
      updateMinimap();
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

  function createConnection(fromNode, toNode) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "#444");
    line.setAttribute("stroke-width", "2");
    connectionSvg.appendChild(line);
    connections.push({ from: fromNode, to: toNode, line });
    updateConnectionPositions();
    updateMinimap();
  }

  function updateConnectionPositions() {
    const rect = mapViewport.getBoundingClientRect();

    connections.forEach(({ from, to, line }) => {
    const fromX = parseFloat(from.style.left) * zoomLevel + panX;
    const fromY = parseFloat(from.style.top) * zoomLevel + panY;
    const toX = parseFloat(to.style.left) * zoomLevel + panX;
    const toY = parseFloat(to.style.top) * zoomLevel + panY;

    const fromCX = fromX + from.offsetWidth * zoomLevel / 2;
    const fromCY = fromY + from.offsetHeight * zoomLevel / 2;
    const toCX = toX + to.offsetWidth * zoomLevel / 2;
    const toCY = toY + to.offsetHeight * zoomLevel / 2;

    line.setAttribute("x1", fromCX);
    line.setAttribute("y1", fromCY);
    line.setAttribute("x2", toCX);
    line.setAttribute("y2", toCY);
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

  function getMindMapData() {
    const nodes = Object.values(nodeMap).map(node => ({
      id: node.dataset.id,
      text: node.innerText,
      x: parseFloat(node.style.left),
      y: parseFloat(node.style.top)
    }));
    const links = connections.map(({ from, to }) => ({
      fromId: from.dataset.id,
      toId: to.dataset.id
    }));
    return { nodes, links };
  }

  function loadMindMapData(data) {
    mapContainer.querySelectorAll(".mind-node").forEach(el => el.remove());
    connectionSvg.innerHTML = "";
    Object.keys(nodeMap).forEach(id => delete nodeMap[id]);
    connections = [];
    selectedNode = null;
    data.nodes.forEach(node => {
      createNode(node.text, node.x, node.y, node.id);
      const num = +node.id.split("_")[1];
      if (num > nodeIdCounter) nodeIdCounter = num;
    });
    data.links.forEach(({ fromId, toId }) => {
      const from = nodeMap[fromId];
      const to = nodeMap[toId];
      if (from && to) createConnection(from, to);
    });
    applyTransform();
  }

  addNodeBtn.addEventListener("click", () => createNode("Node " + (++nodeCount)));
  saveMapBtn.addEventListener("click", () => {
    const data = getMindMapData();
    localStorage.setItem("mindmap", JSON.stringify(data));
    alert("✅ Map saved.");
  });
  loadMapBtn.addEventListener("click", () => {
    const saved = localStorage.getItem("mindmap");
    if (!saved) return alert("⚠️ No saved map.");
    try {
      loadMindMapData(JSON.parse(saved));
    } catch (e) {
      alert("❌ Load error");
    }
  });
  resetViewBtn.addEventListener("click", () => {
    panX = panY = 0;
    zoomLevel = 1;
    applyTransform();
  });
  exportBtn.addEventListener("click", () => {
    const data = getMindMapData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mindmap.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => loadMindMapData(JSON.parse(e.target.result));
    reader.readAsText(file);
  });

  mapViewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const oldZoom = zoomLevel;
    zoomLevel *= (e.deltaY < 0) ? (1 + zoomFactor) : (1 - zoomFactor);
    zoomLevel = Math.min(Math.max(zoomLevel, 0.3), 3);
    const rect = mapViewport.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dx = cx - panX;
    const dy = cy - panY;
    panX -= dx * (zoomLevel / oldZoom - 1);
    panY -= dy * (zoomLevel / oldZoom - 1);
    applyTransform();
  });

  let isPanning = false;
  let startPanX, startPanY;
  mapViewport.addEventListener("mousedown", (e) => {
    if (e.target.closest(".mind-node")) return;
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
  });
  mapViewport.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    applyTransform();
  });
  mapViewport.addEventListener("mouseup", () => isPanning = false);
  mapViewport.addEventListener("mouseleave", () => isPanning = false);
});
