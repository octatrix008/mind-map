document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mindmap-canvas');
    const ctx = canvas.getContext('2d');
    const contextMenu = document.getElementById('context-menu');
    const editNodeBtn = document.getElementById('edit-node');
    const deleteNodeBtn = document.getElementById('delete-node');
    const changeColorBtn = document.getElementById('change-color-node');
    const changeShapeBtn = document.getElementById('change-shape-node');
    const addImageBtn = document.getElementById('add-image-node');
    const connectionContextMenu = document.getElementById('connection-context-menu');
    const changeConnectionColorBtn = document.getElementById('change-connection-color');
    const changeConnectionThicknessBtn = document.getElementById('change-connection-thickness');

    let nodes = [];
    let connections = [];
    let selectedNodeForContextMenu = null;
    let selectedConnectionForContextMenu = null;
    let selectedNode = null;
    let draggedNode = null;
    let isDragging = false;
    let didDrag = false;
    let dragStart = { x: 0, y: 0 };

    let scale = 1;
    let pan = { x: 0, y: 0 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    const style = getComputedStyle(document.body);

    function getCSSVar(name) {
        return style.getPropertyValue(name).trim();
    }

    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        draw();
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function addNode() {
        const worldPos = screenToWorld({ x: canvas.width / 2, y: canvas.height / 2 });
        const node = {
            id: Date.now(),
            text: 'New Node',
            x: worldPos.x,
            y: worldPos.y,
            width: 160,
            height: 50
        };
        nodes.push(node);
        draw();
    }

    function draw() {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(pan.x, pan.y);
        ctx.scale(scale, scale);

        const connectionColor = getCSSVar('--connection-color');
        ctx.strokeStyle = connectionColor;
        ctx.lineWidth = 2;
        connections.forEach(conn => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (fromNode && toNode) {
                ctx.beginPath();
                ctx.moveTo(fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height / 2);
                ctx.lineTo(toNode.x + toNode.width / 2, toNode.y + toNode.height / 2);
                ctx.strokeStyle = conn.color || connectionColor;
                ctx.lineWidth = conn.thickness || 2;
                ctx.stroke();
            }
        });

        nodes.forEach(node => {
            drawNode(node);
        });

        ctx.restore();
    }

    function drawNode(node) {
        const borderRadius = 12;
        const nodeBg = getCSSVar('--node-bg');
        const nodeBorder = getCSSVar('--node-border');
        const nodeSelectedBg = getCSSVar('--node-selected-bg');
        const nodeSelectedBorder = getCSSVar('--node-selected-border');
        const nodeTextColor = getCSSVar('--text-color');
        const nodeFont = `16px ${getCSSVar('--font-family')}`;

        ctx.save();
        ctx.shadowColor = getCSSVar('--node-shadow');
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;

        ctx.beginPath();
        if (node.shape === 'ellipse') {
            ctx.ellipse(node.x + node.width / 2, node.y + node.height / 2, node.width / 2, node.height / 2, 0, 0, 2 * Math.PI);
        } else if (node.shape === 'diamond') {
            ctx.moveTo(node.x + node.width / 2, node.y);
            ctx.lineTo(node.x + node.width, node.y + node.height / 2);
            ctx.lineTo(node.x + node.width / 2, node.y + node.height);
            ctx.lineTo(node.x, node.y + node.height / 2);
            ctx.closePath();
        } else {
            ctx.moveTo(node.x + borderRadius, node.y);
            ctx.lineTo(node.x + node.width - borderRadius, node.y);
            ctx.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + borderRadius);
            ctx.lineTo(node.x + node.width, node.y + node.height - borderRadius);
            ctx.quadraticCurveTo(node.x + node.width, node.y + node.height, node.x + node.width - borderRadius, node.y + node.height);
            ctx.lineTo(node.x + borderRadius, node.y + node.height);
            ctx.quadraticCurveTo(node.x, node.y + node.height, node.x, node.y + node.height - borderRadius);
            ctx.lineTo(node.x, node.y + borderRadius);
            ctx.quadraticCurveTo(node.x, node.y, node.x + borderRadius, node.y);
            ctx.closePath();
        }

        if (selectedNode === node) {
            ctx.fillStyle = nodeSelectedBg;
            ctx.strokeStyle = nodeSelectedBorder;
            ctx.lineWidth = 2;
        } else {
            ctx.fillStyle = node.color || nodeBg;
            ctx.strokeStyle = nodeBorder;
            ctx.lineWidth = 1;
        }

        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.stroke();
        ctx.restore();

        if (node.imageUrl) {
            const img = new Image();
            img.src = node.imageUrl;
            img.onload = () => {
                ctx.drawImage(img, node.x, node.y, node.width, node.height);
                draw();
            }
        }

        // Text
        ctx.fillStyle = nodeTextColor;
        ctx.font = nodeFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.text, node.x + node.width / 2, node.y + node.height / 2);
    }

    function getNodeAt(x, y) {
        const worldPos = screenToWorld({ x, y });
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            if (worldPos.x >= node.x && worldPos.x <= node.x + node.width &&
                worldPos.y >= node.y && worldPos.y <= node.y + node.height) {
                return node;
            }
        }
        return null;
    }

    function getConnectionAt(x, y) {
        const worldPos = screenToWorld({ x, y });
        for (let i = 0; i < connections.length; i++) {
            const conn = connections[i];
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (fromNode && toNode) {
                const dist = distToSegment(worldPos, {x: fromNode.x + fromNode.width / 2, y: fromNode.y + fromNode.height / 2}, {x: toNode.x + toNode.width / 2, y: toNode.y + toNode.height / 2});
                if (dist < 5) {
                    return conn;
                }
            }
        }
        return null;
    }

    function sqr(x) { return x * x }
    function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
    function distToSegmentSquared(p, v, w) {
      var l2 = dist2(v, w);
      if (l2 == 0) return dist2(p, v);
      var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return dist2(p, { x: v.x + t * (w.x - v.x),
                        y: v.y + t * (w.y - v.y) });
    }
    function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }

    function screenToWorld(pos) {
        return { x: (pos.x - pan.x) / scale, y: (pos.y - pan.y) / scale };
    }

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const node = getNodeAt(x, y);
        if (node) {
            selectedNodeForContextMenu = node;
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.top = `${e.clientY}px`;
            connectionContextMenu.style.display = 'none';
        } else {
            const conn = getConnectionAt(x, y);
            if (conn) {
                selectedConnectionForContextMenu = conn;
                connectionContextMenu.style.display = 'block';
                connectionContextMenu.style.left = `${e.clientX}px`;
                connectionContextMenu.style.top = `${e.clientY}px`;
                contextMenu.style.display = 'none';
            } else {
                contextMenu.style.display = 'none';
                connectionContextMenu.style.display = 'none';
            }
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        contextMenu.style.display = 'none';
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (e.button === 1 || e.ctrlKey) {
            isPanning = true;
            panStart.x = x - pan.x;
            panStart.y = y - pan.y;
            canvas.style.cursor = 'grabbing';
            return;
        }

        draggedNode = getNodeAt(x, y);
        didDrag = false;

        if (draggedNode) {
            isDragging = true;
            const worldPos = screenToWorld({ x, y });
            dragStart.x = worldPos.x - draggedNode.x;
            dragStart.y = worldPos.y - draggedNode.y;
        } else {
            selectedNode = null;
        }
        draw();
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (isPanning) {
            pan.x = x - panStart.x;
            pan.y = y - panStart.y;
            draw();
            return;
        }

        if (isDragging && draggedNode) {
            didDrag = true;
            const worldPos = screenToWorld({ x, y });
            draggedNode.x = worldPos.x - dragStart.x;
            draggedNode.y = worldPos.y - dragStart.y;
            draw();
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'default';
        }
        isDragging = false;
    });

    canvas.addEventListener('click', (e) => {
        if (didDrag) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clickedNode = getNodeAt(x, y);

        if (clickedNode) {
            if (selectedNode && selectedNode !== clickedNode) {
                connections.push({ from: selectedNode.id, to: clickedNode.id });
                selectedNode = null;
            } else {
                selectedNode = clickedNode;
            }
        } else {
            selectedNode = null;
        }
        draw();
    });

    canvas.addEventListener('dblclick', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const node = getNodeAt(x, y);

        if (node) {
            editNodeText(node);
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const scaleAmount = 1.1;
        const worldPos = screenToWorld({ x, y });

        if (e.deltaY < 0) {
            scale *= scaleAmount;
        } else {
            scale /= scaleAmount;
        }

        pan.x = x - worldPos.x * scale;
        pan.y = y - worldPos.y * scale;

        draw();
    });

    function resetView() {
        scale = 1;
        pan.x = 0;
        pan.y = 0;
        draw();
    }

    function exportMindMap() {
        const mindMapData = {
            nodes,
            connections,
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mindMapData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "mind-map.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function importMindMap(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const mindMapData = JSON.parse(e.target.result);
                if (mindMapData.nodes && mindMapData.connections) {
                    nodes = mindMapData.nodes;
                    connections = mindMapData.connections;
                    draw();
                } else {
                    alert('Invalid mind map file.');
                }
            } catch (error) {
                alert('Error reading mind map file.');
            }
        };
        reader.readAsText(file);
    }

    function editNodeText(node) {
        const newText = prompt('Enter new text for the node:', node.text);
        if (newText !== null) {
            node.text = newText;
            draw();
        }
    }

    editNodeBtn.addEventListener('click', () => {
        if (selectedNodeForContextMenu) {
            editNodeText(selectedNodeForContextMenu);
        }
        contextMenu.style.display = 'none';
    });

    deleteNodeBtn.addEventListener('click', () => {
        if (selectedNodeForContextMenu) {
            nodes = nodes.filter(n => n.id !== selectedNodeForContextMenu.id);
            connections = connections.filter(c => c.from !== selectedNodeForContextMenu.id && c.to !== selectedNodeForContextMenu.id);
            if (selectedNode === selectedNodeForContextMenu) {
                selectedNode = null;
            }
            selectedNodeForContextMenu = null;
            draw();
        }
        contextMenu.style.display = 'none';
    });

    changeColorBtn.addEventListener('click', () => {
        if (selectedNodeForContextMenu) {
            const color = prompt("Enter the new color for the node:", selectedNodeForContextMenu.color || '#ffffff');
            if (color) {
                selectedNodeForContextMenu.color = color;
                draw();
            }
        }
        contextMenu.style.display = 'none';
    });

    changeShapeBtn.addEventListener('click', () => {
        if (selectedNodeForContextMenu) {
            const shape = prompt("Enter the new shape for the node (rectangle, ellipse, diamond):", selectedNodeForContextMenu.shape || 'rectangle');
            if (shape) {
                selectedNodeForContextMenu.shape = shape;
                draw();
            }
        }
        contextMenu.style.display = 'none';
    });

    changeConnectionColorBtn.addEventListener('click', () => {
        if (selectedConnectionForContextMenu) {
            const color = prompt("Enter the new color for the connection:", selectedConnectionForContextMenu.color || '#000000');
            if (color) {
                selectedConnectionForContextMenu.color = color;
                draw();
            }
        }
        connectionContextMenu.style.display = 'none';
    });

    changeConnectionThicknessBtn.addEventListener('click', () => {
        if (selectedConnectionForContextMenu) {
            const thickness = prompt("Enter the new thickness for the connection:", selectedConnectionForContextMenu.thickness || 2);
            if (thickness) {
                selectedConnectionForContextMenu.thickness = thickness;
                draw();
            }
        }
        connectionContextMenu.style.display = 'none';
    });

    addImageBtn.addEventListener('click', () => {
        if (selectedNodeForContextMenu) {
            const imageUrl = prompt("Enter the image URL for the node:", selectedNodeForContextMenu.imageUrl || '');
            if (imageUrl) {
                selectedNodeForContextMenu.imageUrl = imageUrl;
                draw();
            }
        }
        contextMenu.style.display = 'none';
    });

    document.getElementById('addNodeBtn').addEventListener('click', addNode);
    document.getElementById('resetViewBtn').addEventListener('click', resetView);
    document.getElementById('exportBtn').addEventListener('click', exportMindMap);
    document.getElementById('importBtn').addEventListener('click', () => importInput.click());

    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.addEventListener('change', importMindMap);
});