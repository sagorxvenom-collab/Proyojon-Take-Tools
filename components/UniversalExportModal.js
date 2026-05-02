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
    
    // Scale preview to fit screen (both width and height)
    const container = canvas.parentElement.parentElement;
    const maxW = container.clientWidth - 80;
    const maxH = container.clientHeight - 80;
    
    const scaleW = maxW / W;
    const scaleH = maxH / H;
    const S = Math.min(scaleW, scaleH, 1); // Don't scale up beyond 1:1

    canvas.width = W * S;
    canvas.height = H * S;

    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const placements = calculateLayout();

    // Add Dashed Cut Lines (DNP Style) - Draw BEFORE photos to avoid overlap
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

  useEffect(() => {
    drawLayout();
    window.addEventListener('resize', drawLayout);
    return () => window.removeEventListener('resize', drawLayout);
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
      <div className="modal-content">
        
        {/* Header */}
        <div className="modal-header">
           <div style={{display:'flex', alignItems:'center', gap: 10}}>
             <Printer size={20} color="#2e6ff7" />
             <span style={{fontWeight: 600, fontSize: 14, color: '#fff'}}>Universal Print Layout Builder</span>
           </div>
           <X size={20} onClick={onClose} style={{cursor:'pointer', color: '#888'}} />
        </div>
        
        <div className="modal-body" style={{flex: 1, display: 'flex', background: '#1e1e1e', overflowY: 'auto', flexDirection: 'column'}}>
            
            {/* Left Column: Paper Settings */}
            <div className="universal-settings-column" style={{width: 300, background: '#252525', borderRight: '1px solid #333', padding: 20, display: 'flex', flexDirection: 'column', gap: 20}}>
                <div>
                    <label style={{fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'block'}}>Paper Size Preset</label>
                    <select 
                        value={selectedPaper.id} 
                        onChange={(e) => setSelectedPaper(PAPER_PRESETS.find(p => p.id === e.target.value))}
                        style={{width: '100%', background: '#333', border: '1px solid #444', color: '#fff', padding: '8px', borderRadius: 6, fontSize: 13}}
                    >
                        {PAPER_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                {selectedPaper.id === 'custom' && (
                    <div style={{padding: '15px', background: '#2d2d2d', borderRadius: 8, border: '1px solid #444'}}>
                        <div style={{display: 'flex', gap: 10, marginBottom: 15}}>
                            <button onClick={()=>setUnit('in')} style={{flex: 1, padding: '4px', fontSize: 10, background: unit==='in'?'#2e6ff7':'#333', border: 'none', color: '#fff', borderRadius: 4}}>INCHES</button>
                            <button onClick={()=>setUnit('mm')} style={{flex: 1, padding: '4px', fontSize: 10, background: unit==='mm'?'#2e6ff7':'#333', border: 'none', color: '#fff', borderRadius: 4}}>MM</button>
                        </div>
                        <div style={{display: 'flex', gap: 10}}>
                            <div style={{flex:1}}>
                                <span style={{fontSize: 9, color: '#666'}}>WIDTH</span>
                                <input type="number" value={customW} onChange={e=>setCustomW(parseFloat(e.target.value))} style={{width:'100%', background:'#1a1a1a', border:'1px solid #444', color:'#fff', padding:5, borderRadius:4}} />
                            </div>
                            <div style={{flex:1}}>
                                <span style={{fontSize: 9, color: '#666'}}>HEIGHT</span>
                                <input type="number" value={customH} onChange={e=>setCustomH(parseFloat(e.target.value))} style={{width:'100%', background:'#1a1a1a', border:'1px solid #444', color:'#fff', padding:5, borderRadius:4}} />
                            </div>
                        </div>
                    </div>
                )}

                <div style={{borderTop: '1px solid #333', paddingTop: 20}}>
                    <div className="ps-slider-wrapper">
                        <span style={{fontSize: 11, color: '#aaa', width: 60}}>Margin</span>
                        <input type="range" min="0" max="200" value={margin} onChange={e=>setMargin(parseInt(e.target.value))} style={{flex:1}} />
                    </div>
                    <div className="ps-slider-wrapper">
                        <span style={{fontSize: 11, color: '#aaa', width: 60}}>Spacing</span>
                        <input type="range" min="0" max="100" value={gap} onChange={e=>setGap(parseInt(e.target.value))} style={{flex:1}} />
                    </div>
                </div>

                <div style={{marginTop: 'auto', background: fitsAll ? 'rgba(46,111,247,0.1)' : 'rgba(255,85,85,0.1)', padding: 12, borderRadius: 8, border: `1px solid ${fitsAll?'#2e6ff7':'#ff5555'}`}}>
                    <div style={{fontSize: 10, color: '#888', marginBottom: 4}}>Status & Info</div>
                    <div style={{fontSize: 12, color: fitsAll?'#fff':'#ff8888', fontWeight: 500}}>{status}</div>
                </div>
                
                <button 
                  onClick={doExport} 
                  disabled={!fitsAll || Object.values(itemCounts).every(v => v.pp===0 && v.st===0 && v.fourR===0)}
                  style={{
                    width: '100%', padding: '12px', background: '#2e6ff7', color: '#fff', border: 'none', borderRadius: 8, 
                    fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.2s', opacity: fitsAll ? 1 : 0.5
                  }}
                >
                  EXPORT TO PRINT
                </button>
            </div>

            {/* Middle: Canvas Preview */}
            <div className="universal-preview-panel" style={{flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'hidden'}}>
                <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 30, background: '#252525', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', padding: '0 15px', gap: 10, fontSize: 10, color: '#888'}}>
                    <Layout size={14} /> LIVE PRINT PREVIEW (300 DPI)
                </div>
                <div style={{boxShadow: '0 30px 90px rgba(0,0,0,0.8)', border: '1px solid #111', background: '#fff', maxWidth: '95%', maxHeight: '95%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <canvas ref={canvasRef} style={{display: 'block', maxWidth: '100%', height: 'auto'}} />
                </div>
            </div>

            {/* Right Column: Asset Selection & Quantities */}
            <div className="universal-controls-panel" style={{width: 320, background: '#252525', borderLeft: '1px solid #333', padding: 20, display: 'flex', flexDirection: 'column', gap: 15, overflowY: 'auto'}}>
                <label style={{fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase'}}>Photo Quantities</label>
                
                {allItems.map(item => (
                    <div key={item.id} style={{background: '#1a1a1a', borderRadius: 10, padding: 12, border: '1px solid #333'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15}}>
                            <img src={item.img.src} style={{width: 40, height: 50, objectFit: 'cover', borderRadius: 4, border: '1px solid #444'}} />
                            <div style={{overflow: 'hidden'}}>
                                <div style={{fontSize: 11, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{item.name}</div>
                                <div style={{fontSize: 9, color: '#666'}}>ID: {item.id.toString().slice(-6)}</div>
                            </div>
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                            {Object.entries(PHOTO_SIZES).map(([key, size]) => (
                                <div key={key} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#2a2a2a', padding: '6px 10px', borderRadius: 6}}>
                                    <div style={{lineHeight: 1}}>
                                        <div style={{fontSize: 10, color: '#eee', fontWeight: 600}}>{size.name}</div>
                                        <div style={{fontSize: 8, color: '#666'}}>{size.label}</div>
                                    </div>
                                    <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                                        <button 
                                            onClick={() => setItemCounts(prev => ({...prev, [item.id]: {...prev[item.id], [key]: Math.max(0, (prev[item.id]?.[key]||0) - 1)}}))}
                                            style={{width: 24, height: 24, background: '#333', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            <Minus size={12} weight="bold" />
                                        </button>
                                        <span style={{minWidth: 20, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#2e6ff7'}}>{itemCounts[item.id]?.[key] || 0}</span>
                                        <button 
                                            onClick={() => setItemCounts(prev => ({...prev, [item.id]: {...prev[item.id], [key]: (prev[item.id]?.[key]||0) + 1}}))}
                                            style={{width: 24, height: 24, background: '#333', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                                        >
                                            <Plus size={12} weight="bold" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                
                {allItems.length === 0 && (
                    <div style={{color: '#555', textAlign: 'center', fontSize: 12, marginTop: 40}}>
                        Open or add photos to the queue to see them here.
                    </div>
                )}
            </div>

        </div>
      </div>
      <style jsx>{`
        input[type="range"] {
          accent-color: #2e6ff7;
        }
      `}</style>
    </div>
  );
}
