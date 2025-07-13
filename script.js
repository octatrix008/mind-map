document.addEventListener("DOMContentLoaded", () => {
  // ========= DOM Elements ==========
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

  // ========= State ==========
  let nodeCount = 0;
  let nodeIdCounter = 0;
  let selectedNode = null;
  let connections = [];
  let nodeMap = {};

  // ========= Zoom & Pan ==========
  let panX = 0;
  let panY = 0;
  let zoomLevel = 1;

  function applyTransform() {
    mapContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    updateConnectionPositions();
  }

  // ========= Add Node ==========
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
  }

  // ========= Drag Logic ==========
  const GRID_SIZE = 20;

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
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newX = initialLeft + dx;
        let newY = initialTop + dy;

        // Snap to grid
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;

        el.style.left = newX + "px";
        el.style.top = newY + "px";

        updateConnectionPositions();
      };

      el.addEventListener("pointermove", pointerMoveHandler);

      el.addEventListener("pointerup", () => {
        el.removeEventListener("pointermove", pointerMoveHandler);
        el.releasePointerCapture(e.pointerId);
      }, { once: true });
    });

    // Double click to edit
    el.addEventListener("dblclick", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = el.innerText;
      input.style.width = "100%";
      el.innerHTML = "";
      el.appendChild(input);
      input.focus();

      const save = () => {
        el.innerText = input.value || "Untitled";
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") save();
      });
      input.addEventListener("blur", save);
    });

    // Right-click to delete
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      el.remove();
      removeConnectionsForNode(el);
      delete nodeMap[el.dataset.id];
    });

    // Click to connect nodes
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

  // ========= Connections ==========
  function createConnection(fromNode, toNode) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "#444");
    line.setAttribute("stroke-width", "2");

    connectionSvg.appendChild(line);
    connections.push({ from: fromNode, to: toNode, line });

    updateConnectionPositions();
  }

  function updateConnectionPositions() {
    const containerRect = mapContainer.getBoundingClientRect();
    const transform = mapContainer.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/);
    const zoom = transform ? parseFloat(transform[3]) : 1;

    connections.forEach(({ from, to, line }) => {
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();

      const x1 = (fromRect.left + fromRect.width / 2 - containerRect.left) / zoom;
      const y1 = (fromRect.top + fromRect.height / 2 - containerRect.top) / zoom;
      const x2 = (toRect.left + toRect.width / 2 - containerRect.left) / zoom;
      const y2 = (toRect.top + toRect.height / 2 - containerRect.top) / zoom;

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

  // ========= Save / Load ==========
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

  // ========= Export / Import ==========
  exportBtn.addEventListener("click", () => {
    const data = getMindMapData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "mindmap.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener("click", () => {
    importInput.click();
  });

  importInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        loadMindMapData(data);
        alert("✅ Map imported successfully!");
      } catch (err) {
        alert("❌ Failed to import file. Invalid format.");
        console.error(err);
      }
    };

    reader.readAsText(file);
  });

  // ========= Button Handlers ==========
  addNodeBtn.addEventListener("click", () => {
    createNode("Node " + (++nodeCount));
  });

  saveMapBtn.addEventListener("click", () => {
    const data = getMindMapData();
    localStorage.setItem("mindmap", JSON.stringify(data));
    alert("✅ Mind map saved!");
  });

  loadMapBtn.addEventListener("click", () => {
    const saved = localStorage.getItem("mindmap");
    if (!saved) return alert("⚠️ No saved mind map found.");
    try {
      const data = JSON.parse(saved);
      loadMindMapData(data);
      alert("✅ Mind map loaded!");
    } catch (e) {
      alert("❌ Error loading map.");
      console.error(e);
    }
  });

  resetViewBtn.addEventListener("click", () => {
    panX = 0;
    panY = 0;
    zoomLevel = 1;
    applyTransform();
  });

  // ========= Zoom / Pan ==========
  mapViewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const oldZoom = zoomLevel;

    if (e.deltaY < 0) zoomLevel *= (1 + zoomFactor);
    else zoomLevel *= (1 - zoomFactor);

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

