"use client";
import React, { useState, useRef, useEffect } from "react";
import { 
  ArrowLeft, UploadSimple, ImageSquare, 
  Printer, DownloadSimple, ArrowsOutCardinal, 
  MagnifyingGlass, Trash, MagicWand, CornersOut,
  Sun, Contrast, Check, X, ArrowsClockwise, FilePdf, Question
} from "@phosphor-icons/react";

export default function NIDMaker({ onBack }) {
  const [front, setFront] = useState({ 
    raw: null, processed: null, 
    threshold: 140, brightness: 0, contrast: 1.0, saturation: 1.0, mode: "bw", 
    crop: null, showCrop: false,
    zoom: 1.0, pan: { x: 0, y: 0 },
    rotation: 0, lockRatio: true
  });
  const [back, setBack] = useState({ 
    raw: null, processed: null, 
    threshold: 140, brightness: 0, contrast: 1.0, saturation: 1.0, mode: "bw", 
    crop: null, showCrop: false,
    zoom: 1.0, pan: { x: 0, y: 0 },
    rotation: 0, lockRatio: true
  });
  
  const [frontProcessed, setFrontProcessed] = useState(null);
  const [backProcessed, setBackProcessed] = useState(null);
  const [editingSide, setEditingSide] = useState(null); // "front" or "back"
  const [activeHandle, setActiveHandle] = useState(null); // tl, tr, bl, br, center, pan
  const [showHelp, setShowHelp] = useState(false);
  const [zoom, setZoom] = useState(0.25);
  const [status, setStatus] = useState("Ready");
  const [layout, setLayout] = useState("1-card"); // "1-card", "2-cards"
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef(null);
  const editCanvasRef = useRef(null);
  const fileInputFront = useRef(null);
  const fileInputBack = useRef(null);

  // A4 Size @ 300 DPI
  const A4_W = 2480;
  const A4_H = 3508;
  const NID_W = 1012;
  const NID_H = 638;

  useEffect(() => {
    drawA4Preview();
  }, [frontProcessed, backProcessed, zoom, editingSide, layout]);

  // Handle auto-process when sliders change
  useEffect(() => {
    if (editingSide) {
      processSide(editingSide);
    }
  }, [
    editingSide, 
    front.threshold, back.threshold,
    front.brightness, back.brightness,
    front.contrast, back.contrast,
    front.saturation, back.saturation,
    front.mode, back.mode,
    front.rotation, back.rotation,
    JSON.stringify(front.crop), JSON.stringify(back.crop)
  ]);

  // Undo/Redo Logic
  const saveToHistory = (side, data) => {
    const newEntry = { side, state: { ...data } };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newEntry);
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      if (prev.side === "front") setFront(prev.state);
      else setBack(prev.state);
      setHistoryIndex(historyIndex - 1);
      setStatus("Undo Applied");
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if (!editingSide) return;
      
      const config = editingSide === "front" ? front : back;
      const updateConfig = (val) => {
        if (editingSide === "front") setFront(prev => ({ ...prev, ...val }));
        else setBack(prev => ({ ...prev, ...val }));
      };

      if (e.key === 'Enter') setEditingSide(null);
      if (e.key === '+') updateConfig({ zoom: Math.min(4, config.zoom + 0.2) });
      if (e.key === '-') updateConfig({ zoom: Math.max(0.5, config.zoom - 0.2) });
      if (e.key === 'r') rotateSide(editingSide);
      if (e.key === 'c') updateConfig({ showCrop: !config.showCrop });
      if (e.key === 's') setEditingSide(null); // Save
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingSide, front, back, history, historyIndex]);

  const copySettings = (fromSide) => {
    const source = fromSide === "front" ? front : back;
    const settings = {
      threshold: source.threshold,
      brightness: source.brightness,
      contrast: source.contrast,
      saturation: source.saturation,
      mode: source.mode,
      rotation: source.rotation
    };
    if (fromSide === "front") setBack(prev => ({ ...prev, ...settings }));
    else setFront(prev => ({ ...prev, ...settings }));
    setStatus(`Settings copied to ${fromSide === "front" ? "Back" : "Front"}`);
  };

  const rotateSide = (side) => {
    const config = side === "front" ? front : back;
    saveToHistory(side, config);
    const newRotation = (config.rotation + 90) % 360;
    if (side === "front") setFront(prev => ({ ...prev, rotation: newRotation }));
    else setBack(prev => ({ ...prev, rotation: newRotation }));
  };

  const autoEnhance = (side) => {
    const config = side === "front" ? front : back;
    saveToHistory(side, config);
    if (side === "front") {
      setFront(prev => ({ ...prev, threshold: 145, brightness: 5, contrast: 1.3, saturation: 1.2, mode: "color" }));
    } else {
      setBack(prev => ({ ...prev, threshold: 145, brightness: 5, contrast: 1.3, saturation: 1.2, mode: "color" }));
    }
    setStatus("Auto Enhanced Applied");
  };

  const handleFileUpload = (file, side) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width, h = img.height;
        // Photoshop-style default crop (rectangular box)
        const initialCrop = {
          x: w * 0.1, y: h * 0.1, 
          w: w * 0.8, h: h * 0.8
        };
        
    const update = { raw: img, processed: null, crop: initialCrop };
    if (side === "front") {
      saveToHistory("front", front);
      setFront(prev => ({ ...prev, ...update }));
    } else {
      saveToHistory("back", back);
      setBack(prev => ({ ...prev, ...update }));
    }
        
        setEditingSide(side);
        setStatus(`${side === "front" ? "Front" : "Back"} Part Uploaded`);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const processSide = async (side) => {
    const config = side === "front" ? front : back;
    if (!config.raw) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    // Use crop coordinates
    let minX = 0, minY = 0, cropW = config.raw.width, cropH = config.raw.height;
    if (config.crop) {
      minX = config.crop.x;
      minY = config.crop.y;
      cropW = config.crop.w;
      cropH = config.crop.h;
    }

    // Standard NID ratio
    canvas.width = NID_W;
    canvas.height = NID_H;

    // Apply rotation
    if (config.rotation !== 0) {
      ctx.translate(NID_W/2, NID_H/2);
      ctx.rotate((config.rotation * Math.PI) / 180);
      ctx.translate(-NID_W/2, -NID_H/2);
    }

    // Fix aspect ratio mismatch when drawing
    ctx.drawImage(config.raw, minX, minY, cropW, cropH, 0, 0, NID_W, NID_H);

    const imageData = ctx.getImageData(0, 0, NID_W, NID_H);
    const data = imageData.data;
    const { threshold: t, brightness: b, contrast: c, saturation: s, mode } = config;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i+1], bVal = data[i+2];
      
      // Brightness & Contrast
      r = (r - 128) * c + 128 + b;
      g = (g - 128) * c + 128 + b;
      bVal = (bVal - 128) * c + 128 + b;

      let gray = 0.299 * r + 0.587 * g + 0.114 * bVal;

      if (mode === "bw") {
        if (gray > t) gray = 255;
        else if (gray < 80) gray = 0;
        else gray = (gray - 110) * (2.5 * c) + 110;
        data[i] = data[i+1] = data[i+2] = Math.max(0, Math.min(255, gray));
      } else {
        // Color Magic with Saturation
        if (gray > t) {
          const f = 255 / gray;
          r = Math.min(255, r * f); g = Math.min(255, g * f); bVal = Math.min(255, bVal * f);
        }
        
        // Saturation
        r = gray + (r - gray) * s;
        g = gray + (g - gray) * s;
        bVal = gray + (bVal - gray) * s;

        data[i] = Math.max(0, Math.min(255, r));
        data[i+1] = Math.max(0, Math.min(255, g));
        data[i+2] = Math.max(0, Math.min(255, bVal));
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const result = canvas.toDataURL("image/png");
    if (side === "front") setFrontProcessed(result);
    else setBackProcessed(result);
  };

  const drawA4Preview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = A4_W * zoom; canvas.height = A4_H * zoom;
    const S = zoom;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const gap = 120 * S;

    const drawSide = (imgStr, x, y, label) => {
      if (!imgStr) return;
      const img = new Image();
      img.onload = () => {
        const w = NID_W * S, h = NID_H * S;
        ctx.drawImage(img, x - w/2, y, w, h);
        
        // Label
        ctx.fillStyle = "#888";
        ctx.font = `${14 * S}px Arial`;
        ctx.fillText(label, x - w/2, y - 5*S);

        // Very subtle border only for guide
        ctx.strokeStyle = "rgba(0,0,0,0.05)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - w/2, y, w, h);
      };
      img.src = imgStr;
    };

    if (layout === "1-card") {
      // 1 Card Layout (Single Pair)
      const startY = (A4_H * 0.25) * S;
      drawSide(frontProcessed, centerX, startY, "FRONT PART");
      drawSide(backProcessed, centerX, startY + (NID_H * S) + gap, "BACK PART");
    } else {
      // 2 Cards Layout (Stacked Pairs)
      const startY = (A4_H * 0.1) * S;
      for (let i = 0; i < 2; i++) {
        const y = startY + i * (NID_H * 2 * S + gap * 2);
        drawSide(frontProcessed, centerX, y, `NID ${i+1} - FRONT`);
        drawSide(backProcessed, centerX, y + (NID_H * S) + gap/2, `NID ${i+1} - BACK`);
      }
    }
  };

  const exportA4 = (format = "png") => {
    const canvas = document.createElement("canvas");
    canvas.width = A4_W; canvas.height = A4_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, A4_W, A4_H);
    
    const drawOnSheet = async (imgStr, x, y, label) => {
      if (!imgStr) return;
      return new Promise(res => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x - NID_W/2, y, NID_W, NID_H);
          ctx.fillStyle = "#aaa";
          ctx.font = "20px Arial";
          ctx.fillText(label, x - NID_W/2, y - 10);
          res();
        };
        img.src = imgStr;
      });
    };
    
    const centerX = A4_W / 2;
    const jobs = [];
    if (layout === "1-card") {
      const startY = A4_H * 0.25;
      jobs.push(drawOnSheet(frontProcessed, centerX, startY, "FRONT PART"));
      jobs.push(drawOnSheet(backProcessed, centerX, startY + NID_H + 120, "BACK PART"));
    } else {
      const startY = A4_H * 0.1;
      for (let i = 0; i < 2; i++) {
        const y = startY + i * (NID_H * 2 + 120);
        jobs.push(drawOnSheet(frontProcessed, centerX, y, `NID ${i+1} - FRONT`));
        jobs.push(drawOnSheet(backProcessed, centerX, y + NID_H + 60, `NID ${i+1} - BACK`));
      }
    }

    Promise.all(jobs).then(() => {
      const link = document.createElement("a");
      link.download = `NID_Print_Sheet_${new Date().getTime()}.${format}`;
      link.href = canvas.toDataURL(`image/${format === 'pdf' ? 'jpeg' : 'png'}`);
      link.click();
      setStatus(`Exported as ${format.toUpperCase()}`);
    });
  };

  if (editingSide) {
    const config = editingSide === "front" ? front : back;
    const updateConfig = (val) => {
      if (editingSide === "front") setFront(prev => ({ ...prev, ...val }));
      else setBack(prev => ({ ...prev, ...val }));
    };

    return (
      <div style={{ height: '100vh', backgroundColor: '#0f0f0f', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 25px', backgroundColor: '#1a1a1a', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button onClick={() => setEditingSide(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><ArrowLeft size={20} /></button>
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Editing {editingSide === "front" ? "Front" : "Back"} Part</h3>
          </div>
          <button onClick={() => setEditingSide(null)} style={{ padding: '8px 25px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Done</button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: '300px', backgroundColor: '#1a1a1a', padding: '25px', borderRight: '1px solid #222', overflowY: 'auto' }}>
            <h4 style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase', marginBottom: '20px' }}>Magic Enhance</h4>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '25px' }}>
              <button onClick={() => updateConfig({ mode: "bw" })} style={{ flex: 1, padding: '10px', backgroundColor: config.mode === "bw" ? "#10b981" : "#2a2a2a", border: 'none', borderRadius: 6, color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>B&W</button>
              <button onClick={() => updateConfig({ mode: "color" })} style={{ flex: 1, padding: '10px', backgroundColor: config.mode === "color" ? "#10b981" : "#2a2a2a", border: 'none', borderRadius: 6, color: '#fff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Color</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '8px' }}><span>Magic Intensity</span><span>{config.threshold}</span></div>
              <input type="range" min="100" max="200" value={config.threshold} onChange={(e) => updateConfig({ threshold: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#10b981' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '8px' }}><span>Brightness</span><span>{config.brightness}</span></div>
              <input type="range" min="-50" max="50" value={config.brightness} onChange={(e) => updateConfig({ brightness: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#10b981' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '8px' }}><span>Contrast</span><span>{config.contrast.toFixed(1)}</span></div>
              <input type="range" min="0.5" max="2.0" step="0.1" value={config.contrast} onChange={(e) => updateConfig({ contrast: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: '#10b981' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '8px' }}><span>Saturation</span><span>{config.saturation.toFixed(1)}</span></div>
              <input type="range" min="0.0" max="2.0" step="0.1" value={config.saturation} onChange={(e) => updateConfig({ saturation: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: '#10b981' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button 
                onClick={() => updateConfig({ lockRatio: !config.lockRatio })} 
                style={{ flex: 1, padding: '10px', backgroundColor: config.lockRatio ? "#10b981" : "#2a2a2a", border: 'none', borderRadius: 6, color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
              >
                <Check size={14} /> Lock NID Ratio
              </button>
            </div>

            <button onClick={() => updateConfig({ showCrop: !config.showCrop })} style={{ width: '100%', padding: '12px', backgroundColor: config.showCrop ? '#10b981' : '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
              <CornersOut size={18} /> {config.showCrop ? "Hide Crop Tool" : "Crop Tool (Photoshop)"}
            </button>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <button onClick={() => rotateSide(editingSide)} style={{ flex: 1, padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #333', color: '#fff', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <ArrowsClockwise size={16} /> Rotate
              </button>
              <button onClick={() => autoEnhance(editingSide)} style={{ flex: 1, padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #333', color: '#10b981', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <MagicWand size={16} /> Auto-Fix
              </button>
            </div>

            <button onClick={() => copySettings(editingSide)} style={{ width: '100%', padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #333', color: '#888', borderRadius: 6, cursor: 'pointer', fontSize: '11px', marginBottom: '25px' }}>
              Copy Settings to {editingSide === "front" ? "Back" : "Front"} Part
            </button>

            <h4 style={{ fontSize: '12px', color: '#555', textTransform: 'uppercase', marginBottom: '15px' }}>Navigation</h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => updateConfig({ zoom: Math.max(0.5, config.zoom - 0.2) })} style={{ flex: 1, padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #333', color: '#fff', borderRadius: 6, cursor: 'pointer' }}><MagnifyingGlass size={18} /> -</button>
              <button onClick={() => updateConfig({ zoom: Math.min(4, config.zoom + 0.2) })} style={{ flex: 1, padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #333', color: '#fff', borderRadius: 6, cursor: 'pointer' }}><MagnifyingGlass size={18} /> +</button>
              <button onClick={() => updateConfig({ zoom: 1.0, pan: { x: 0, y: 0 } })} style={{ flex: 1, padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #333', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>Reset</button>
            </div>
          </div>

          <div 
            style={{ flex: 1, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
            onWheel={(e) => {
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              updateConfig({ zoom: Math.max(0.5, Math.min(4, config.zoom + delta)) });
            }}
          >
            <div 
              id="nid-edit-container" 
              onMouseDown={(e) => { if (!config.showCrop) setActiveHandle("pan"); }}
              style={{ 
                position: 'relative', 
                transform: `scale(${config.zoom}) translate(${config.pan.x}px, ${config.pan.y}px)`,
                transition: activeHandle === "pan" ? 'none' : 'transform 0.1s ease-out',
                cursor: config.showCrop ? 'default' : (activeHandle === "pan" ? 'grabbing' : 'grab')
              }}
            >
              {/* Show the ACTUAL processed image for 100% accuracy in editor */}
              <img 
                id="nid-edit-img"
                src={(editingSide === "front" ? frontProcessed : backProcessed) || config.raw?.src} 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '80vh', 
                  display: 'block', 
                  boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                  // Remove CSS filters - the processSide function now does everything
                }} 
              />
              
              {config.showCrop && config.crop && (
                <div style={{ position: 'absolute', inset: 0 }}>
                  {/* Overlay for non-crop area - use RAW image for cropping guide */}
                  <div 
                    style={{ 
                      position: 'absolute', 
                      inset: 0, 
                      backgroundImage: `url(${config.raw?.src})`,
                      backgroundSize: '100% 100%',
                      opacity: 0.3
                    }} 
                  />
                  
                  {/* Crop Box Area (Clear) */}
                  <div 
                    onMouseDown={(e) => { e.preventDefault(); setActiveHandle("center"); }}
                    style={{ 
                      position: 'absolute', 
                      left: `${(config.crop.x / config.raw.width) * 100}%`, 
                      top: `${(config.crop.y / config.raw.height) * 100}%`, 
                      width: `${(config.crop.w / config.raw.width) * 100}%`, 
                      height: `${(config.crop.h / config.raw.height) * 100}%`,
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                      cursor: 'move',
                      zIndex: 50
                    }} 
                  >
                    {/* Corner Handles */}
                    {['tl', 'tr', 'bl', 'br'].map(h => (
                      <div 
                        key={h} 
                        onMouseDown={(e) => { e.stopPropagation(); setActiveHandle(h); }}
                        style={{ 
                          position: 'absolute', 
                          width: '14px', height: '14px', 
                          backgroundColor: '#fff', 
                          border: '2px solid #10b981',
                          borderRadius: '2px',
                          left: h.includes('l') ? '-7px' : 'auto',
                          right: h.includes('r') ? '-7px' : 'auto',
                          top: h.includes('t') ? '-7px' : 'auto',
                          bottom: h.includes('b') ? '-7px' : 'auto',
                          cursor: `${h}-resize`,
                          zIndex: 100
                        }} 
                      />
                    ))}
                    
                    {/* Grid lines like Photoshop */}
                    <div style={{ position: 'absolute', inset: 0, borderRight: '1px solid rgba(255,255,255,0.3)', borderLeft: '1px solid rgba(255,255,255,0.3)', width: '33.33%', left: '33.33%', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', inset: 0, borderBottom: '1px solid rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.3)', height: '33.33%', top: '33.33%', pointerEvents: 'none' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global mouse events for crop dragging/resizing */}
        <div 
          onMouseMove={(e) => {
            if (activeHandle !== null) {
              const img = document.getElementById("nid-edit-img");
              if (!img) return;
              const rect = img.getBoundingClientRect();
              const mx = ((e.clientX - rect.left) / rect.width) * config.raw.width;
              const my = ((e.clientY - rect.top) / rect.height) * config.raw.height;
              
              let { x, y, w, h } = config.crop;
              let { pan: panPos } = config;
              const minSize = 50;

              if (activeHandle === "pan") {
                panPos.x += e.movementX / config.zoom;
                panPos.y += e.movementY / config.zoom;
                updateConfig({ pan: { ...panPos } });
                return;
              }

              if (activeHandle === "center") {
                const dx = (e.movementX / rect.width) * config.raw.width;
                const dy = (e.movementY / rect.height) * config.raw.height;
                x += dx; y += dy;
              } else {
                if (activeHandle.includes('l')) { const dx = x - mx; x = mx; w += dx; }
                if (activeHandle.includes('r')) { w = mx - x; }
                if (activeHandle.includes('t')) { const dy = y - my; y = my; h += dy; }
                if (activeHandle.includes('b')) { h = my - y; }

                if (config.lockRatio) {
                  const targetRatio = NID_W / NID_H;
                  if (activeHandle === 'tl' || activeHandle === 'br' || activeHandle === 'tr' || activeHandle === 'bl') {
                    h = w / targetRatio;
                  }
                }
              }

              // Bounds & Min Size
              x = Math.max(0, Math.min(config.raw.width - 50, x));
              y = Math.max(0, Math.min(config.raw.height - 50, y));
              w = Math.max(minSize, Math.min(config.raw.width - x, w));
              h = Math.max(minSize, Math.min(config.raw.height - y, h));

              updateConfig({ crop: { x, y, w, h } });
            }
          }}
          onMouseUp={() => setActiveHandle(null)}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: activeHandle !== null ? 'all' : 'none',
            zIndex: 9999
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', backgroundColor: '#121212', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><ArrowLeft size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ImageSquare size={24} color="#f59e0b" weight="duotone" /><h2 style={{ fontSize: '18px', fontWeight: '600' }}>ProyojonTake Service Tool</h2>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => setShowHelp(!showHelp)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Question size={20} /> <span style={{ fontSize: '12px' }}>Help</span>
          </button>
          <div style={{ color: '#666', fontSize: '12px' }}>{status}</div>
        </div>
      </div>

      {showHelp && (
        <div style={{ position: 'fixed', top: 60, right: 20, width: '250px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: '20px', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '10px', color: '#f59e0b' }}>Quick Guide</h4>
          <ul style={{ fontSize: '12px', color: '#bbb', paddingLeft: '15px', lineHeight: '1.8' }}>
            <li><b>Enter:</b> Save & Close</li>
            <li><b>R:</b> Rotate Photo</li>
            <li><b>C:</b> Toggle Crop Tool</li>
            <li><b>+/-:</b> Zoom In/Out</li>
            <li><b>Drag:</b> Pan (when not cropping)</li>
            <li><b>Auto-Fix:</b> One-click cleanup</li>
          </ul>
          <button onClick={() => setShowHelp(false)} style={{ width: '100%', marginTop: '15px', padding: '8px', backgroundColor: '#333', border: 'none', borderRadius: 6, color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Close</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '320px', backgroundColor: '#1a1a1a', borderRight: '1px solid #222', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          <div>
            <h4 style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', marginBottom: '15px' }}>NID Parts (Drag & Drop)</h4>
            
            <div 
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#10b981"; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = "#444"; }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#444"; handleFileUpload(e.dataTransfer.files[0], "front"); }}
              onClick={() => fileInputFront.current.click()} 
              style={{ padding: '15px', backgroundColor: '#2a2a2a', borderRadius: 8, border: '1px dashed #444', textAlign: 'center', cursor: 'pointer', marginBottom: 10, transition: 'all 0.2s' }}
            >
              {frontProcessed ? <img src={frontProcessed} style={{ width: '100%', borderRadius: 4 }} /> : <><UploadSimple size={24} color="#f59e0b" style={{ marginBottom: 5 }} /><div style={{ fontSize: '12px' }}>Front Part</div><div style={{ fontSize: '10px', color: '#555' }}>Drop image here</div></>}
            </div>
            {frontProcessed && <button onClick={() => setEditingSide("front")} style={{ width: '100%', padding: '8px', backgroundColor: '#333', border: 'none', borderRadius: 6, color: '#fff', fontSize: '11px', marginBottom: 15, cursor: 'pointer' }}>Edit Front</button>}

            <div 
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#10b981"; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = "#444"; }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#444"; handleFileUpload(e.dataTransfer.files[0], "back"); }}
              onClick={() => fileInputBack.current.click()} 
              style={{ padding: '15px', backgroundColor: '#2a2a2a', borderRadius: 8, border: '1px dashed #444', textAlign: 'center', cursor: 'pointer', marginBottom: 10, transition: 'all 0.2s' }}
            >
              {backProcessed ? <img src={backProcessed} style={{ width: '100%', borderRadius: 4 }} /> : <><UploadSimple size={24} color="#f59e0b" style={{ marginBottom: 5 }} /><div style={{ fontSize: '12px' }}>Back Part</div><div style={{ fontSize: '10px', color: '#555' }}>Drop image here</div></>}
            </div>
            {backProcessed && <button onClick={() => setEditingSide("back")} style={{ width: '100%', padding: '8px', backgroundColor: '#333', border: 'none', borderRadius: 6, color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Edit Back</button>}
          </div>

          <div>
            <h4 style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', marginBottom: '15px' }}>Print Layout (A4 Sheet)</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setLayout("1-card")} style={{ flex: 1, padding: '10px', backgroundColor: layout === "1-card" ? "#10b981" : "#2a2a2a", border: 'none', borderRadius: 6, color: '#fff', fontSize: '11px', cursor: 'pointer' }}>1 Card (Front+Back)</button>
              <button onClick={() => setLayout("2-cards")} style={{ flex: 1, padding: '10px', backgroundColor: layout === "2-cards" ? "#10b981" : "#2a2a2a", border: 'none', borderRadius: 6, color: '#fff', fontSize: '11px', cursor: 'pointer' }}>2 Cards (Front+Back)</button>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', marginBottom: '15px' }}>Quick Actions</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={undo} disabled={historyIndex < 1} style={{ flex: 1, padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #333', borderRadius: 6, color: historyIndex < 1 ? '#444' : '#fff', fontSize: '11px', cursor: 'pointer' }}>Undo</button>
              <button onClick={() => { setFront(prev => ({ ...prev, raw: null })); setBack(prev => ({ ...prev, raw: null })); setFrontProcessed(null); setBackProcessed(null); setStatus("Cleared"); }} style={{ flex: 1, padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #333', borderRadius: 6, color: '#f87171', fontSize: '11px', cursor: 'pointer' }}>Clear All</button>
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => exportA4("png")} disabled={!frontProcessed && !backProcessed} style={{ width: '100%', padding: '12px', backgroundColor: (frontProcessed || backProcessed) ? '#fff' : '#222', color: (frontProcessed || backProcessed) ? '#000' : '#444', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <DownloadSimple size={18} /> Download PNG
            </button>
            <button onClick={() => exportA4("pdf")} disabled={!frontProcessed && !backProcessed} style={{ width: '100%', padding: '12px', backgroundColor: '#2a2a2a', color: (frontProcessed || backProcessed) ? '#fff' : '#444', border: '1px solid #333', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <FilePdf size={18} color="#ef4444" /> Export PDF (Print)
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '40px', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          <canvas ref={canvasRef} style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.5)', display: 'block' }} />
        </div>
      </div>

      <input type="file" ref={fileInputFront} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0], "front")} />
      <input type="file" ref={fileInputBack} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0], "back")} />
    </div>
  );
}
