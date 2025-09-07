document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('mindmap-canvas');
    const ctx = canvas.getContext('2d');
    const defaultToolbar = document.getElementById('default-toolbar');
    const selectionToolbar = document.getElementById('selection-toolbar');
    const connectionContextMenu = document.getElementById('connection-context-menu');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const darkModeBtn = document.getElementById('darkModeBtn');
    const changeConnectionColorBtn = document.getElementById('change-connection-color');
    const changeConnectionThicknessBtn = document.getElementById('change-connection-thickness');
    const changeConnectionStyleBtn = document.getElementById('change-connection-style');
    const editConnectionLabelBtn = document.getElementById('edit-connection-label');
    const deleteConnectionBtn = document.getElementById('delete-connection');
    const searchInput = document.getElementById('search-input');

    let nodes = [];
    let connections = [];
    let selectedNodes = [];
    let selectedConnection = null;
    let draggedNode = null;
    let isDragging = false;
    let didDrag = false;
    let dragStart = { x: 0, y: 0 };

    let scale = 1;
    let pan = { x: 0, y: 0 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    let history = [];
    let historyIndex = -1;

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

    function saveState() {
        const state = {
            nodes: JSON.parse(JSON.stringify(nodes)),
            connections: JSON.parse(JSON.stringify(connections))
        };
        history = history.slice(0, historyIndex + 1);
        history.push(state);
        historyIndex++;
        updateUndoRedoButtons();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState();
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreState();
        }
    }

    function restoreState() {
        const state = history[historyIndex];
        nodes = JSON.parse(JSON.stringify(state.nodes));
        connections = JSON.parse(JSON.stringify(state.connections));
        draw();
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    function updateToolbar() {
        if (selectedNodes.length > 0) {
            defaultToolbar.classList.add('hidden');
            selectionToolbar.classList.remove('hidden');
        } else {
            defaultToolbar.classList.remove('hidden');
            selectionToolbar.classList.add('hidden');
        }
    }

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
        saveState();
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
                const fromX = fromNode.x + fromNode.width / 2;
                const fromY = fromNode.y + fromNode.height / 2;
                const toX = toNode.x + toNode.width / 2;
                const toY = toNode.y + toNode.height / 2;

                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.strokeStyle = conn.color || connectionColor;
                ctx.lineWidth = conn.thickness || 2;

                if (conn.style === 'dashed') {
                    ctx.setLineDash([10, 5]);
                } else if (conn.style === 'dotted') {
                    ctx.setLineDash([2, 3]);
                } else {
                    ctx.setLineDash([]);
                }

                ctx.stroke();

                if (conn.arrow) {
                    drawArrow(ctx, fromNode, toNode, conn.thickness || 2);
                }

                ctx.setLineDash([]); // Reset line dash

                if (conn.label) {
                    const midX = (fromX + toX) / 2;
                    const midY = (fromY + toY) / 2;
                    const angle = Math.atan2(toY - fromY, toX - fromX);
                    
                    ctx.save();
                    ctx.translate(midX, midY);
                    ctx.rotate(angle);
                    
                    const nodeTextColor = getCSSVar('--text-color');
                    const nodeFont = `14px ${getCSSVar('--font-family')}`;
                    ctx.font = nodeFont;
                    ctx.fillStyle = nodeTextColor;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    
                    const textWidth = ctx.measureText(conn.label).width;
                    const textHeight = 14;
                    ctx.fillStyle = getCSSVar('--canvas-background');
                    ctx.fillRect(-textWidth / 2 - 4, -textHeight - 2, textWidth + 8, textHeight + 4);

                    ctx.fillStyle = nodeTextColor;
                    ctx.fillText(conn.label, 0, 0);
                    
                    ctx.restore();
                }
            }
        });

        nodes.forEach(node => {
            drawNode(ctx, node);
        });

        ctx.restore();
    }

    function drawArrow(context, fromNode, toNode, thickness) {
        const headlen = 10;
        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        const toX = toNode.x + toNode.width / 2;
        const toY = toNode.y + toNode.height / 2;

        context.beginPath();
        context.moveTo(toX, toY);
        context.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        context.moveTo(toX, toY);
        context.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        context.stroke();
    }

    function drawNode(context, node) {
        const borderRadius = 12;
        const nodeBg = getCSSVar('--node-bg');
        const nodeBorder = getCSSVar('--node-border');
        const nodeSelectedBg = getCSSVar('--node-selected-bg');
        const nodeSelectedBorder = getCSSVar('--node-selected-border');
        const nodeTextColor = getCSSVar('--text-color');
        const nodeFont = `16px ${getCSSVar('--font-family')}`;

        context.save();
        context.shadowColor = getCSSVar('--node-shadow');
        context.shadowBlur = 15;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 5;

        context.beginPath();
        switch (node.shape) {
            case 'ellipse':
                context.ellipse(node.x + node.width / 2, node.y + node.height / 2, node.width / 2, node.height / 2, 0, 0, 2 * Math.PI);
                break;
            case 'diamond':
                context.moveTo(node.x + node.width / 2, node.y);
                context.lineTo(node.x + node.width, node.y + node.height / 2);
                context.lineTo(node.x + node.width / 2, node.y + node.height);
                context.lineTo(node.x, node.y + node.height / 2);
                context.closePath();
                break;
            case 'circle':
                context.arc(node.x + node.width / 2, node.y + node.height / 2, Math.min(node.width, node.height) / 2, 0, 2 * Math.PI);
                break;
            case 'star':
                drawStar(context, node.x + node.width / 2, node.y + node.height / 2, 5, node.width / 2, node.width / 4);
                break;
            case 'hexagon':
                drawHexagon(context, node.x + node.width / 2, node.y + node.height / 2, node.width / 2);
                break;
            default:
                context.moveTo(node.x + borderRadius, node.y);
                context.lineTo(node.x + node.width - borderRadius, node.y);
                context.quadraticCurveTo(node.x + node.width, node.y, node.x + node.width, node.y + borderRadius);
                context.lineTo(node.x + node.width, node.y + node.height - borderRadius);
                context.quadraticCurveTo(node.x + node.width, node.y + node.height, node.x + node.width - borderRadius, node.y + node.height);
                context.lineTo(node.x + borderRadius, node.y + node.height);
                context.quadraticCurveTo(node.x, node.y + node.height, node.x, node.y + node.height - borderRadius);
                context.lineTo(node.x, node.y + borderRadius);
                context.quadraticCurveTo(node.x, node.y, node.x + borderRadius, node.y);
                context.closePath();
        }

        if (selectedNodes.includes(node)) {
            context.fillStyle = nodeSelectedBg;
            context.strokeStyle = nodeSelectedBorder;
            context.lineWidth = 2;
        } else {
            context.fillStyle = node.color || nodeBg;
            context.strokeStyle = nodeBorder;
            context.lineWidth = 1;
        }

        context.fill();
        context.stroke();
        context.restore();

        if (node.isHighlighted) {
            context.save();
            context.strokeStyle = '#ff0000';
            context.lineWidth = 3;
            context.stroke();
            context.restore();
        }

        if (node.imageUrl) {
            const img = new Image();
            img.src = node.imageUrl;
            img.onload = () => {
                context.drawImage(img, node.x, node.y, node.width, node.height);
                draw();
            }
        }

        // Text
        context.fillStyle = nodeTextColor;
        context.font = nodeFont;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(node.text, node.x + node.width / 2, node.y + node.height / 2);
    }

    function drawStar(context, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        context.beginPath();
        context.moveTo(cx, cy - outerRadius)
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            context.lineTo(x, y)
            rot += step

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            context.lineTo(x, y)
            rot += step
        }
        context.lineTo(cx, cy - outerRadius);
        context.closePath();
    }

    function drawHexagon(context, cx, cy, radius) {
        context.beginPath();
        for (let i = 0; i < 6; i++) {
            context.lineTo(cx + radius * Math.cos(Math.PI / 3 * i), cy + radius * Math.sin(Math.PI / 3 * i));
        }
        context.closePath();
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

        selectedConnection = getConnectionAt(x, y);
        if (selectedConnection) {
            connectionContextMenu.style.display = 'block';
            connectionContextMenu.style.left = `${e.clientX}px`;
            connectionContextMenu.style.top = `${e.clientY}px`;
        } else {
            connectionContextMenu.style.display = 'none';
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        connectionContextMenu.style.display = 'none';
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
            if (!e.shiftKey) {
                selectedNodes = [];
                selectedConnection = null;
                updateToolbar();
            }
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
        if (didDrag) {
            saveState();
        }
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
        selectedConnection = getConnectionAt(x, y);

        if (clickedNode) {
            if (e.shiftKey) {
                if (selectedNodes.includes(clickedNode)) {
                    selectedNodes = selectedNodes.filter(n => n !== clickedNode);
                } else {
                    selectedNodes.push(clickedNode);
                }
            } else {
                if (selectedNodes.length === 1 && selectedNodes[0] !== clickedNode) {
                    const fromNode = selectedNodes[0];
                    connections.push({ from: fromNode.id, to: clickedNode.id, style: 'solid', arrow: false, label: '' });
                    saveState();
                    selectedNodes = [clickedNode];
                } else {
                    selectedNodes = [clickedNode];
                }
            }
        } else if (!selectedConnection) {
            if (!e.shiftKey) {
                selectedNodes = [];
            }
        }

        updateToolbar();
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
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function exportPNG() {
        if (nodes.length === 0) return;

        const padding = 50;
        const minX = Math.min(...nodes.map(n => n.x));
        const minY = Math.min(...nodes.map(n => n.y));
        const maxX = Math.max(...nodes.map(n => n.x + n.width));
        const maxY = Math.max(...nodes.map(n => n.y + n.height));

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = maxX - minX + padding * 2;
        tempCanvas.height = maxY - minY + padding * 2;

        tempCtx.translate(-minX + padding, -minY + padding);

        const connectionColor = getCSSVar('--connection-color');
        tempCtx.strokeStyle = connectionColor;
        tempCtx.lineWidth = 2;
        connections.forEach(conn => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (fromNode && toNode) {
                tempCtx.beginPath();
                tempCtx.moveTo(fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height / 2);
                tempCtx.lineTo(toNode.x + toNode.width / 2, toNode.y + toNode.height / 2);
                tempCtx.strokeStyle = conn.color || connectionColor;
                tempCtx.lineWidth = conn.thickness || 2;

                if (conn.style === 'dashed') {
                    tempCtx.setLineDash([10, 5]);
                } else if (conn.style === 'dotted') {
                    tempCtx.setLineDash([2, 3]);
                } else {
                    tempCtx.setLineDash([]);
                }

                tempCtx.stroke();

                if (conn.arrow) {
                    drawArrow(tempCtx, fromNode, toNode, conn.thickness || 2);
                }

                ctx.setLineDash([]);

                if (conn.label) {
                    const midX = (fromNode.x + fromNode.width / 2 + toNode.x + toNode.width / 2) / 2;
                    const midY = (fromNode.y + fromNode.height / 2 + toNode.y + toNode.height / 2) / 2;
                    const angle = Math.atan2(toNode.y + toNode.height / 2 - fromNode.y - fromNode.height / 2, toNode.x + toNode.width / 2 - fromNode.x - fromNode.width / 2);
                    
                    tempCtx.save();
                    tempCtx.translate(midX, midY);
                    tempCtx.rotate(angle);
                    
                    const nodeTextColor = getCSSVar('--text-color');
                    const nodeFont = `14px ${getCSSVar('--font-family')}`;
                    tempCtx.font = nodeFont;
                    tempCtx.fillStyle = nodeTextColor;
                    tempCtx.textAlign = 'center';
                    tempCtx.textBaseline = 'bottom';
                    
                    const textWidth = tempCtx.measureText(conn.label).width;
                    const textHeight = 14;
                    tempCtx.fillStyle = getCSSVar('--canvas-background');
                    tempCtx.fillRect(-textWidth / 2 - 4, -textHeight - 2, textWidth + 8, textHeight + 4);

                    tempCtx.fillStyle = nodeTextColor;
                    tempCtx.fillText(conn.label, 0, 0);
                    
                    tempCtx.restore();
                }
            }
        });

        nodes.forEach(node => {
            drawNode(tempCtx, node);
        });

        const dataUrl = tempCanvas.toDataURL('image/png');
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataUrl);
        downloadAnchorNode.setAttribute("download", "mind-map.png");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function exportSVG() {
        if (nodes.length === 0) return;

        const padding = 50;
        const minX = Math.min(...nodes.map(n => n.x));
        const minY = Math.min(...nodes.map(n => n.y));
        const maxX = Math.max(...nodes.map(n => n.x + n.width));
        const maxY = Math.max(...nodes.map(n => n.y + n.height));

        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;

        let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

        svgContent += `<defs><style type="text/css"><![CDATA[
            .node-text { font-family: ${getCSSVar('--font-family')}; font-size: 16px; text-anchor: middle; dominant-baseline: middle; }
            .connection-label { font-family: ${getCSSVar('--font-family')}; font-size: 14px; text-anchor: middle; dominant-baseline: bottom; }
        ]]></style></defs>`;

        svgContent += `<rect width="100%" height="100%" fill="${getCSSVar('--canvas-background')}"/>`;

        svgContent += `<g transform="translate(${-minX + padding}, ${-minY + padding})">`;

        connections.forEach(conn => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (fromNode && toNode) {
                const x1 = fromNode.x + fromNode.width / 2;
                const y1 = fromNode.y + fromNode.height / 2;
                const x2 = toNode.x + toNode.width / 2;
                const y2 = toNode.y + toNode.height / 2;
                let strokeDasharray = '';
                if (conn.style === 'dashed') {
                    strokeDasharray = 'stroke-dasharray="10, 5"';
                } else if (conn.style === 'dotted') {
                    strokeDasharray = 'stroke-dasharray="2, 3"';
                }
                svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${conn.color || getCSSVar('--connection-color')}" stroke-width="${conn.thickness || 2}" ${strokeDasharray}/>`;

                if (conn.arrow) {
                    const angle = Math.atan2(y2 - y1, x2 - x1);
                    const headlen = 10;
                    const ax1 = x2 - headlen * Math.cos(angle - Math.PI / 6);
                    const ay1 = y2 - headlen * Math.sin(angle - Math.PI / 6);
                    const ax2 = x2 - headlen * Math.cos(angle + Math.PI / 6);
                    const ay2 = y2 - headlen * Math.sin(angle + Math.PI / 6);
                    svgContent += `<polygon points="${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}" fill="${conn.color || getCSSVar('--connection-color')}"/>`;
                }

                if (conn.label) {
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                    svgContent += `<g transform="translate(${midX}, ${midY}) rotate(${angle})">`;
                    svgContent += `<rect x="-25" y="-15" width="50" height="20" fill="${getCSSVar('--canvas-background')}"/>`;
                    svgContent += `<text fill="${getCSSVar('--text-color')}" class="connection-label">${conn.label}</text>`;
                    svgContent += `</g>`;
                }
            }
        });

        nodes.forEach(node => {
            const nodeBg = node.color || getCSSVar('--node-bg');
            const nodeBorder = getCSSVar('--node-border');
            const nodeTextColor = getCSSVar('--text-color');

            switch (node.shape) {
                case 'ellipse':
                    svgContent += `<ellipse cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="1"/>`;
                    break;
                case 'diamond':
                    const points = `${node.x + node.width / 2},${node.y} ${node.x + node.width},${node.y + node.height / 2} ${node.x + node.width / 2},${node.y + node.height} ${node.x},${node.y + node.height / 2}`;
                    svgContent += `<polygon points="${points}" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="1"/>`;
                    break;
                case 'circle':
                    svgContent += `<circle cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" r="${Math.min(node.width, node.height) / 2}" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="1"/>`;
                    break;
                default:
                    svgContent += `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="12" ry="12" fill="${nodeBg}" stroke="${nodeBorder}" stroke-width="1"/>`;
            }

            svgContent += `<text x="${node.x + node.width / 2}" y="${node.y + node.height / 2}" fill="${nodeTextColor}" class="node-text">${node.text}</text>`;
        });

        svgContent += `</g></svg>`;

        const dataStr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "mind-map.svg");
        document.body.appendChild(downloadAnchorNode);
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
                    saveState();
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
            saveState();
            draw();
        }
    }

    document.getElementById('edit-node').addEventListener('click', () => {
        if (selectedNodes.length === 1) {
            editNodeText(selectedNodes[0]);
        }
    });

    document.getElementById('delete-node').addEventListener('click', () => {
        if (selectedNodes.length > 0) {
            const idsToDelete = selectedNodes.map(n => n.id);
            nodes = nodes.filter(n => !idsToDelete.includes(n.id));
            connections = connections.filter(c => !idsToDelete.includes(c.from) && !idsToDelete.includes(c.to));
            selectedNodes = [];
            updateToolbar();
            saveState();
            draw();
        }
    });

    document.getElementById('change-color-node').addEventListener('click', () => {
        if (selectedNodes.length > 0) {
            const color = prompt("Enter the new color for the selected nodes:", selectedNodes[0].color || '#ffffff');
            if (color) {
                selectedNodes.forEach(node => node.color = color);
                saveState();
                draw();
            }
        }
    });

    document.getElementById('change-shape-node').addEventListener('click', () => {
        if (selectedNodes.length > 0) {
            const shape = prompt("Enter the new shape for the selected nodes (rectangle, ellipse, diamond, circle, star, hexagon):", selectedNodes[0].shape || 'rectangle');
            if (shape) {
                selectedNodes.forEach(node => node.shape = shape);
                saveState();
                draw();
            }
        }
    });

    document.getElementById('add-image-node').addEventListener('click', () => {
        if (selectedNodes.length === 1) {
            const imageUrl = prompt("Enter the image URL for the node:", selectedNodes[0].imageUrl || '');
            if (imageUrl) {
                selectedNodes[0].imageUrl = imageUrl;
                saveState();
                draw();
            }
        }
    });

    function alignNodes(mode) {
        if (selectedNodes.length < 2) return;

        switch (mode) {
            case 'left':
                const minX = Math.min(...selectedNodes.map(n => n.x));
                selectedNodes.forEach(n => n.x = minX);
                break;
            case 'center-horizontal':
                const centerX = selectedNodes.reduce((sum, n) => sum + n.x + n.width / 2, 0) / selectedNodes.length;
                selectedNodes.forEach(n => n.x = centerX - n.width / 2);
                break;
            case 'right':
                const maxX = Math.max(...selectedNodes.map(n => n.x + n.width));
                selectedNodes.forEach(n => n.x = maxX - n.width);
                break;
            case 'top':
                const minY = Math.min(...selectedNodes.map(n => n.y));
                selectedNodes.forEach(n => n.y = minY);
                break;
            case 'center-vertical':
                const centerY = selectedNodes.reduce((sum, n) => sum + n.y + n.height / 2, 0) / selectedNodes.length;
                selectedNodes.forEach(n => n.y = centerY - n.height / 2);
                break;
            case 'bottom':
                const maxY = Math.max(...selectedNodes.map(n => n.y + n.height));
                selectedNodes.forEach(n => n.y = maxY - n.height);
                break;
        }
        saveState();
        draw();
    }

    function distributeNodes(mode) {
        if (selectedNodes.length < 2) return;

        if (mode === 'horizontal') {
            selectedNodes.sort((a, b) => a.x - b.x);
            const minX = selectedNodes[0].x;
            const maxX = selectedNodes[selectedNodes.length - 1].x + selectedNodes[selectedNodes.length - 1].width;
            const totalWidth = selectedNodes.reduce((sum, n) => sum + n.width, 0);
            const spacing = (maxX - minX - totalWidth) / (selectedNodes.length - 1);
            let currentX = minX;
            selectedNodes.forEach(n => {
                n.x = currentX;
                currentX += n.width + spacing;
            });
        } else if (mode === 'vertical') {
            selectedNodes.sort((a, b) => a.y - b.y);
            const minY = selectedNodes[0].y;
            const maxY = selectedNodes[selectedNodes.length - 1].y + selectedNodes[selectedNodes.length - 1].height;
            const totalHeight = selectedNodes.reduce((sum, n) => sum + n.height, 0);
            const spacing = (maxY - minY - totalHeight) / (selectedNodes.length - 1);
            let currentY = minY;
            selectedNodes.forEach(n => {
                n.y = currentY;
                currentY += n.height + spacing;
            });
        }
        saveState();
        draw();
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm === '') {
            nodes.forEach(node => node.isHighlighted = false);
        } else {
            nodes.forEach(node => {
                if (node.text.toLowerCase().includes(searchTerm)) {
                    node.isHighlighted = true;
                } else {
                    node.isHighlighted = false;
                }
            });
        }
        draw();
    });

    changeConnectionColorBtn.addEventListener('click', () => {
        if (selectedConnection) {
            const color = prompt("Enter the new color for the connection:", selectedConnection.color || '#000000');
            if (color) {
                selectedConnection.color = color;
                saveState();
                draw();
            }
        }
        connectionContextMenu.style.display = 'none';
    });

    changeConnectionThicknessBtn.addEventListener('click', () => {
        if (selectedConnection) {
            const thickness = prompt("Enter the new thickness for the connection:", selectedConnection.thickness || 2);
            if (thickness) {
                selectedConnection.thickness = thickness;
                saveState();
                draw();
            }
        }
        connectionContextMenu.style.display = 'none';
    });

    changeConnectionStyleBtn.addEventListener('click', () => {
        if (selectedConnection) {
            const style = prompt("Enter the new style for the connection (solid, dashed, dotted):", selectedConnection.style || 'solid');
            const arrow = prompt("Add arrow to connection? (yes/no):", selectedConnection.arrow ? 'yes' : 'no');
            if (style) {
                selectedConnection.style = style;
            }
            if (arrow) {
                selectedConnection.arrow = arrow.toLowerCase() === 'yes';
            }
            saveState();
            draw();
        }
        connectionContextMenu.style.display = 'none';
    });

    editConnectionLabelBtn.addEventListener('click', () => {
        if (selectedConnection) {
            const label = prompt("Enter the new label for the connection:", selectedConnection.label || '');
            if (label !== null) {
                selectedConnection.label = label;
                saveState();
                draw();
            }
        }
        connectionContextMenu.style.display = 'none';
    });

    deleteConnectionBtn.addEventListener('click', () => {
        if (selectedConnection) {
            connections = connections.filter(c => c !== selectedConnection);
            saveState();
            draw();
        }
        connectionContextMenu.style.display = 'none';
    });

    function setDarkMode(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
            darkModeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
            localStorage.setItem('darkMode', 'enabled');
        } else {
            document.body.classList.remove('dark-mode');
            darkModeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
            localStorage.setItem('darkMode', 'disabled');
        }
        draw();
    }

    darkModeBtn.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-mode');
        setDarkMode(!isDarkMode);
    });

    document.getElementById('addNodeBtn').addEventListener('click', addNode);
    document.getElementById('resetViewBtn').addEventListener('click', resetView);
    document.getElementById('exportBtn').addEventListener('click', exportMindMap);
    document.getElementById('exportPngBtn').addEventListener('click', exportPNG);
    document.getElementById('exportSvgBtn').addEventListener('click', exportSVG);
    document.getElementById('importBtn').addEventListener('click', () => importInput.click());
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    document.getElementById('align-left').addEventListener('click', () => alignNodes('left'));
    document.getElementById('align-center-horizontal').addEventListener('click', () => alignNodes('center-horizontal'));
    document.getElementById('align-right').addEventListener('click', () => alignNodes('right'));
    document.getElementById('align-top').addEventListener('click', () => alignNodes('top'));
    document.getElementById('align-center-vertical').addEventListener('click', () => alignNodes('center-vertical'));
    document.getElementById('align-bottom').addEventListener('click', () => alignNodes('bottom'));
    document.getElementById('distribute-horizontal').addEventListener('click', () => distributeNodes('horizontal'));
    document.getElementById('distribute-vertical').addEventListener('click', () => distributeNodes('vertical'));

    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.json';
    importInput.addEventListener('change', importMindMap);

    if (localStorage.getItem('darkMode') === 'enabled') {
        setDarkMode(true);
    }

    saveState();
    updateUndoRedoButtons();
    updateToolbar();
});
