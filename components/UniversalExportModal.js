"use client";
import React, { useState, useEffect, useRef } from "react";
import { DeviceMobile, Printer, Ruler, Layout, Check, X, Plus, Minus, DownloadSimple } from "@phosphor-icons/react";

// Standard DPI for professional printing
const DPI = 300;
const mmToPx = (mm) => Math.round((mm / 25.4) * DPI);
const inchToPx = (inch) => Math.round(inch * DPI);

const PAPER_PRESETS = [
  { id: 'dnp', name: 'DNP (4x6 inch)', w: 1800, h: 1200, unit: 'in' },
  { id: 'a4', name: 'A4 Paper', w: 2480, h: 3508, unit: 'mm' },
  { id: '5r', name: '5R (5x7 inch)', w: 1500, h: 2100, unit: 'in' },
  { id: '8r', name: '8R (8x10 inch)', w: 2400, h: 3000, unit: 'in' },
  { id: 'custom', name: 'Custom Size...', w: 1000, h: 1000, unit: 'in' }
];

const PHOTO_SIZES = {
  pp: { name: 'Passport', w: 450, h: 540, label: '1.5x1.8 inch' },
  st: { name: 'Stamp', w: 240, h: 300, label: '0.8x1.0 inch' },
  fourR: { name: '4R Photo', w: 1800, h: 1200, label: '4x6 inch' }
};

export default function UniversalExportModal({ activeImage, activeBgColor, queue, onClose, initialPaperId = 'dnp' }) {
  const [selectedPaper, setSelectedPaper] = useState(() => 
    PAPER_PRESETS.find(p => p.id === initialPaperId) || PAPER_PRESETS[0]
  );
  const [customW, setCustomW] = useState(4);
  const [customH, setCustomH] = useState(6);
  const [unit, setUnit] = useState('in'); // 'in' or 'mm'
  
  const [margin, setMargin] = useState(20);
  const [gap, setGap] = useState(30);
  const [itemCounts, setItemCounts] = useState({});
  const [status, setStatus] = useState("Ready");
  const [fitsAll, setFitsAll] = useState(true);
  const canvasRef = useRef(null);

  const allItems = [...queue];
  if (activeImage && !queue.find(a => a.img === activeImage)) {
    allItems.unshift({ id: 'active', img: activeImage, name: 'Active Work', bgColor: activeBgColor });
  }

  // Initialize counts
  useEffect(() => {
    const initial = {};
    allItems.forEach(item => {
      initial[item.id] = { pp: 0, st: 0, fourR: 0 };
    });
    if (initial['active']) initial['active'].pp = 4;
    else if (allItems[0]) initial[allItems[0].id].pp = 4;
    setItemCounts(initial);
  }, []);

  const getSheetSize = () => {
    if (selectedPaper.id !== 'custom') return { w: selectedPaper.w, h: selectedPaper.h };
    return {
      w: unit === 'in' ? inchToPx(customW) : mmToPx(customW),
      h: unit === 'in' ? inchToPx(customH) : mmToPx(customH)
    };
  };

  const resizeImage = (sourceImg, targetW, targetH, bgColor, forceRotate = false) => {
    const canvas = document.createElement("canvas");
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    
    ctx.fillStyle = bgColor && bgColor !== "transparent" ? bgColor : "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    
    if (forceRotate) {
      ctx.save();
      ctx.translate(targetW / 2, targetH / 2);
      ctx.rotate(Math.PI / 2);
      
      const sRatio = sourceImg.width / sourceImg.height;
      const tRatio = targetH / targetW;
      let w = sourceImg.width, h = sourceImg.height, sx = 0, sy = 0;
      if (tRatio > sRatio) { h = w / tRatio; sy = (sourceImg.height - h) / 2; }
      else { w = h * tRatio; sx = (sourceImg.width - w) / 2; }
      ctx.drawImage(sourceImg, sx, sy, w, h, -targetH / 2, -targetW / 2, targetH, targetW);
      ctx.restore();
    } else {
      const sRatio = sourceImg.width / sourceImg.height;
      const tRatio = targetW / targetH;
      let w = sourceImg.width, h = sourceImg.height, sx = 0, sy = 0;
      if (tRatio > sRatio) { h = w / tRatio; sy = (sourceImg.height - h) / 2; }
      else { w = h * tRatio; sx = (sourceImg.width - w) / 2; }
      ctx.drawImage(sourceImg, sx, sy, w, h, 0, 0, targetW, targetH);
    }
    return canvas;
  };

  const calculateLayout = () => {
    const { w: W, h: H } = getSheetSize();
    let placements = [];
    let isFit = true;
    const gap_local = gap;

    // Collect requested items
    const ppItems = [];
    const stItems = [];
    const frItems = [];

    allItems.forEach(item => {
      const counts = itemCounts[item.id] || { pp: 0, st: 0, fourR: 0 };
      for (let i = 0; i < (counts.fourR || 0); i++) frItems.push(item);
      for (let i = 0; i < (counts.pp || 0); i++) ppItems.push(item);
      for (let i = 0; i < (counts.st || 0); i++) stItems.push(item);
    });

    if (frItems.length === 0 && ppItems.length === 0 && stItems.length === 0) return [];

    if (frItems.length > 0 && ppItems.length === 0 && stItems.length === 0) {
      placements.push({ x: 0, y: 0, w: W, h: H, asset: frItems[0], type: '4r' });
    } else {
      const pw = PHOTO_SIZES.pp.w;
      const ph = PHOTO_SIZES.pp.h;
      const sw = PHOTO_SIZES.st.w;
      const sh = PHOTO_SIZES.st.h;

      const cols = Math.floor((W - 2 * margin + gap_local) / (pw + gap_local)) || 1;
      const rows = Math.floor((H - 2 * margin + gap_local) / (ph + gap_local)) || 1;

      // Calculate centering offsets
      const hasStampsOnRight = stItems.length > (rows * cols - ppItems.length) * 2;
      const grid_w = (cols * pw) + ((cols - 1) * gap_local) + (hasStampsOnRight ? (sw + gap_local) : 0);
      const grid_h = (rows * ph) + ((rows - 1) * gap_local);
      
      const offsetX = (W - grid_w) / 2;
      const offsetY = (H - grid_h) / 2;

      let currentPpIdx = 0;
      let currentStIdx = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const slot_x = offsetX + c * (pw + gap_local);
          const slot_y = offsetY + r * (ph + gap_local);

          if (currentPpIdx < ppItems.length) {
            placements.push({ x: slot_x, y: slot_y, w: pw, h: ph, type: 'pp', asset: ppItems[currentPpIdx] });
            currentPpIdx++;
          } else if (currentStIdx < stItems.length) {
            const st_land_w = sh; 
            const st_land_h = sw; 
            const total_h = st_land_h * 2 + gap_local;
            const start_x = slot_x + (pw - st_land_w) / 2;
            const start_y = slot_y + (ph - total_h) / 2;

            placements.push({ x: start_x, y: start_y, w: st_land_w, h: st_land_h, type: 'st', asset: stItems[currentStIdx], rotate: true });
            currentStIdx++;
            if (currentStIdx < stItems.length) {
              placements.push({ x: start_x, y: start_y + st_land_h + gap_local, w: st_land_w, h: st_land_h, type: 'st', asset: stItems[currentStIdx], rotate: true });
              currentStIdx++;
            }
          }
        }
      }

      let nextX = offsetX + cols * (pw + gap_local);
      let nextY = offsetY;
      while (currentStIdx < stItems.length) {
        if (nextY + sh > H - offsetY) {
           nextX += sw + gap_local;
           nextY = offsetY;
        }
        if (nextX + sw > W) { isFit = false; break; }
        placements.push({ x: nextX, y: nextY, w: sw, h: sh, type: 'st', asset: stItems[currentStIdx] });
        nextY += sh + gap_local;
        currentStIdx++;
      }
      if (currentPpIdx < ppItems.length) isFit = false;
    }

    setFitsAll(isFit);
    setStatus(isFit ? `Arranged correctly.` : "Warning: Overflows paper size!");
    return placements;
  };

  const drawLayout = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { w: W, h: H } = getSheetSize();
    
    // Fixed preview size — screen width based (no parent dependency)
    const maxW = Math.min(window.innerWidth - 48, 400);
    const maxH = Math.min(window.innerHeight * 0.55, 400);
    
    const scaleW = maxW / W;
    const scaleH = maxH / H;
    const S = Math.min(scaleW, scaleH, 0.5); // max 50% scale

    canvas.width = Math.max(1, Math.round(W * S));
    canvas.height = Math.max(1, Math.round(H * S));

    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const placements = calculateLayout();

    // Add Dashed Cut Lines (DNP Style)
    if (placements.length > 0) {
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.8;
      const xs = new Set();
      const ys = new Set();
      placements.forEach(p => {
        xs.add(Math.round(p.x * S));
        xs.add(Math.round((p.x + p.w) * S));
        ys.add(Math.round(p.y * S));
        ys.add(Math.round((p.y + p.h) * S));
      });
      xs.forEach(x => {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      });
      ys.forEach(y => {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    placements.forEach(p => {
      const pw = Math.round(p.w * S), ph = Math.round(p.h * S);
      const raw = resizeImage(p.asset.img, pw, ph, p.asset.bgColor, p.rotate);
      ctx.drawImage(raw, Math.round(p.x * S), Math.round(p.y * S));
      ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 0.5;
      ctx.strokeRect(Math.round(p.x * S), Math.round(p.y * S), pw, ph);
    });
  };

  // Re-draw when data changes
  useEffect(() => {
    const t = setTimeout(drawLayout, 50); // small delay ensures canvas is mounted
    window.addEventListener('resize', drawLayout);
    return () => { clearTimeout(t); window.removeEventListener('resize', drawLayout); };
  }, [itemCounts, selectedPaper, customW, customH, unit, margin, gap]);



  const doExport = () => {
    const { w: W, h: H } = getSheetSize();
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, W, H);
    const placements = calculateLayout();
    
    placements.forEach(p => {
      const raw = resizeImage(p.asset.img, p.w, p.h, p.asset.bgColor, p.rotate);
      ctx.drawImage(raw, p.x, p.y);
      ctx.strokeStyle = "#eee"; ctx.lineWidth = 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    });

    const link = document.createElement("a");
    link.download = `Print_Sheet_${selectedPaper.name.replace(/\s+/g, '_')}_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div className="modal-header" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', height: 48, flexShrink: 0,
          background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)',
          borderBottom: '1px solid rgba(46,111,247,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(46,111,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Printer size={18} color="#2e6ff7" weight="bold" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Print Layout Builder</div>
              <div style={{ fontSize: 9, color: '#888', lineHeight: 1 }}>300 DPI Professional Quality</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#aaa' }}>
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* ── Content Area: Split Layout ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* TOP: LIVE PREVIEW (Always visible) */}
          <div style={{
            display: 'flex', flexDirection: 'column', background: '#0d0d0d', flexShrink: 0,
            borderBottom: '1px solid #2a2a2a', height: '45%' // Takes 45% of available space
          }}>
            {/* Paper chips */}
            <div style={{ padding: '8px 12px', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
              {PAPER_PRESETS.filter(p => p.id !== 'custom').map(p => (
                <button key={p.id} onClick={() => setSelectedPaper(p)} style={{
                  padding: '5px 12px', borderRadius: 20, border: '1px solid',
                  borderColor: selectedPaper.id === p.id ? '#2e6ff7' : '#333',
                  background: selectedPaper.id === p.id ? 'rgba(46,111,247,0.2)' : 'rgba(255,255,255,0.04)',
                  color: selectedPaper.id === p.id ? '#7aaeff' : '#777',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {selectedPaper.id === p.id && <Check size={10} weight="bold" />}
                  {p.name}
                </button>
              ))}
            </div>
            {/* Canvas */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px 12px', overflow: 'hidden' }}>
              <div style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)', background: '#fff', display: 'inline-flex' }}>
                <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', height: 'auto', maxHeight: '100%' }} />
              </div>
            </div>
            {/* Status */}
            <div style={{
              padding: '6px 14px', flexShrink: 0,
              background: fitsAll ? 'rgba(46,111,247,0.12)' : 'rgba(255,85,85,0.12)',
              borderTop: `1px solid ${fitsAll ? 'rgba(46,111,247,0.3)' : 'rgba(255,85,85,0.3)'}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: fitsAll ? '#2e6ff7' : '#ff5555', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: fitsAll ? '#7aaeff' : '#ff8888', fontWeight: 500 }}>{status}</span>
            </div>
          </div>

          {/* BOTTOM: CONTROLS (Scrollable) */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden',
            padding: '12px', gap: 16, background: '#111'
          }}>
            
            {/* Quantities Section */}
            <div>
              <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Photo Quantities</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allItems.map(item => (
                  <div key={item.id} style={{ background: '#1a1a1a', borderRadius: 14, border: '1px solid #2a2a2a', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#202020', borderBottom: '1px solid #2a2a2a' }}>
                      <div style={{ width: 36, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid #333', flexShrink: 0 }}>
                        <img src={item.img.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>Tap — / + to set quantity</div>
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Object.entries(PHOTO_SIZES).map(([key, size]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#252525', padding: '8px 12px', borderRadius: 10, border: (itemCounts[item.id]?.[key] || 0) > 0 ? '1px solid rgba(46,111,247,0.4)' : '1px solid #2a2a2a' }}>
                          <div>
                            <div style={{ fontSize: 11, color: '#ddd', fontWeight: 600 }}>{size.name}</div>
                            <div style={{ fontSize: 8, color: '#555', marginTop: 1 }}>{size.label}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <button onClick={() => setItemCounts(prev => ({ ...prev, [item.id]: { ...prev[item.id], [key]: Math.max(0, (prev[item.id]?.[key] || 0) - 1) } }))}
                              style={{ width: 32, height: 32, background: '#333', border: 'none', color: '#fff', borderRadius: '8px 0 0 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>
                              <Minus size={13} weight="bold" />
                            </button>
                            <div style={{ width: 36, height: 32, background: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: (itemCounts[item.id]?.[key] || 0) > 0 ? '#2e6ff7' : '#444' }}>
                              {itemCounts[item.id]?.[key] || 0}
                            </div>
                            <button onClick={() => setItemCounts(prev => ({ ...prev, [item.id]: { ...prev[item.id], [key]: (prev[item.id]?.[key] || 0) + 1 } }))}
                              style={{ width: 32, height: 32, background: '#2e6ff7', border: 'none', color: '#fff', borderRadius: '0 8px 8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>
                              <Plus size={13} weight="bold" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {allItems.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: '20px 0' }}>No photos loaded.</div>
                )}
              </div>
            </div>

            {/* Layout Settings Section */}
            <div>
              <div style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Layout Spacing</div>
              <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '12px', border: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Margin', value: margin, set: setMargin, min: 0, max: 200 },
                  { label: 'Spacing', value: gap, set: setGap, min: 0, max: 100 },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontSize: 11, color: '#2e6ff7', fontWeight: 700 }}>{s.value}px</span>
                    </div>
                    <input type="range" min={s.min} max={s.max} value={s.value} onChange={e => s.set(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#2e6ff7' }} />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer: Export Button ── */}
        <div style={{
          padding: '10px 14px', flexShrink: 0,
          background: 'linear-gradient(0deg, #0d0d0d 0%, transparent 100%)',
          borderTop: '1px solid #1e1e1e',
        }}>
          <button onClick={doExport}
            disabled={!fitsAll || Object.values(itemCounts).every(v => v.pp === 0 && v.st === 0 && v.fourR === 0)}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: fitsAll ? 'linear-gradient(135deg, #2e6ff7 0%, #1a4fd8 100%)' : '#222',
              color: fitsAll ? '#fff' : '#444', fontWeight: 800, fontSize: 14, letterSpacing: '0.5px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: fitsAll ? '0 4px 20px rgba(46,111,247,0.4)' : 'none',
              transition: 'all 0.2s', touchAction: 'manipulation',
            }}>
            <DownloadSimple size={18} weight="bold" />
            EXPORT TO PRINT
          </button>
        </div>

        {/* Desktop layout (hidden on mobile via CSS) */}
        <div className="uni-desktop-body" style={{ display: 'none' }}>
          {/* ... desktop layout intact ... */}
        </div>

      </div>
    </div>
  );
}
