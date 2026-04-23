"use client";
import React, { useState, useEffect, useRef } from "react";

export default function ExportModal({ activeImage, activeBgColor, queue, onClose }) {
  // itemCounts: { [assetId]: { pp: number, st: number } }
  const [itemCounts, setItemCounts] = useState(() => {
    const initial = {};
    queue.forEach(item => {
      initial[item.id] = { pp: 0, st: 0 };
    });
    // Add current active image if not in queue
    if (activeImage && !queue.find(a => a.img === activeImage)) {
        initial['active'] = { pp: 4, st: 0 }; 
    }
    return initial;
  });
  
  const [status, setStatus] = useState("");
  const [fitsAll, setFitsAll] = useState(true);
  const canvasRef = useRef(null);

  // Combine queue + active for processing
  const allItems = [...queue];
  if (activeImage && !queue.find(a => a.img === activeImage)) {
      allItems.unshift({ id: 'active', img: activeImage, name: 'Current Work', bgColor: activeBgColor });
  }

  useEffect(() => {
    drawLayout();
  }, [itemCounts]);

  const resizeImage = (sourceImg, targetW, targetH, bgColor) => {
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    
    if (bgColor && bgColor !== "transparent") {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, targetW, targetH);
    } else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
    }
    
    const sRatio = sourceImg.width / sourceImg.height;
    const tRatio = targetW / targetH;
    
    let w = sourceImg.width;
    let h = sourceImg.height;
    let sx = 0, sy = 0;
    
    if (tRatio > sRatio) {
      h = w / tRatio;
      sy = (sourceImg.height - h) / 2;
    } else {
      w = h * tRatio;
      sx = (sourceImg.width - w) / 2;
    }
    
    ctx.drawImage(sourceImg, sx, sy, w, h, 0, 0, targetW, targetH);
    return canvas;
  };

  // DNP 6x4" sheet @ 300 DPI = 1800x1200px
  // Passport 1.5x1.8" @ 300dpi = 450x540px (Standard BD Studio Size)
  // Stamp    0.8x1.0" @ 300dpi = 240x300px
  const DNP_W = 1800, DNP_H = 1200;
  const PP_W = 450,   PP_H = 540; 
  const ST_W = 240,   ST_H = 300;

  const calculateLayout = () => {
    const W = DNP_W, H = DNP_H;
    const mx = 20, my = 20; // Margins
    const gap = 30;        // Gap between photos
    
    let placements = [];
    let isFit = true;

    // Collect all requested photos
    const ppItems = [];
    const stItems = [];

    allItems.forEach(item => {
        const counts = itemCounts[item.id] || { pp: 0, st: 0 };
        for (let i = 0; i < counts.pp; i++) ppItems.push(item);
        for (let i = 0; i < counts.st; i++) stItems.push(item);
    });

    let currentPpIndex = 0;
    let currentStIndex = 0;

    const pp_grid_cols = 3;
    const pp_grid_rows = 2; // Fixed 2 rows for passport area
    const max_pp_area_slots = pp_grid_cols * pp_grid_rows;

    // --- Phase 1: Fill the main 3x2 area (passport slots) ---
    // This will contain a mix of PP and ST photos
    for (let row = 0; row < pp_grid_rows; row++) {
        for (let col = 0; col < pp_grid_cols; col++) {
            // Base position for a passport slot, relative to top-left of the layout area
            const slot_x = col * (PP_W + gap);
            const slot_y = row * (PP_H + gap);

            if (currentPpIndex < ppItems.length) {
                // Place a passport photo
                placements.push({ x: slot_x, y: slot_y, w: PP_W, h: PP_H, type: "pp", asset: ppItems[currentPpIndex] });
                currentPpIndex++;
            } else if (currentStIndex < stItems.length) {
                // Place a stamp photo in the empty passport slot, centered within it
                const x_centered = slot_x + (PP_W - ST_W) / 2;
                const y_centered = slot_y + (PP_H - ST_H) / 2;
                placements.push({ x: x_centered, y: y_centered, w: ST_W, h: ST_H, type: "st", asset: stItems[currentStIndex] });
                currentStIndex++;
            }
        }
    }

    // --- Phase 2: Place any remaining stamp photos in a dedicated right column ---
    // Calculate the starting X for this right column.
    // It should be after the main 3x2 area, plus a gap.
    let right_col_base_x = (pp_grid_cols * (PP_W + gap)); // This is relative to the start of the layout area
    let right_col_current_y = 0; // Relative to the start of the layout area

    while (currentStIndex < stItems.length) {
        const x = right_col_base_x;
        const y = right_col_current_y;

        placements.push({ x: x, y: y, w: ST_W, h: ST_H, type: "st", asset: stItems[currentStIndex] });
        right_col_current_y += (ST_H + gap);
        currentStIndex++;
    }

    // --- Phase 3: Adjust for overall centering and margin ---
    if (placements.length === 0) {
        setStatus("No photos selected.");
        setFitsAll(true);
        return [];
    }

    // Find the min/max coordinates to determine the effective content size
    const minX = Math.min(...placements.map(p => p.x));
    const minY = Math.min(...placements.map(p => p.y));
    const maxX = Math.max(...placements.map(p => p.x + p.w));
    const maxY = Math.max(...placements.map(p => p.y + p.h));

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate offsets to center the entire content block within the DNP_W x DNP_H area, also accounting for initial margins
    const offsetX = (W - contentWidth) / 2 - minX;
    const offsetY = (H - contentHeight) / 2 - minY;

    const finalPlacements = placements.map(p => {
        const final_x = p.x + offsetX;
        const final_y = p.y + offsetY;
        
        // Check if individual item fits within the DNP sheet after centering
        if (final_x < mx || final_x + p.w > W - mx || final_y < my || final_y + p.h > H - my) { // Check against margins
            isFit = false;
        }
        return { ...p, x: final_x, y: final_y };
    });

    setFitsAll(isFit);
    const totalPlaced = currentPpIndex + (currentStIndex); // Total items placed
    setStatus(isFit ? `Ready: ${totalPlaced} photos arranged.` : "Warning: Overflows 6x4 paper size.");
    return finalPlacements;
  };

  const drawLayout = () => {
    if (!canvasRef.current || allItems.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Scale factor: preview canvas width vs actual DNP width
    const S = canvas.width / DNP_W;

    const placements = calculateLayout();
    
    // Draw background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Asset caching (use small preview-sized cells for performance)
    const cache = {};

    placements.forEach(p => {
        const key = `${p.asset.id}_${p.type}`;
        if (!cache[key]) {
            // Preview at scaled-down size for speed
            const previewW = Math.round(p.w * S);
            const previewH = Math.round(p.h * S);
            const raw = resizeImage(p.asset.img, previewW, previewH, p.asset.bgColor);
            
            // Sync border logic with export (scaled down)
            // Export uses 3px for PP, 2px for ST. At 0.35 scale, that's ~1px.
            const borderPX = p.type === 'pp' ? 1 : 1;
            
            const wrap = document.createElement("canvas");
            wrap.width = previewW; wrap.height = previewH;
            const wCtx = wrap.getContext("2d");
            wCtx.imageSmoothingEnabled = true;
            wCtx.imageSmoothingQuality = "high";
            
            wCtx.fillStyle = "white"; 
            wCtx.fillRect(0, 0, previewW, previewH);
            
            wCtx.drawImage(raw, borderPX, borderPX, previewW - 2*borderPX, previewH - 2*borderPX);
            
            // Use same subtle stroke as export for accuracy
            wCtx.strokeStyle = "rgba(180,180,180,0.8)"; 
            wCtx.lineWidth = 0.5; 
            wCtx.strokeRect(0, 0, previewW, previewH);
            
            cache[key] = wrap;
        }
        ctx.drawImage(cache[key], Math.round(p.x * S), Math.round(p.y * S));
    });

    // Subtler cut-guide lines or remove if confusing, but keeping them very light
    ctx.setLineDash([2, 4]); 
    ctx.strokeStyle = "rgba(0,0,0,0.08)"; 
    ctx.lineWidth = 0.5;
    const xs = new Set(); const ys = new Set();
    placements.forEach(p => { 
        xs.add(Math.round(p.x*S)); 
        xs.add(Math.round((p.x+p.w)*S)); 
        ys.add(Math.round(p.y*S)); 
        ys.add(Math.round((p.y+p.h)*S)); 
    });
    xs.forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); });
    ys.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); });
    ctx.setLineDash([]);
  };

  const doExport = () => {
    const canvas = document.createElement("canvas");
    canvas.width = DNP_W; canvas.height = DNP_H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, DNP_W, DNP_H);

    const placements = calculateLayout();
    const cache = {};

    placements.forEach(p => {
        const key = `${p.asset.id}_${p.type}`;
        if (!cache[key]) {
            // Draw the photo at full cell resolution for HD output
            const raw = resizeImage(p.asset.img, p.w, p.h, p.asset.bgColor);
            // Thin white border (3px for passport, 2px for stamp) — cut guide
            const borderPX = p.type === 'pp' ? 3 : 2;
            const wrap = document.createElement("canvas");
            wrap.width = p.w; wrap.height = p.h;
            const wCtx = wrap.getContext("2d");
            wCtx.imageSmoothingEnabled = true;
            wCtx.imageSmoothingQuality = "high";
            wCtx.fillStyle = "white"; wCtx.fillRect(0, 0, p.w, p.h);
            wCtx.drawImage(raw, borderPX, borderPX, p.w - 2*borderPX, p.h - 2*borderPX);
            // Subtle cut-guide line
            wCtx.strokeStyle = "rgba(200,200,200,0.8)"; wCtx.lineWidth = 0.5; wCtx.strokeRect(0, 0, p.w, p.h);
            cache[key] = wrap;
        }
        ctx.drawImage(cache[key], p.x, p.y);
    });

    // Export as lossless PNG (1800x1200 @ 300dpi, no quality loss)
    const link = document.createElement("a");
    link.download = `DNP_Studio_${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{width: '95%', maxWidth: '1100px'}}>
        <div className="modal-header">
           <span>DNP Multi-Person Layout Builder (6x4 inch)</span>
           <span onClick={onClose} style={{cursor:'pointer'}}>✕</span>
        </div>
        
        <div className="modal-body" style={{height: '600px'}}>
            <div style={{width: 320, backgroundColor: '#323232', borderRight: '1px solid #222', padding: 15, display: 'flex', flexDirection: 'column', overflowY: 'auto'}}>
                <div className="ps-section-header first">Configure Quantities</div>
                
                {allItems.map(item => (
                    <div key={item.id} style={{marginBottom: 20, padding: 10, background: '#222', borderRadius: 6, border: '1px solid #444'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10}}>
                            <img src={item.img.src} style={{width: 30, height: 36, objectFit: 'cover', borderRadius: 2}} />
                            <span style={{fontSize: 11, color: '#eee', fontWeight: 600}}>{item.name}</span>
                        </div>
                        
                        <div style={{display: 'flex', flexDirection: 'column', gap: 5}}>
                            <div className="flex justify-between items-center text-[10px] text-gray-400">
                                <span>Passport</span> <span>{itemCounts[item.id]?.pp || 0}</span>
                            </div>
                            <input type="range" min="0" max="12" value={itemCounts[item.id]?.pp || 0} 
                                onChange={e => setItemCounts(prev => ({...prev, [item.id]: {...prev[item.id], pp: parseInt(e.target.value)}}))} 
                                style={{width: '100%'}} />
                            
                            <div className="flex justify-between items-center text-[10px] text-gray-400 mt-2">
                                <span>Stamp</span> <span>{itemCounts[item.id]?.st || 0}</span>
                            </div>
                            <input type="range" min="0" max="20" value={itemCounts[item.id]?.st || 0} 
                                onChange={e => setItemCounts(prev => ({...prev, [item.id]: {...prev[item.id], st: parseInt(e.target.value)}}))} 
                                style={{width: '100%'}} />
                        </div>
                    </div>
                ))}

                <div style={{fontSize: 11, padding: '10px', backgroundColor: '#2b2b2b', border: '1px solid #222', marginTop: '10px', color: fitsAll ? '#2e6ff7' : '#ffa4a4'}}>
                   {status}
                </div>

                <div style={{marginTop: '20px', display: 'flex', gap: 10}}>
                   <button className="ps-btn-gray" style={{flex: 1}} onClick={onClose}>Cancel</button>
                   <button className="ps-btn-gray ps-btn-blue" style={{flex: 1}} disabled={!fitsAll || Object.values(itemCounts).every(v => v.pp===0 && v.st===0)} onClick={doExport}>Export MIX</button>
                </div>
            </div>

            <div style={{flex: 1, backgroundColor: '#2b2b2b', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
                <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 26, backgroundColor: '#262626', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', paddingLeft: 10}}>
                    <div style={{fontSize: 10, color: '#888'}}>DNP_MIX_PREVIEW.JPG @ 33.3% (RGB/8*)</div>
                </div>
                <div style={{boxShadow: '0 10px 40px rgba(0,0,0,0.6)', border: '1px solid #111'}}>
                   <canvas ref={canvasRef} width={630} height={420} style={{background: "white", display: 'block'}} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
