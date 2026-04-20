"use client";
import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, UploadSimple, MagicWand, FileText, 
  Trash, DownloadSimple, CornersOut, Sun, Contrast,
  ArrowUUpLeft, ArrowUUpRight, ArrowClockwise,
  MagnifyingGlass, PaintBrush, Eraser, ArrowsOutCardinal
} from "@phosphor-icons/react";

export default function DocScanner({ onBack }) {
  const [image, setImage] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [processedImage, setProcessedImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [corners, setCorners] = useState(null);
  const [activeCorner, setActiveCorner] = useState(null);
  const [showPerspectiveUI, setShowPerspectiveUI] = useState(false);
  
  // Navigation & Tools
  const [activeTool, setActiveTool] = useState("move"); // move, brush, eraser, zoom
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brushSize, setBrushSize] = useState(30);
  const [strokes, setStrokes] = useState([]);
  const [redoStrokes, setRedoStrokes] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Manual Cleanup Controls
  const [threshold, setThreshold] = useState(140);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1.0);
  const [scanMode, setScanMode] = useState("bw"); // "bw" or "color"
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Auto-process when controls change (debounced slightly)
  useEffect(() => {
    if (image && !showPerspectiveUI) {
      const timer = setTimeout(() => {
        processDocument(true); // pass true to avoid saving each tiny slider move to history
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [threshold, brightness, contrast, scanMode]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Clear previous state for new image
    setProcessedImage(null);
    setHistory([]);
    setRedoStack([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        // Initialize corners for perspective fix
        const w = img.width;
        const h = img.height;
        setCorners([
          { x: w * 0.1, y: h * 0.1 }, // Top Left
          { x: w * 0.9, y: h * 0.1 }, // Top Right
          { x: w * 0.9, y: h * 0.9 }, // Bottom Right
          { x: w * 0.1, y: h * 0.9 }  // Bottom Left
        ]);
        setStatus("Image Loaded");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const saveToHistory = (dataUrl) => {
    setHistory(prev => [...prev, processedImage || image.src]);
    setRedoStack([]);
  };

  const undo = () => {
    if (strokes.length > 0) {
      const lastStroke = strokes[strokes.length - 1];
      setRedoStrokes(prev => [...prev, lastStroke]);
      setStrokes(prev => prev.slice(0, -1));
      return;
    }
    if (history.length === 0) return;
    const prevState = history[history.length - 1];
    setRedoStack(prev => [...prev, processedImage || image.src]);
    setProcessedImage(prevState === image.src ? null : prevState);
    setHistory(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStrokes.length > 0) {
      const nextStroke = redoStrokes[redoStrokes.length - 1];
      setStrokes(prev => [...prev, nextStroke]);
      setRedoStrokes(prev => prev.slice(0, -1));
      return;
    }
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, processedImage || image.src]);
    setProcessedImage(nextState);
    setRedoStack(prev => prev.slice(0, -1));
  };

  const processDocument = async (skipHistory = false) => {
    if (!image) return;
    setStatus(skipHistory ? "Adjusting..." : "Processing Document...");
    
    // Simulate processing delay for UX (only for manual clicks)
    if (!skipHistory) await new Promise(r => setTimeout(r, 50));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = image.width;
    canvas.height = image.height;

    // PASS 1: Base Draw
    ctx.drawImage(image, 0, 0);

    // PASS 2: Intelligent Cleanup (Advanced CamScanner style)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Manual controls from state
    const tVal = threshold;
    const bVal = brightness;
    const cVal = contrast;
    const isColor = scanMode === "color";

    // First, convert to grayscale and boost overall luminosity
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i+1], b = data[i+2];
      
      // Calculate grayscale for logic
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Step 1: Base Cleanup
      // If it's very bright (paper), push to white
      if (gray > tVal) {
        if (isColor) {
           // Color mode: Whiten the background but keep color info
           const factor = 255 / gray;
           r = Math.min(255, r * factor);
           g = Math.min(255, g * factor);
           b = Math.min(255, b * factor);
        } else {
           r = g = b = 255;
        }
      } else if (gray < 80) {
        // Dark parts (text)
        if (isColor) {
           const factor = gray / 100;
           r *= factor; g *= factor; b *= factor;
        } else {
           r = g = b = 0;
        }
      } else {
        // Mid-tones
        if (isColor) {
           // Color contrast boost
           r = (r - 110) * (cVal) + 110 + bVal;
           g = (g - 110) * (cVal) + 110 + bVal;
           b = (b - 110) * (cVal) + 110 + bVal;
        } else {
           gray = (gray - 110) * (2.5 * cVal) + 110 + bVal;
           r = g = b = gray;
        }
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i+1] = Math.max(0, Math.min(255, g));
      data[i+2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    if (!skipHistory) saveToHistory();
    setProcessedImage(dataUrl);
    setStatus(skipHistory ? "Adjusted" : "Document Cleaned!");
    setTimeout(() => setStatus("Ready"), skipHistory ? 1000 : 2000);
  };

  const downloadDoc = () => {
    if (!processedImage) return;
    const link = document.createElement("a");
    link.download = `Scanned_Doc_${Date.now()}.jpg`;
    link.href = processedImage;
    link.click();
  };

  // Clear previous state for new image
  const clearImage = () => {
    setImage(null);
    setProcessedImage(null);
    setHistory([]);
    setRedoStack([]);
    setCorners(null);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setStrokes([]);
    setRedoStrokes([]);
    setStatus("Ready");
  };

  // ── DRAWING LOGIC ──────────────────────────────────────────────────────────
  useEffect(() => {
    drawCanvas();
  }, [image, processedImage, zoom, pan, strokes, activeTool, showPerspectiveUI, corners, activeCorner]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    // Auto-resize canvas to parent
    const parent = canvas.parentElement;
    if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!image) return;

    const displayImg = new Image();
    displayImg.onload = () => {
        const fitScale = Math.min((canvas.width * 0.9) / displayImg.width, (canvas.height * 0.9) / displayImg.height);
        const scale = fitScale * zoom;
        const imgW = displayImg.width * scale;
        const imgH = displayImg.height * scale;
        const xOffset = (canvas.width - imgW) / 2 + pan.x;
        const yOffset = (canvas.height - imgH) / 2 + pan.y;

        // Paper shadow
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 20;
        ctx.fillRect(xOffset, yOffset, imgW, imgH);
        ctx.shadowColor = "transparent";

        ctx.drawImage(displayImg, xOffset, yOffset, imgW, imgH);

        // Draw Strokes (Manual cleanup)
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        strokes.forEach(s => {
          ctx.beginPath();
          ctx.strokeStyle = s.type === "eraser" ? "#fff" : s.color; // For doc scanner, eraser/brush is usually white
          ctx.lineWidth = s.size * scale;
          s.points.forEach((p, idx) => {
            const px = xOffset + p.x * scale;
            const py = yOffset + p.y * scale;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        });

        // Draw Perspective UI if active
        if (showPerspectiveUI && corners) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          ctx.beginPath();
          corners.forEach((c, i) => {
            const cx = xOffset + c.x * scale;
            const cy = yOffset + c.y * scale;
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          corners.forEach((c, i) => {
            const cx = xOffset + c.x * scale;
            const cy = yOffset + c.y * scale;
            ctx.fillStyle = "#fff";
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
    };
    displayImg.src = processedImage || image.src;
  };

  const handleMouseDown = (e) => {
    if (!image) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const fitScale = Math.min((canvas.width * 0.9) / image.width, (canvas.height * 0.9) / image.height);
    const scale = fitScale * zoom;
    const xOffset = (canvas.width - image.width * scale) / 2 + pan.x;
    const yOffset = (canvas.height - image.height * scale) / 2 + pan.y;

    if (showPerspectiveUI && corners) {
        // Find nearest corner
        let nearestIdx = -1;
        let minDist = 30;
        corners.forEach((c, i) => {
          const cx = xOffset + c.x * scale;
          const cy = yOffset + c.y * scale;
          const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
          if (dist < minDist) {
            minDist = dist;
            nearestIdx = i;
          }
        });
        if (nearestIdx !== -1) {
          setActiveCorner(nearestIdx);
          return;
        }
    }

    if (activeTool === "brush" || activeTool === "eraser") {
      setIsDrawing(true);
      const imgX = (mx - xOffset) / scale;
      const imgY = (my - yOffset) / scale;
      setStrokes(prev => [...prev, {
        type: activeTool,
        color: activeTool === "brush" ? "#fff" : "#fff", // White for both by default in doc scanner
        size: brushSize,
        points: [{ x: imgX, y: imgY }]
      }]);
    } else if (activeTool === "move" || activeTool === "zoom") {
      setIsDrawing(true); // Reusing for dragging/panning
    }
  };

  const handleMouseMove = (e) => {
    if (!image || (!isDrawing && activeCorner === null)) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const fitScale = Math.min((canvas.width * 0.9) / image.width, (canvas.height * 0.9) / image.height);
    const scale = fitScale * zoom;
    const xOffset = (canvas.width - image.width * scale) / 2 + pan.x;
    const yOffset = (canvas.height - image.height * scale) / 2 + pan.y;

    if (activeCorner !== null) {
      const newCorners = [...corners];
      newCorners[activeCorner] = {
        x: (mx - xOffset) / scale,
        y: (my - yOffset) / scale
      };
      setCorners(newCorners);
      return;
    }

    if (isDrawing) {
      if (activeTool === "brush" || activeTool === "eraser") {
        const imgX = (mx - xOffset) / scale;
        const imgY = (my - yOffset) / scale;
        setStrokes(prev => {
          const last = prev[prev.length - 1];
          const newStrokes = prev.slice(0, -1);
          return [...newStrokes, { ...last, points: [...last.points, { x: imgX, y: imgY }] }];
        });
      } else if (activeTool === "move") {
        setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setActiveCorner(null);
  };

  const handleZoom = (delta) => {
    setZoom(prev => Math.max(0.1, Math.min(5, prev + delta)));
  };

  const handleApplyPerspective = () => {
    if (!image || !corners) return;
    setStatus("Fixing Perspective...");
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    const minX = Math.min(...corners.map(c => c.x));
    const maxX = Math.max(...corners.map(c => c.x));
    const minY = Math.min(...corners.map(c => c.y));
    const maxY = Math.max(...corners.map(c => c.y));
    
    const cropW = maxX - minX;
    const cropH = maxY - minY;

    const selectionRatio = cropW / cropH;
    const targetW = 1200; 
    const targetH = targetW / selectionRatio;

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.drawImage(image, minX, minY, cropW, cropH, 0, 0, targetW, targetH);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    saveToHistory();
    setProcessedImage(dataUrl);
    setShowPerspectiveUI(false);
    setStatus("Perspective Fixed!");
    setTimeout(() => setStatus("Ready"), 2000);
  };

  const handleCornerMove = (e, index) => {
    if (!showPerspectiveUI || !image) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * image.width;
    const y = ((e.clientY - rect.top) / rect.height) * image.height;
    
    const newCorners = [...corners];
    newCorners[index] = { x, y };
    setCorners(newCorners);
  };

  return (
    <div style={{ 
      height: '100vh', 
      backgroundColor: '#121212', 
      color: '#fff', 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 20px', 
        borderBottom: '1px solid #222', 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1a1a1a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={24} color="#10b981" weight="duotone" />
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>ProyojonTake Service Tool</h2>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              onClick={undo} 
              disabled={history.length === 0 && strokes.length === 0}
              style={{ background: '#2a2a2a', border: '1px solid #333', color: (history.length > 0 || strokes.length > 0) ? '#fff' : '#444', padding: '5px 10px', borderRadius: '4px', cursor: (history.length > 0 || strokes.length > 0) ? 'pointer' : 'default' }}
            >
              <ArrowUUpLeft size={16} />
            </button>
            <button 
              onClick={redo} 
              disabled={redoStack.length === 0 && redoStrokes.length === 0}
              style={{ background: '#2a2a2a', border: '1px solid #333', color: (redoStack.length > 0 || redoStrokes.length > 0) ? '#fff' : '#444', padding: '5px 10px', borderRadius: '4px', cursor: (redoStack.length > 0 || redoStrokes.length > 0) ? 'pointer' : 'default' }}
            >
              <ArrowUUpRight size={16} />
            </button>
          </div>
          <div style={{ color: '#666', fontSize: '12px' }}>{status}</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ 
          width: '280px', 
          backgroundColor: '#1a1a1a', 
          borderRight: '1px solid #222',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto'
        }}>
          <button 
            onClick={() => fileInputRef.current.click()}
            style={{ 
              width: '100%', 
              padding: '12px', 
              backgroundColor: '#10b981', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <UploadSimple size={18} /> Upload Document
          </button>

          <div style={{ marginTop: '10px' }}>
            <h4 style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>Toolbar</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' }}>
              <button 
                onClick={() => setActiveTool("move")}
                title="Move Tool (H)"
                style={{ 
                   padding: '10px', backgroundColor: activeTool === "move" ? '#10b981' : '#2a2a2a', 
                   border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', color: '#fff'
                }}
              >
                <ArrowsOutCardinal size={20} />
              </button>
              <button 
                onClick={() => setActiveTool("zoom")}
                title="Zoom Tool (Z)"
                style={{ 
                   padding: '10px', backgroundColor: activeTool === "zoom" ? '#10b981' : '#2a2a2a', 
                   border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', color: '#fff'
                }}
              >
                <MagnifyingGlass size={20} />
              </button>
              <button 
                onClick={() => setActiveTool("brush")}
                title="Brush Tool (B)"
                style={{ 
                   padding: '10px', backgroundColor: activeTool === "brush" ? '#10b981' : '#2a2a2a', 
                   border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', color: '#fff'
                }}
              >
                <PaintBrush size={20} />
              </button>
              <button 
                onClick={() => setActiveTool("eraser")}
                title="Eraser Tool (E)"
                style={{ 
                   padding: '10px', backgroundColor: activeTool === "eraser" ? '#10b981' : '#2a2a2a', 
                   border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', color: '#fff'
                }}
              >
                <Eraser size={20} />
              </button>
            </div>

            {(activeTool === "brush" || activeTool === "eraser") && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '5px' }}>
                  <span>Brush Size</span>
                  <span>{brushSize}px</span>
                </div>
                <input 
                  type="range" min="1" max="100" 
                  value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#10b981' }} 
                />
              </div>
            )}
          </div>

          <div style={{ marginTop: '0px' }}>
            <h4 style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>Quick Actions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={processDocument}
                disabled={!image}
                style={{ 
                  width: '100%', padding: '10px', backgroundColor: '#2a2a2a', color: image ? '#fff' : '#444', 
                  border: '1px solid #333', borderRadius: '6px', cursor: image ? 'pointer' : 'default',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px'
                }}
              >
                <MagicWand size={18} color="#10b981" /> Magic Clean (Auto)
              </button>
              <button 
                onClick={() => setShowPerspectiveUI(true)}
                disabled={!image}
                style={{ 
                  width: '100%', padding: '10px', backgroundColor: showPerspectiveUI ? '#10b981' : '#2a2a2a', color: image ? '#fff' : '#444', 
                  border: '1px solid #333', borderRadius: '6px', cursor: image ? 'pointer' : 'default',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px'
                }}
              >
                <CornersOut size={18} color={showPerspectiveUI ? "#fff" : "#10b981"} /> Perspective Fix
              </button>
              <button 
                onClick={clearImage}
                disabled={!image}
                style={{ 
                  width: '100%', padding: '10px', backgroundColor: '#2a2a2a', color: image ? '#f44336' : '#444', 
                  border: '1px solid #333', borderRadius: '6px', cursor: image ? 'pointer' : 'default',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px'
                }}
              >
                <ArrowClockwise size={18} /> Clear & Reset
              </button>
            </div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <h4 style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>Scan Mode</h4>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
              <button 
                onClick={() => setScanMode("bw")}
                style={{ 
                  flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  backgroundColor: scanMode === "bw" ? '#10b981' : '#2a2a2a',
                  color: '#fff', border: '1px solid #333', cursor: 'pointer'
                }}
              >
                B&W Magic
              </button>
              <button 
                onClick={() => setScanMode("color")}
                style={{ 
                  flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  backgroundColor: scanMode === "color" ? '#10b981' : '#2a2a2a',
                  color: '#fff', border: '1px solid #333', cursor: 'pointer'
                }}
              >
                Color Magic
              </button>
            </div>

            <h4 style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>Cleanup Controls</h4>
            
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '5px' }}>
                <span>Magic Intensity</span>
                <span>{threshold}</span>
              </div>
              <input 
                type="range" min="100" max="200" step="1" 
                value={threshold} 
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981' }} 
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '5px' }}>
                <span>Brightness</span>
                <span>{brightness}</span>
              </div>
              <input 
                type="range" min="-50" max="50" step="1" 
                value={brightness} 
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981' }} 
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '5px' }}>
                <span>Contrast</span>
                <span>{contrast.toFixed(1)}</span>
              </div>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={contrast} 
                onChange={(e) => setContrast(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981' }} 
              />
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button 
              onClick={downloadDoc}
              disabled={!processedImage}
              style={{ 
                width: '100%', padding: '12px', backgroundColor: processedImage ? '#fff' : '#222', 
                color: processedImage ? '#000' : '#444', border: 'none', borderRadius: '8px', 
                fontWeight: '700', cursor: processedImage ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
              }}
            >
              <DownloadSimple size={20} /> Save PDF / JPG
            </button>
          </div>
        </div>

        {/* Main Viewport */}
        <div style={{ 
          flex: 1, 
          padding: '20px', 
          backgroundColor: '#0f0f0f', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative'
        }}>
          {!image ? (
            <div style={{ textAlign: 'center', color: '#333' }}>
              <FileText size={80} weight="thin" />
              <p style={{ marginTop: '15px' }}>Upload a photo of a document to start cleaning</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <canvas 
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ 
                  width: '100%', height: '100%', 
                  cursor: activeTool === "move" ? 'grab' : (activeTool === "zoom" ? 'zoom-in' : 'crosshair'),
                  display: 'block'
                }} 
              />
              
              {showPerspectiveUI && (
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10, zIndex: 100 }}>
                  <button onClick={() => setShowPerspectiveUI(false)} style={{ padding: '8px 20px', backgroundColor: '#333', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleApplyPerspective} style={{ padding: '8px 20px', backgroundColor: '#10b981', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Apply Fix</button>
                </div>
              )}

              {status.includes("Processing") && (
                <div style={{ 
                  position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(4px)', zIndex: 1000
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <MagicWand size={40} className="animate-pulse" color="#10b981" />
                    <p style={{ marginTop: '10px', fontSize: '14px' }}>Magic Cleaning...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={handleFileUpload} 
      />
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
