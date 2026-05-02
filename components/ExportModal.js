"use client";
import React, { useState, useEffect, useRef } from "react";

// DNP 6x4" sheet @ 300 DPI = 1800x1200px
// Passport 1.5x1.8" @ 300dpi = 450x540px (Standard BD Studio Size)
// Stamp    0.8x1.0" @ 300dpi = 240x300px
const DNP_W = 1800, DNP_H = 1200;
const PP_W = 450,   PP_H = 540; 
const ST_W = 240,   ST_H = 300;
const FR_W = 1800,  FR_H = 1200; 

export default function ExportModal({ activeImage, activeBgColor, queue, onClose }) {
  // itemCounts: { [assetId]: { pp: number, st: number } }
  const [itemCounts, setItemCounts] = useState(() => {
    const initial = {};
    queue.forEach(item => {
      initial[item.id] = { pp: 0, st: 0, fr: 0 };
    });
    // Add current active image if not in queue
    if (activeImage && !queue.find(a => a.img === activeImage)) {
        initial['active'] = { pp: 4, st: 0, fr: 0 }; 
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

  const resizeImage = (sourceImg, targetW, targetH, bgColor, forceRotate = false) => {
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
    
    // Auto-Rotate: If source is portrait and target is landscape (or forced)
    const isSourcePortrait = sourceImg.height > sourceImg.width;
    const isTargetLandscape = targetW > targetH;

    // Detect 4R aspect ratio (1.5 or 0.66) to trigger auto-rotation
    const is4RRatio = Math.abs((targetW / targetH) - (DNP_W / DNP_H)) < 0.01;

    if (forceRotate || (isSourcePortrait && isTargetLandscape && is4RRatio)) {
        ctx.save();
        ctx.translate(targetW / 2, targetH / 2);
        ctx.rotate(Math.PI / 2);
        
        const sRatio = sourceImg.width / sourceImg.height;
        const tRatio = targetH / targetW; // Swapped aspect ratio for rotated space
        
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
        // In rotated space, we draw the image with swapped width/height
        ctx.drawImage(sourceImg, sx, sy, w, h, -targetH / 2, -targetW / 2, targetH, targetW);
        ctx.restore();
    } else {
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
    }
    return canvas;
  };


  const calculateLayout = () => {
    const W = DNP_W, H = DNP_H;
    const mx = 20, my = 20; // Margins
    const gap = 30;        // Gap between photos
    
    let placements = [];
    let isFit = true;

    // Collect all requested photos
    const frItems = [];
    const ppItems = [];
    const stItems = [];

    allItems.forEach(item => {
        const counts = itemCounts[item.id] || { pp: 0, st: 0, fr: 0 };
        for (let i = 0; i < (counts.fr || 0); i++) frItems.push(item);
        for (let i = 0; i < (counts.pp || 0); i++) ppItems.push(item);
        for (let i = 0; i < (counts.st || 0); i++) stItems.push(item);
    });

    let currentFrIndex = 0;
    let currentPpIndex = 0;
    let currentStIndex = 0;

    // --- Phase 0: 4R Full Sheet ---
    if (frItems.length > 0) {
        placements.push({ x: 0, y: 0, w: DNP_W, h: DNP_H, type: "fr", asset: frItems[0] });
        currentFrIndex++;
        if (frItems.length > 1 || ppItems.length > 0 || stItems.length > 0) isFit = false;
    } else {
        // --- Phase 1: PP Area ---
        const pp_grid_cols = 3;
        const pp_grid_rows = 2; 

        for (let row = 0; row < pp_grid_rows; row++) {
            for (let col = 0; col < pp_grid_cols; col++) {
                const slot_x = col * (PP_W + gap);
                const slot_y = row * (PP_H + gap);

                if (currentPpIndex < ppItems.length) {
                    placements.push({ x: slot_x, y: slot_y, w: PP_W, h: PP_H, type: "pp", asset: ppItems[currentPpIndex] });
                    currentPpIndex++;
                } else if (currentStIndex < stItems.length) {
                    // Fill remaining PP slots with rotated ST stamps (2 per slot)
                    const st_land_w = ST_H; // 300
                    const st_land_h = ST_W; // 240
                    const st_gap = gap; 
                    const total_h = st_land_h * 2 + st_gap; 
                    
                    const start_x = slot_x + (PP_W - st_land_w) / 2;
                    const start_y = slot_y + (PP_H - total_h) / 2;

                    // First stamp in slot
                    placements.push({ x: start_x, y: start_y, w: st_land_w, h: st_land_h, type: "st", asset: stItems[currentStIndex], rotate: true });
                    currentStIndex++;

                    // Second stamp in same slot (if available)
                    if (currentStIndex < stItems.length) {
                        placements.push({ x: start_x, y: start_y + st_land_h + st_gap, w: st_land_w, h: st_land_h, type: "st", asset: stItems[currentStIndex], rotate: true });
                        currentStIndex++;
                    }
                }
            }
        }

        // --- Phase 2: ST Column ---
        let right_col_base_x = (pp_grid_cols * (PP_W + gap)); 
        let right_col_current_y = 0; 

        while (currentStIndex < stItems.length) {
            placements.push({ x: right_col_base_x, y: right_col_current_y, w: ST_W, h: ST_H, type: "st", asset: stItems[currentStIndex] });
            right_col_current_y += (ST_H + gap);
            currentStIndex++;
        }
    }

    if (placements.length === 0) {
        setStatus("No photos selected.");
        setFitsAll(true);
        return [];
    }

    // Centering
    if (placements[0].type === "fr") {
        setFitsAll(isFit);
        setStatus(isFit ? "Ready: 4R Full Sheet Layout." : "Warning: Overlap! One 4R per sheet only.");
        return placements;
    }

    const minX = Math.min(...placements.map(p => p.x));
    const minY = Math.min(...placements.map(p => p.y));
    const maxX = Math.max(...placements.map(p => p.x + p.w));
    const maxY = Math.max(...placements.map(p => p.y + p.h));
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const offsetX = (W - contentWidth) / 2 - minX;
    const offsetY = (H - contentHeight) / 2 - minY;

    const finalPlacements = placements.map(p => {
        const final_x = p.x + offsetX;
        const final_y = p.y + offsetY;
        if (final_x < mx || final_x + p.w > W - mx || final_y < my || final_y + p.h > H - my) isFit = false;
        return { ...p, x: final_x, y: final_y };
    });

    setFitsAll(isFit);
    const totalPlaced = currentPpIndex + currentStIndex + currentFrIndex;
    setStatus(isFit ? `Ready: ${totalPlaced} photos arranged.` : "Warning: Overflows 6x4 paper size.");
    return finalPlacements;
  };

  const drawLayout = () => {
    if (!canvasRef.current || allItems.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const S = canvas.width / DNP_W;
    const placements = calculateLayout();
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cache = {};
    placements.forEach(p => {
        const key = `${p.asset.id}_${p.type}_${p.rotate ? 'r' : 'n'}`;
        if (!cache[key]) {
            const previewW = Math.round(p.w * S);
            const previewH = Math.round(p.h * S);
            const raw = resizeImage(p.asset.img, previewW, previewH, p.asset.bgColor, p.rotate);
            const borderPX = p.type === 'fr' ? 0 : 1;
            const wrap = document.createElement("canvas");
            wrap.width = previewW; wrap.height = previewH;
            const wCtx = wrap.getContext("2d");
            wCtx.fillStyle = "white"; wCtx.fillRect(0, 0, previewW, previewH);
            wCtx.drawImage(raw, borderPX, borderPX, previewW - 2*borderPX, previewH - 2*borderPX);
            if (p.type !== 'fr') {
                wCtx.strokeStyle = "rgba(180,180,180,0.8)"; wCtx.lineWidth = 0.5; wCtx.strokeRect(0, 0, previewW, previewH);
            }
            cache[key] = wrap;
        }
        ctx.drawImage(cache[key], Math.round(p.x * S), Math.round(p.y * S));
    });

    if (placements.length > 0 && placements[0].type !== 'fr') {
        ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 0.5;
        const xs = new Set(); const ys = new Set();
        placements.forEach(p => { xs.add(Math.round(p.x*S)); xs.add(Math.round((p.x+p.w)*S)); ys.add(Math.round(p.y*S)); ys.add(Math.round((p.y+p.h)*S)); });
        xs.forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); });
        ys.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); });
        ctx.setLineDash([]);
    }
  };

  const doExport = () => {
    const canvas = document.createElement("canvas");
    canvas.width = DNP_W; canvas.height = DNP_H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, DNP_W, DNP_H);
    const placements = calculateLayout();
    const cache = {};
    placements.forEach(p => {
        const key = `${p.asset.id}_${p.type}_${p.rotate ? 'r' : 'n'}`;
        if (!cache[key]) {
            const raw = resizeImage(p.asset.img, p.w, p.h, p.asset.bgColor, p.rotate);
            const borderPX = p.type === 'fr' ? 0 : (p.type === 'pp' ? 3 : 2);
            const wrap = document.createElement("canvas");
            wrap.width = p.w; wrap.height = p.h;
            const wCtx = wrap.getContext("2d");
            wCtx.fillStyle = "white"; wCtx.fillRect(0, 0, p.w, p.h);
            wCtx.drawImage(raw, borderPX, borderPX, p.w - 2*borderPX, p.h - 2*borderPX);
            if (p.type !== 'fr') {
                wCtx.strokeStyle = "rgba(200,200,200,0.8)"; wCtx.lineWidth = 0.5; wCtx.strokeRect(0, 0, p.w, p.h);
            }
            cache[key] = wrap;
        }
        ctx.drawImage(cache[key], p.x, p.y);
    });
    const link = document.createElement("a");
    link.download = `DNP-SAGOR STUDIO -MOB 01734771154- ${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{width: '95%', maxWidth: '1100px'}}>
        <div className="modal-header">
           <span>DNP Professional Layout Builder (6x4 inch)</span>
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
                                <span>4R Full (6x4)</span> <span>{itemCounts[item.id]?.fr || 0}</span>
                            </div>
                            <input type="range" min="0" max="1" value={itemCounts[item.id]?.fr || 0} 
                                onChange={e => setItemCounts(prev => ({...prev, [item.id]: {...prev[item.id], fr: parseInt(e.target.value)}}))} 
                                style={{width: '100%'}} />

                            <div className="flex justify-between items-center text-[10px] text-gray-400 mt-2">
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
                   <button className="ps-btn-gray ps-btn-blue" style={{flex: 1}} disabled={!fitsAll || Object.values(itemCounts).every(v => v.pp===0 && v.st===0 && v.fr===0)} onClick={doExport}>Export DNP</button>
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
