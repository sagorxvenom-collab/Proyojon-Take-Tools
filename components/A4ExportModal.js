"use client";
import React, { useState, useEffect, useRef } from "react";

// A4 sheet @ 300 DPI = 2480x3508px
const A4_W = 2480, A4_H = 3508;
const PP_W = 472,   PP_H = 591; 
const ST_W = 236,   ST_H = 295;

export default function A4ExportModal({ activeImage, activeBgColor, queue, onClose }) {
  const [itemCounts, setItemCounts] = useState(() => {
    const initial = {};
    queue.forEach(item => {
      initial[item.id] = { pp: 0, st: 0 };
    });
    if (activeImage && !queue.find(a => a.img === activeImage)) {
        initial['active'] = { pp: 12, st: 0 }; 
    }
    return initial;
  });
  
  const [status, setStatus] = useState("");
  const [fitsAll, setFitsAll] = useState(true);
  const canvasRef = useRef(null);

  const allItems = [...queue];
  if (activeImage && !queue.find(a => a.img === activeImage)) {
      allItems.unshift({ id: 'active', img: activeImage, name: 'Current Work', bgColor: activeBgColor });
  }

  useEffect(() => {
    drawLayout();
  }, [itemCounts]);

  const resizeImage = (sourceImg, targetW, targetH, bgColor) => {
    const canvas = document.createElement("canvas");
    canvas.width = targetW; canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    
    ctx.fillStyle = bgColor && bgColor !== "transparent" ? bgColor : "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    
    const sRatio = sourceImg.width / sourceImg.height;
    const tRatio = targetW / targetH;
    let w = sourceImg.width, h = sourceImg.height, sx = 0, sy = 0;
    if (tRatio > sRatio) { h = w / tRatio; sy = (sourceImg.height - h) / 2; }
    else { w = h * tRatio; sx = (sourceImg.width - w) / 2; }
    ctx.drawImage(sourceImg, sx, sy, w, h, 0, 0, targetW, targetH);
    return canvas;
  };

  const calculateLayout = () => {
    const W = A4_W, H = A4_H;
    const mx = 80, my = 80; 
    const gap = 40;        
    
    let placements = [];
    let isFit = true;

    const ppItems = [];
    const stItems = [];

    allItems.forEach(item => {
        const counts = itemCounts[item.id] || { pp: 0, st: 0 };
        for (let i = 0; i < (counts.pp || 0); i++) ppItems.push(item);
        for (let i = 0; i < (counts.st || 0); i++) stItems.push(item);
    });

    let currX = mx;
    let currY = my;
    let rowMaxH = 0;

    // Place PP Items
    ppItems.forEach(item => {
        if (currX + PP_W > W - mx) {
            currX = mx;
            currY += rowMaxH + gap;
            rowMaxH = 0;
        }
        if (currY + PP_H > H - my) isFit = false;
        placements.push({ x: currX, y: currY, w: PP_W, h: PP_H, type: "pp", asset: item });
        rowMaxH = Math.max(rowMaxH, PP_H);
        currX += PP_W + gap;
    });

    // Place ST Items
    stItems.forEach(item => {
        if (currX + ST_W > W - mx) {
            currX = mx;
            currY += rowMaxH + gap;
            rowMaxH = 0;
        }
        if (currY + ST_H > H - my) isFit = false;
        placements.push({ x: currX, y: currY, w: ST_W, h: ST_H, type: "st", asset: item });
        rowMaxH = Math.max(rowMaxH, ST_H);
        currX += ST_W + gap;
    });

    setFitsAll(isFit);
    const total = ppItems.length + stItems.length;
    setStatus(isFit ? `Ready: ${total} photos arranged on A4.` : "Warning: Photos overflow A4 page!");
    return placements;
  };

  const drawLayout = () => {
    if (!canvasRef.current || allItems.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const S = canvas.width / A4_W;
    const placements = calculateLayout();
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cache = {};
    placements.forEach(p => {
        const key = `${p.asset.id}_${p.type}`;
        if (!cache[key]) {
            const pw = Math.round(p.w * S), ph = Math.round(p.h * S);
            const raw = resizeImage(p.asset.img, pw, ph, p.asset.bgColor);
            const wrap = document.createElement("canvas");
            wrap.width = pw; wrap.height = ph;
            const wCtx = wrap.getContext("2d");
            wCtx.drawImage(raw, 0, 0);
            wCtx.strokeStyle = "rgba(0,0,0,0.1)"; wCtx.lineWidth = 0.5; wCtx.strokeRect(0, 0, pw, ph);
            cache[key] = wrap;
        }
        ctx.drawImage(cache[key], Math.round(p.x * S), Math.round(p.y * S));
    });
  };

  const doExport = () => {
    const canvas = document.createElement("canvas");
    canvas.width = A4_W; canvas.height = A4_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, A4_W, A4_H);
    const placements = calculateLayout();
    const cache = {};
    placements.forEach(p => {
        const key = `${p.asset.id}_${p.type}`;
        if (!cache[key]) {
            const raw = resizeImage(p.asset.img, p.w, p.h, p.asset.bgColor);
            const wrap = document.createElement("canvas");
            wrap.width = p.w; wrap.height = p.h;
            const wCtx = wrap.getContext("2d");
            wCtx.drawImage(raw, 0, 0);
            wCtx.strokeStyle = "#eee"; wCtx.lineWidth = 1; wCtx.strokeRect(0, 0, p.w, p.h);
            cache[key] = wrap;
        }
        ctx.drawImage(cache[key], p.x, p.y);
    });
    const link = document.createElement("a");
    link.download = `A4_Print_Sheet_${Date.now()}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{width: '95%', maxWidth: '1200px', height: '90vh'}}>
        <div className="modal-header">
           <span>A4 Professional Sheet Builder (Full Custom)</span>
           <span onClick={onClose} style={{cursor:'pointer'}}>✕</span>
        </div>
        
        <div className="modal-body" style={{flex: 1, overflow: 'hidden'}}>
            <div style={{width: 320, backgroundColor: '#323232', borderRight: '1px solid #222', padding: 15, display: 'flex', flexDirection: 'column', overflowY: 'auto'}}>
                <div className="ps-section-header first">Configure A4 Quantities</div>
                
                {allItems.map(item => (
                    <div key={item.id} style={{marginBottom: 15, padding: 10, background: '#222', borderRadius: 6, border: '1px solid #444'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10}}>
                            <img src={item.img.src} style={{width: 25, height: 30, objectFit: 'cover'}} />
                            <span style={{fontSize: 10, color: '#eee'}}>{item.name}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label style={{fontSize: 9, color: '#888'}}>Passport</label>
                                <input type="number" value={itemCounts[item.id]?.pp || 0} 
                                    onChange={e => setItemCounts(prev => ({...prev, [item.id]: {...prev[item.id], pp: parseInt(e.target.value) || 0}}))} 
                                    className="ps-input" style={{width: '100%', textAlign: 'left', background: '#333'}} />
                            </div>
                            <div>
                                <label style={{fontSize: 9, color: '#888'}}>Stamp</label>
                                <input type="number" value={itemCounts[item.id]?.st || 0} 
                                    onChange={e => setItemCounts(prev => ({...prev, [item.id]: {...prev[item.id], st: parseInt(e.target.value) || 0}}))} 
                                    className="ps-input" style={{width: '100%', textAlign: 'left', background: '#333'}} />
                            </div>
                        </div>
                    </div>
                ))}

                <div style={{fontSize: 11, padding: '10px', backgroundColor: '#2b2b2b', border: '1px solid #222', marginTop: 'auto', color: fitsAll ? '#2e6ff7' : '#ffa4a4'}}>
                   {status}
                </div>

                <div style={{marginTop: '15px', display: 'flex', gap: 10}}>
                   <button className="ps-btn-gray" style={{flex: 1}} onClick={onClose}>Cancel</button>
                   <button className="ps-btn-gray ps-btn-blue" style={{flex: 1}} disabled={!fitsAll || Object.values(itemCounts).every(v => v.pp===0 && v.st===0)} onClick={doExport}>Export A4</button>
                </div>
            </div>

            <div style={{flex: 1, backgroundColor: '#1e1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 20}}>
                <div style={{
                    height: '100%', aspectRatio: '2480/3508', background: 'white', 
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative'
                }}>
                   <canvas ref={canvasRef} width={400} height={565} style={{width: '100%', height: '100%'}} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
