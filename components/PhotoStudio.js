"use client";
import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowsOutCardinal, Crop as CropIcon, PaintBrush, MagnifyingGlass, Sparkle, 
  ArrowUUpLeft, ArrowUUpRight, DownloadSimple, Printer, ImageSquare, Palette, Eye, LockKey, Desktop, Eraser, Browsers
} from "@phosphor-icons/react";
import ExportModal from "./ExportModal";
import { removeBackground } from "@imgly/background-removal";

// Sizes in logical pixels representing standard printing dimensions at 300dpi
const TEMPLATES = {
  passport: { w: 472, h: 591, label: "Passport", ratio: 472/591 },
  stamp: { w: 236, h: 295, label: "Stamp", ratio: 236/295 }
};

export default function PhotoStudio({ onBackToDashboard }) {
  const [activeTool, setActiveTool] = useState("move");
  const [image, setImage] = useState(null);
  const [imageName, setImageName] = useState("Untitled-1");
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [status, setStatus] = useState("Ready");
  const [printQueue, setPrintQueue] = useState([]);

  // Adjustments
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [skinPolish, setSkinPolish] = useState(0); // 0 to 100
  const [isBW, setIsBW] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [redoStrokes, setRedoStrokes] = useState([]);
  const [brushSize, setBrushSize] = useState(30);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [brushHardness, setBrushHardness] = useState(0);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  
  // Layers
  const [layerVisible, setLayerVisible] = useState(true);
  const [layerOpacity, setLayerOpacity] = useState(100);

  // Viewport
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState(null); 
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Custom Crop Box dimensions for the right panel inputs
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");

  // Crop Box Data: {x, y, width, height, aspect, targetW, targetH}
  const [cropBox, setCropBox] = useState(null); 

  // Scale with Background Feature
  const [showScalePanel, setShowScalePanel] = useState(false);
  const [scalePercent, setScalePercent] = useState(100);
  const [scaleBgColor, setScaleBgColor] = useState("#008cff");
  
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Panel Tabs
  const [activeUpperTab, setActiveUpperTab] = useState("Properties");
  const [activeLowerTab, setActiveLowerTab] = useState("Layers");
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSettings, setMergeSettings] = useState({ orientation: 'vertical', swap: false });

  useEffect(() => {
    const handleResize = () => {
      if (wrapRef.current && canvasRef.current) {
        canvasRef.current.width = wrapRef.current.clientWidth;
        canvasRef.current.height = wrapRef.current.clientHeight;
        drawCanvas();
      }
    };
    handleResize();
    const ro = window.ResizeObserver ? new ResizeObserver(handleResize) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    
    return () => { if (ro) ro.disconnect(); };
  }, []);

  useEffect(() => {
    drawCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, zoom, pan, brightness, contrast, saturation, isBW, cropBox, layerVisible, layerOpacity, strokes, bgColor, cursorPos, skinPolish]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Undo Shortcut: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
         e.preventDefault();
         undo();
      }
      // Redo Shortcut: Ctrl+Y or Cmd+Shift+Z
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
         e.preventDefault();
         redo();
      }

      if (e.key === "Escape" && cropBox) {
        setCropBox(null);
        setActiveTool("move");
      }
      if (e.key === "Enter" && cropBox) {
        applyInteractiveCrop();
      }
      if (e.key === "[") {
        setBrushSize(prev => Math.max(1, prev - 5));
      }
      if (e.key === "]") {
        setBrushSize(prev => Math.min(500, prev + 5));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cropBox, image, history, redoStack, strokes, redoStrokes]);

  const handleOpenClick = () => fileInputRef.current?.click();

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files[0]) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setImage(img);
                setImageName(file.name);
                setHistory([]); setRedoStack([]); setStrokes([]);
                setZoom(0.8); setPan({x:0, y:0});
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
  };

  const saveState = (newImg) => {
    setHistory((prev) => [...prev, newImg || image].slice(-20));
    setRedoStack([]); // Clear redo array when a new independent action occurs
  };

  const undo = () => {
    // If we have active strokes, undo the last stroke first
    if (strokes.length > 0) {
      const lastStroke = strokes[strokes.length - 1];
      setRedoStrokes((prev) => [...prev, lastStroke]);
      setStrokes((prev) => prev.slice(0, -1));
      return;
    }

    if (history.length > 0) {
      setRedoStack((prev) => [...prev, image]);
      const prevImg = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setImage(prevImg); 
      setCropBox(null);
    }
  };

  const redo = () => {
    // If we have redo strokes, redo the last one
    if (redoStrokes.length > 0) {
      const nextStroke = redoStrokes[redoStrokes.length - 1];
      setRedoStrokes((prev) => prev.slice(0, -1));
      setStrokes((prev) => [...prev, nextStroke]);
      return;
    }

    if (redoStack.length > 0) {
      setHistory((prev) => [...prev, image]);
      const nextImg = redoStack[redoStack.length - 1];
      setRedoStack((r) => r.slice(0, -1));
      setImage(nextImg); 
      setCropBox(null);
    }
  };

  const toImageCoords = (ex, ey) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return { x: 0, y: 0 };
    const fitScale = Math.min((canvas.width * 0.9) / image.width, (canvas.height * 0.9) / image.height);
    const scale = fitScale * zoom;
    const xOffset = (canvas.width - image.width * scale) / 2 + pan.x;
    const yOffset = (canvas.height - image.height * scale) / 2 + pan.y;
    return {
      x: (ex - xOffset) / scale,
      y: (ey - yOffset) / scale
    };
  };

  const getCropHandles = (cbx, cby, cbw, cbh, scale, xOffset, yOffset) => {
    const cx = xOffset + cbx * scale;
    const cy = yOffset + cby * scale;
    const cw = cbw * scale;
    const ch = cbh * scale;
    return {
      tl: { x: cx, y: cy }, t:  { x: cx + cw/2, y: cy },
      tr: { x: cx + cw, y: cy }, r:  { x: cx + cw, y: cy + ch/2 },
      br: { x: cx + cw, y: cy + ch }, b:  { x: cx + cw/2, y: cy + ch },
      bl: { x: cx, y: cy + ch }, l:  { x: cx, y: cy + ch/2 }
    };
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!image) return;

    const fitScale = Math.min((canvas.width * 0.9) / image.width, (canvas.height * 0.9) / image.height);
    const scale = fitScale * zoom;

    const imgW = image.width * scale;
    const imgH = image.height * scale;
    
    const xOffset = (canvas.width - imgW) / 2 + pan.x;
    const yOffset = (canvas.height - imgH) / 2 + pan.y;

    // Background Canvas area shadow matching Photoshop
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    ctx.fillRect(xOffset, yOffset, imgW, imgH);
    ctx.shadowColor = "transparent";

    if (bgColor !== "transparent") {
       ctx.fillStyle = bgColor;
       ctx.fillRect(xOffset, yOffset, imgW, imgH);
    }

    if (layerVisible) {
        // Use an offscreen canvas to handle "destination-out" (Eraser) correctly
        const offCanvas = document.createElement("canvas");
        offCanvas.width = imgW; offCanvas.height = imgH;
        const offCtx = offCanvas.getContext("2d");

        let f = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
        if (isBW) f += " grayscale(100%)";
        if (skinPolish > 0) f += ` blur(${skinPolish * 0.03}px)`; // Even subtler blur
        
        offCtx.filter = f;
        offCtx.globalAlpha = layerOpacity / 100;
        offCtx.drawImage(image, 0, 0, imgW, imgH);
        
        // Enhance skin glow if polished
        if (skinPolish > 0) {
            offCtx.globalAlpha = (skinPolish / 300) * (layerOpacity / 100);
            offCtx.filter = `brightness(1.5) blur(${skinPolish * 0.1}px)`;
            offCtx.drawImage(image, 0, 0, imgW, imgH);
        }
        
        offCtx.filter = "none";
        offCtx.globalAlpha = layerOpacity / 100;

        offCtx.lineJoin = "round";
        offCtx.lineCap = "round";
        
        for (const stroke of strokes) {
            offCtx.globalAlpha = stroke.opacity / 100;
            offCtx.lineWidth = stroke.size * scale;
            offCtx.strokeStyle = stroke.color;
            offCtx.globalCompositeOperation = stroke.isEraser ? "destination-out" : "source-over";
            
            if (stroke.hardness < 100) {
                offCtx.shadowBlur = (stroke.size * scale) * (1 - stroke.hardness / 100);
                offCtx.shadowColor = stroke.isEraser ? "rgba(0,0,0,1)" : stroke.color; 
                // Note: shadowBlur with destination-out can be tricky, but this helps softness
            } else {
                offCtx.shadowBlur = 0;
            }

            offCtx.beginPath();
            for (let i = 0; i < stroke.points.length; i++) {
                const px = stroke.points[i].x * scale;
                const py = stroke.points[i].y * scale;
                if (i === 0) offCtx.moveTo(px, py);
                else offCtx.lineTo(px, py);
            }
            if (stroke.points.length === 1) {
                const px = stroke.points[0].x * scale;
                const py = stroke.points[0].y * scale;
                offCtx.lineTo(px + 0.1, py);
            }
            offCtx.stroke();
            offCtx.shadowBlur = 0;
        }
        
        // Draw the composed layer onto main canvas
        ctx.globalAlpha = 1.0;
        ctx.drawImage(offCanvas, xOffset, yOffset);

        // Handle Manual Retouch (Smooth Brush) - Special Compositing
        const retouchStrokes = strokes.filter(s => s.isRetouch);
        if (retouchStrokes.length > 0) {
            const retouchCanvas = document.createElement("canvas");
            retouchCanvas.width = imgW; retouchCanvas.height = imgH;
            const rtCtx = retouchCanvas.getContext("2d");

            // 1. Draw a blurred version of the current image result
            // Use a subtler blur (2.5px) and keep more luminance contrast (Grain-friendly)
            rtCtx.filter = `blur(2.5px) brightness(1.02) contrast(0.98)`;
            rtCtx.drawImage(offCanvas, 0, 0, imgW, imgH);
            rtCtx.filter = "none";

            // 2. Use destination-in to mask it with user strokes
            const maskCanvas = document.createElement("canvas");
            maskCanvas.width = imgW; maskCanvas.height = imgH;
            const mCtx = maskCanvas.getContext("2d");
            mCtx.lineJoin = "round"; mCtx.lineCap = "round";
            
            for (const s of retouchStrokes) {
                mCtx.globalAlpha = s.opacity / 100;
                mCtx.lineWidth = s.size * scale;
                mCtx.strokeStyle = "white"; 
                // Soft edges for mask
                mCtx.shadowBlur = (s.size * scale) * 0.5;
                mCtx.shadowColor = "white";
                mCtx.beginPath();
                for (let i=0; i<s.points.length; i++) {
                    const px = s.points[i].x * scale;
                    const py = s.points[i].y * scale;
                    if (i === 0) mCtx.moveTo(px, py);
                    else mCtx.lineTo(px, py);
                }
                if (s.points.length === 1) mCtx.lineTo(s.points[0].x * scale + 0.1, s.points[0].y * scale);
                mCtx.stroke();
            }

            rtCtx.globalCompositeOperation = "destination-in";
            rtCtx.drawImage(maskCanvas, 0, 0);
            rtCtx.globalCompositeOperation = "source-over";

            // 3. Draw smoothed areas back onto main canvas
            ctx.drawImage(retouchCanvas, xOffset, yOffset);
        }
    }

    // Brush Cursor Preview
    if (!isDragging && (activeTool === "brush" || activeTool === "eraser" || activeTool === "retouch")) {
        ctx.save();
        ctx.beginPath();
        const cursorSize = activeTool === "retouch" ? brushSize * 1.5 : brushSize; // Retouch brush feels bigger due to softness
        ctx.arc(cursorPos.x, cursorPos.y, (cursorSize * scale) / 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, (brushSize * scale) / 2 - 1, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.stroke();
        
        // Crosshair
        ctx.beginPath();
        ctx.moveTo(cursorPos.x - 4, cursorPos.y); ctx.lineTo(cursorPos.x + 4, cursorPos.y);
        ctx.moveTo(cursorPos.x, cursorPos.y - 4); ctx.lineTo(cursorPos.x, cursorPos.y + 4);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.stroke();
        ctx.restore();
    }

    // Draw Advanced Beautiful Crop Box
    if (cropBox) {
      const cx = xOffset + cropBox.x * scale;
      const cy = yOffset + cropBox.y * scale;
      const cw = cropBox.width * scale;
      const ch = cropBox.height * scale;

      ctx.save();
      
      // Dim outer area cleanly
      ctx.fillStyle = "rgba(0,0,0,0.7)"; 
      ctx.fillRect(0, 0, canvas.width, cy); 
      ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch); 
      ctx.fillRect(0, cy, cx, ch); 
      ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch); 

      // Thin solid border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cy, cw, ch);

      // Rule of Thirds Grid (Subtle style)
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.setLineDash([4, 4]);
      ctx.moveTo(cx + cw/3, cy); ctx.lineTo(cx + cw/3, cy + ch);
      ctx.moveTo(cx + 2*cw/3, cy); ctx.lineTo(cx + 2*cw/3, cy + ch);
      ctx.moveTo(cx, cy + ch/3); ctx.lineTo(cx + cw, cy + ch/3);
      ctx.moveTo(cx, cy + 2*ch/3); ctx.lineTo(cx + cw, cy + 2*ch/3);
      ctx.stroke();
      ctx.setLineDash([]);

      // Thick Corner Brackets (Professional Lightroom/Photoshop Aesthetic)
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      const bracketLen = 16;
      ctx.beginPath();
      // TL
      ctx.moveTo(cx, cy + bracketLen); ctx.lineTo(cx, cy); ctx.lineTo(cx + bracketLen, cy);
      // TR
      ctx.moveTo(cx + cw - bracketLen, cy); ctx.lineTo(cx + cw, cy); ctx.lineTo(cx + cw, cy + bracketLen);
      // BL
      ctx.moveTo(cx, cy + ch - bracketLen); ctx.lineTo(cx, cy + ch); ctx.lineTo(cx + bracketLen, cy + ch);
      // BR
      ctx.moveTo(cx + cw - bracketLen, cy + ch); ctx.lineTo(cx + cw, cy + ch); ctx.lineTo(cx + cw, cy + ch - bracketLen);
      ctx.stroke();

      // Drag Handles (minimal)
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      const handles = getCropHandles(cropBox.x, cropBox.y, cropBox.width, cropBox.height, scale, xOffset, yOffset);
      for (const key in handles) {
        const {x, y} = handles[key];
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.strokeRect(x - 3, y - 3, 6, 6);
      }
      ctx.restore();
    }
  };

  const handleOpen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        saveState(img);
        setImage(img);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setBrightness(1.0);
        setContrast(1.0);
        setIsBW(false);
        setCropBox(null);
        setStatus("Ready");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleWheel = (e) => {
    if(!image) return;
    const d = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(Math.max(0.1, z * d), 10));
  };

  const getActionAt = (ex, ey) => {
    if (activeTool === "move") return "pan";
    if (activeTool === "brush") return "brush";
    if (activeTool === "retouch") return "retouch";
    if (activeTool === "eraser") return "eraser";
    if (activeTool === "crop") {
        if (!cropBox) return "cropCreate";
        const canvas = canvasRef.current;
        const fitScale = Math.min((canvas.width * 0.9) / image.width, (canvas.height * 0.9) / image.height);
        const scale = fitScale * zoom;
        const xOffset = (canvas.width - image.width * scale) / 2 + pan.x;
        const yOffset = (canvas.height - image.height * scale) / 2 + pan.y;
        const handles = getCropHandles(cropBox.x, cropBox.y, cropBox.width, cropBox.height, scale, xOffset, yOffset);
        
        for (const key in handles) {
            if (Math.abs(ex - handles[key].x) < 8 && Math.abs(ey - handles[key].y) < 8) return `cropResize_${key}`;
        }
        
        const cx = xOffset + cropBox.x * scale;
        const cy = yOffset + cropBox.y * scale;
        const cw = cropBox.width * scale;
        const ch = cropBox.height * scale;
        if (ex >= cx && ex <= cx + cw && ey >= cy && ey <= cy + ch) return "cropMove";
        return "cropCreate";
    }
    return "pan";
  };

  const handlePointerDown = (e) => {
    if (!image) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ex = e.clientX - rect.left;
    const ey = e.clientY - rect.top;

    if (activeTool === "zoom") {
       setZoom((z) => {
         const factor = e.altKey || e.shiftKey ? 0.8 : 1.25;
         return Math.min(Math.max(0.1, z * factor), 10);
       });
       return;
    }

    setIsDragging(true);
    setDragStart({ x: ex, y: ey });

    const action = (e.button === 2) ? "pan" : getActionAt(ex, ey);
    setDragAction(action);

    if (action === "brush" || action === "eraser" || action === "retouch") {
       const {x, y} = toImageCoords(ex, ey);
       setRedoStrokes([]);
       setStrokes(prev => [...prev, { 
           points: [{x, y}], 
           color: action === "retouch" ? "rgba(255,255,255,0.2)" : brushColor, 
           size: brushSize, 
           opacity: action === "retouch" ? 35 : brushOpacity,
           hardness: action === "retouch" ? 0 : brushHardness,
           isEraser: action === "eraser",
           isRetouch: action === "retouch"
       }]);
    } else if (action === "cropCreate") {
       const {x, y} = toImageCoords(ex, ey);
       setCropBox({ x, y, width: 0, height: 0, aspect: null });
    } else if (action.startsWith("crop")) {
       setDragStart({ x: ex, y: ey, origBox: { ...cropBox } });
    }
  };

  const handlePointerMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const ex = e.clientX - rect.left;
    const ey = e.clientY - rect.top;
    setCursorPos({x: ex, y: ey});

    if (!isDragging && activeTool === "crop" && cropBox) {
        const action = getActionAt(ex, ey);
        if (action.startsWith("cropResize_")) {
            const type = action.split("_")[1];
            if (["tl", "br"].includes(type)) canvasRef.current.style.cursor = "nwse-resize";
            else if (["tr", "bl"].includes(type)) canvasRef.current.style.cursor = "nesw-resize";
            else if (["n", "s", "t", "b"].includes(type)) canvasRef.current.style.cursor = "ns-resize";
            else canvasRef.current.style.cursor = "ew-resize";
        } else if (action === "cropMove") canvasRef.current.style.cursor = "move";
        else canvasRef.current.style.cursor = "crosshair";
    } else if (!isDragging && activeTool === "move") {
        canvasRef.current.style.cursor = "default";
    }

    if (!isDragging || !image || !dragAction) return;

    if (dragAction === "pan") {
      setPan(prev => ({ x: prev.x + (ex - dragStart.x), y: prev.y + (ey - dragStart.y) }));
      setDragStart({ x: ex, y: ey });
    } else if (dragAction === "cropCreate") {
       const current = toImageCoords(ex, ey);
       const start = toImageCoords(dragStart.x, dragStart.y);
       setCropBox({ x: start.x, y: start.y, width: current.x - start.x, height: current.y - start.y, aspect: null });
    } else if (dragAction === "cropMove") {
       const start = toImageCoords(dragStart.x, dragStart.y);
       const current = toImageCoords(ex, ey);
       let newX = dragStart.origBox.x + (current.x - start.x);
       let newY = dragStart.origBox.y + (current.y - start.y);
       if(newX < 0) newX = 0; if(newY < 0) newY = 0;
       if(newX + dragStart.origBox.width > image.width) newX = image.width - dragStart.origBox.width;
       if(newY + dragStart.origBox.height > image.height) newY = image.height - dragStart.origBox.height;
       setCropBox(prev => ({ ...prev, x: newX, y: newY }));
    } else if (dragAction === "brush" || dragAction === "eraser" || dragAction === "retouch") {
       const {x, y} = toImageCoords(ex, ey);
       setStrokes(prev => {
           if (prev.length === 0) return prev;
           const newStrokes = [...prev];
           newStrokes[newStrokes.length - 1].points.push({x, y});
           return newStrokes;
       });
    } else if (dragAction.startsWith("cropResize_")) {
       const type = dragAction.split("_")[1];
       const current = toImageCoords(ex, ey);
       const orig = dragStart.origBox;
       let { x, y, width, height, aspect } = orig;

       if (type.includes("t")) { height = (y + height) - current.y; y = current.y; }
       if (type.includes("b")) { height = current.y - y; }
       if (type.includes("l")) { width = (x + width) - current.x; x = current.x; }
       if (type.includes("r")) { width = current.x - x; }

       if (aspect) {
           if (type === "t" || type === "b") {
               width = height * aspect;
               if(type.includes("l")) x = orig.x + orig.width - width;
           } else if (type === "l" || type === "r") {
               height = width / aspect;
               if(type.includes("t")) y = orig.y + orig.height - height;
           } else {
               width = height * aspect;
               if (type === "tl") x = orig.x + orig.width - width;
               if (type === "bl") x = orig.x + orig.width - width;
               if (type === "tr" || type === "br") x = orig.x;
           }
       }
       setCropBox({ ...orig, x, y, width, height });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragAction(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
    if (cropBox) {
        let nx = cropBox.x, ny = cropBox.y, nw = cropBox.width, nh = cropBox.height;
        if (nw < 0) { nx += nw; nw = Math.abs(nw); }
        if (nh < 0) { ny += nh; nh = Math.abs(nh); }
        
        if (nx < 0) nx = 0;
        if (ny < 0) ny = 0;
        if (nx + nw > image.width) nw = image.width - nx;
        if (ny + nh > image.height) nh = image.height - ny;

        setCropBox(prev => ({ ...prev, x: nx, y: ny, width: nw, height: nh }));
    }
  };

  const handleDoubleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const ex = e.clientX - rect.left;
    const ey = e.clientY - rect.top;
    
    if (activeTool === "crop" && cropBox) {
        const action = getActionAt(ex, ey);
        if (action === "cropMove") {
            applyInteractiveCrop();
        }
    }
  };

  const applyInteractiveCrop = () => {
    if(!cropBox || !image) return;
    saveState();
    
    let targetW = cropBox.width;
    let targetH = cropBox.height;
    if(cropBox.targetW && cropBox.targetH) {
         targetW = cropBox.targetW;
         targetH = cropBox.targetH;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    
    ctx.drawImage(image, cropBox.x, cropBox.y, cropBox.width, cropBox.height, 0, 0, targetW, targetH);
    
    const newImg = new Image();
    newImg.src = canvas.toDataURL("image/png");
    newImg.onload = () => {
      setImage(newImg);
      setCropBox(null);
      setActiveTool("move");
      setZoom(1);
    };
  };

  const applyCustomCropDimension = () => {
      if(!image || !cropBox) return;
      const parsedW = parseInt(customW);
      const parsedH = parseInt(customH);
      if (isNaN(parsedW) || isNaN(parsedH) || parsedW <= 0 || parsedH <= 0) return alert("Enter valid pixel values greater than 0");
      
      const ratio = parsedW / parsedH;
      let newW = cropBox.width;
      let newH = newW / ratio;
      
      if (newH > image.height) {
         newH = image.height;
         newW = newH * ratio;
      }

      setCropBox({
          ...cropBox,
          width: newW,
          height: newH,
          aspect: ratio,
          targetW: parsedW,
          targetH: parsedH
      });
  };

  const setTemplateCrop = (tmpl) => {
    if (!image) return;
    const ratio = tmpl.ratio;
    let ch = image.height * 0.7;
    let cw = ch * ratio;
    
    if (cw > image.width * 0.9) {
      cw = image.width * 0.9;
      ch = cw / ratio;
    }
    const cx = (image.width - cw) / 2;
    const cy = (image.height - ch) / 2;
    
    setActiveTool("crop");
    setCropBox({ 
        x: cx, y: cy, width: cw, height: ch, 
        aspect: ratio, targetW: tmpl.w, targetH: tmpl.h 
    });
    setCustomW(tmpl.w.toString());
    setCustomH(tmpl.h.toString());
  };

  const commitFilters = () => {
    if(brightness === 1 && contrast === 1 && !isBW && strokes.length === 0 && bgColor === "transparent") return image;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    
    if (bgColor !== "transparent") {
       ctx.fillStyle = bgColor;
       ctx.fillRect(0,0, canvas.width, canvas.height);
    }

    const offLayerCanvas = document.createElement("canvas");
    offLayerCanvas.width = image.width;
    offLayerCanvas.height = image.height;
    const olCtx = offLayerCanvas.getContext("2d");

    let f = `brightness(${brightness}) contrast(${contrast})`;
    if (isBW) f += " grayscale(100%)";
    olCtx.filter = f;
    olCtx.drawImage(image, 0, 0);
    olCtx.filter = "none";

    olCtx.lineJoin = "round";
    olCtx.lineCap = "round";
    for (const stroke of strokes) {
        olCtx.globalAlpha = stroke.opacity / 100;
        olCtx.lineWidth = stroke.size;
        olCtx.strokeStyle = stroke.color;
        olCtx.globalCompositeOperation = stroke.isEraser ? "destination-out" : "source-over";
        
        if (stroke.hardness < 100) {
            olCtx.shadowBlur = stroke.size * (1 - stroke.hardness / 100);
            olCtx.shadowColor = stroke.isEraser ? "black" : stroke.color;
        } else {
            olCtx.shadowBlur = 0;
        }

        olCtx.beginPath();
        for (let i = 0; i < stroke.points.length; i++) {
            if (i === 0) olCtx.moveTo(stroke.points[i].x, stroke.points[i].y);
            else olCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        if (stroke.points.length === 1) {
            olCtx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y);
        }
        olCtx.stroke();
        olCtx.shadowBlur = 0;
    }
    
    ctx.drawImage(offLayerCanvas, 0, 0);

    const newImg = new Image();
    newImg.src = canvas.toDataURL("image/png");
    return newImg;
  };

  const applyAdjustmentsPermanent = () => {
    if(!image) return;
    saveState();
    const newImg = commitFilters();
    newImg.onload = () => {
      setImage(newImg);
      setBrightness(1.0);
      setContrast(1.0);
      setIsBW(false);
      setStrokes([]);
    }
  };

  const handleExportSingle = () => {
    if (!image) return;
    const finalImg = commitFilters();
    const link = document.createElement("a");
    link.download = `Studio_${Date.now()}.png`;
    link.href = finalImg.src;
    link.click();
  };

  const exportA4 = () => {
    if (!image) return;
    saveState();
    const baked = commitFilters();
    baked.onload = () => {
        const A4_W = 2480, A4_H = 3508; // 300 DPI A4
        const canvas = document.createElement("canvas");
        canvas.width = A4_W; canvas.height = A4_H;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white"; ctx.fillRect(0,0,A4_W,A4_H);

        // Passport size @ 300dpi is approx 472x591
        const pw = 472, ph = 591;
        const margin = 100, spacing = 50;
        const cols = Math.floor((A4_W - 2*margin + spacing) / (pw + spacing));
        const rows = Math.floor((A4_H - 2*margin + spacing) / (ph + spacing));

        for(let r=0; r<rows; r++){
            for(let c=0; c<cols; c++){
                const x = margin + c*(pw + spacing);
                const y = margin + r*(ph + spacing);
                // Draw white background for passport
                if(bgColor!=="transparent"){
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(x,y,pw,ph);
                }
                ctx.drawImage(baked, 0, 0, baked.width, baked.height, x, y, pw, ph);
                // Cut line
                ctx.strokeStyle = "#eee"; ctx.lineWidth = 1; ctx.strokeRect(x,y,pw,ph);
            }
        }
        
        const link = document.createElement("a");
        link.download = `A4_Sheet_${Date.now()}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.95);
        link.click();
        setStatus("A4 Sheet Exported Successfully");
    };
  };

  const applyPreset = (type) => {
    if(type === 'warm') { setBrightness(1.05); setContrast(1.1); setSaturation(1.2); }
    if(type === 'cold') { setBrightness(1.02); setContrast(1.15); setSaturation(0.85); }
    if(type === 'natural') { setBrightness(1.0); setContrast(1.0); setSaturation(1.0); setSkinPolish(20); }
    if(type === 'pop') { setBrightness(1.05); setContrast(1.25); setSaturation(1.3); }
  };
  
  const addToQueue = () => {
    if (!image) return;
    setStatus("Processing asset...");
    const bakedImage = commitFilters();
    bakedImage.onload = () => {
        const newAsset = {
            id: Date.now(),
            img: bakedImage,
            name: `${imageName} (Edit)`,
            bgColor: bgColor
        };
        setPrintQueue(prev => [...prev, newAsset]);
        setStatus("Ready: Added to Print Queue");
    };
  };

  const removeFromQueue = (id) => {
    setPrintQueue(prev => prev.filter(a => a.id !== id));
    setSelectedAssetIds(prev => prev.filter(sid => sid !== id));
  };

  const toggleAssetSelection = (id) => {
    setSelectedAssetIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleCreateJoint = () => {
    if(selectedAssetIds.length !== 2) return alert("Please select exactly 2 photos to merge.");
    
    const assetA = printQueue.find(a => a.id === selectedAssetIds[0]);
    const assetB = printQueue.find(a => a.id === selectedAssetIds[1]);
    
    if(!assetA || !assetB) return;

    const img1 = mergeSettings.swap ? assetB.img : assetA.img;
    const img2 = mergeSettings.swap ? assetA.img : assetB.img;

    const canvas = document.createElement("canvas");
    // Standard Passport is 472x591.
    if (mergeSettings.orientation === 'vertical') {
        // Vertical Joint: Two passports stacked vertically
        const W = 472, H = 1182; 
        canvas.width = W; canvas.height = H;
        const ctx = canvas.toDataURL ? canvas.getContext("2d") : null; // Getting context
        const ctx2 = canvas.getContext("2d");
        ctx2.fillStyle = bgColor === "transparent" ? "white" : bgColor;
        ctx2.fillRect(0,0,W,H);
        
        ctx2.drawImage(img1, 0, 0, img1.width, img1.height, 0, 0, W, 591);
        ctx2.drawImage(img2, 0, 0, img2.width, img2.height, 0, 591, W, 591);
        
        // Split line
        ctx2.strokeStyle = "rgba(0,0,0,0.1)"; ctx2.lineWidth = 2;
        ctx2.beginPath(); ctx2.moveTo(0, 591); ctx2.lineTo(W, 591); ctx2.stroke();
    } else {
        // Horizontal Joint: Two passports side-by-side
        const W = 944, H = 591;
        canvas.width = W; canvas.height = H;
        const ctx2 = canvas.getContext("2d");
        ctx2.fillStyle = bgColor === "transparent" ? "white" : bgColor;
        ctx2.fillRect(0,0,W,H);
        
        ctx2.drawImage(img1, 0, 0, img1.width, img1.height, 0, 0, 472, H);
        ctx2.drawImage(img2, 0, 0, img2.width, img2.height, 472, 0, 472, H);
        
        // Split line
        ctx2.strokeStyle = "rgba(0,0,0,0.1)"; ctx2.lineWidth = 2;
        ctx2.beginPath(); ctx2.moveTo(472, 0); ctx2.lineTo(472, H); ctx2.stroke();
    }

    const mergedImg = new Image();
    mergedImg.onload = () => {
        setPrintQueue(prev => [...prev, {
            id: Date.now(),
            img: mergedImg,
            name: `Joint_${assetA.name.split(' ')[0]}_${assetB.name.split(' ')[0]}`,
            bgColor: bgColor
        }]);
        setShowMergeModal(false);
        setSelectedAssetIds([]);
        setStatus("Joint Photo Created Successfully");
    };
    mergedImg.src = canvas.toDataURL("image/png");
  };

  const handleRemoveBackground = async () => {
    if(!image) return alert("Please open an image first.");
    try {
      setStatus("Removing Background... Please wait.");
      
      let blob;
      try {
        blob = await removeBackground(image.src, {
          model: 'isnet', // Highest fidelity model available
          debug: false,
          proxyToWorker: true,
          output: { quality: 1.0, format: 'image/png' },
          progress: (key, current, total) => {
             if (key === 'compute') {
                setStatus(`Removing Background... ${Math.round((current/total)*100)}%`);
             }
          }
        });
      } catch (err) {
        console.warn("isnet model failed, falling back to isnet_fp16", err);
        blob = await removeBackground(image.src, { model: 'isnet_fp16' });
      }

      const url = URL.createObjectURL(blob);
      const newImg = new Image();
      newImg.onload = async () => {
         // Auto-apply edge decontamination
         try {
             setStatus("Refining Edges...");
             const refinedDataUrl = await internalDecontaminateEdges(newImg);
             const refinedImg = new Image();
             refinedImg.onload = () => {
                saveState();
                setImage(refinedImg);
                setStatus("Ready");
             }
             refinedImg.src = refinedDataUrl;
         } catch(e) {
             saveState();
             setImage(newImg);
             setStatus("Ready");
         }
      };
      newImg.src = url;
    } catch (error) {
      console.error("BG Removal Error:", error);
      setStatus("Failed to remove background.");
      alert("Error removing background. Check console.");
    }
  };

  const internalDecontaminateEdges = async (img) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = img.width; canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width, height = canvas.height;
      const sampleData = new Uint8ClampedArray(data);

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a > 0 && a < 255) {
          let rSum = 0, gSum = 0, bSum = 0, count = 0;
          const x = (i / 4) % width;
          const y = Math.floor((i / 4) / width);
          const radius = 2;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx; const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const ni = (ny * width + nx) * 4;
                if (sampleData[ni + 3] > 240) {
                  rSum += sampleData[ni]; gSum += sampleData[ni + 1]; bSum += sampleData[ni + 2]; count++;
                }
              }
            }
          }
          if (count > 0) {
            data[i] = rSum / count; data[i+1] = gSum / count; data[i+2] = bSum / count;
          } else {
            const luminosity = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
            data[i] = data[i+1] = data[i+2] = luminosity;
          }
          if (a < 20) data[i+3] = a * 0.5;
          else if (a > 230) data[i+3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
  };

  // ── PHOTO ENHANCER ────────────────────────────────────────────────────────
  // Multi-pass: skin smooth + sharpen + clarity + color polish + luminance lift + HD upscale
  const handleEnhance = async () => {
    if (!image) return alert("Please open an image first.");
    setStatus("Enhancing photo...");
    try {
      await new Promise(r => setTimeout(r, 20));
      
      // Upscale smaller images for "HD clear pixel" effect
      const scaleFactor = image.width < 1200 ? 2 : 1;
      const W = image.width * scaleFactor;
      const H = image.height * scaleFactor;

      // PASS 1: Base tone — brightness + contrast + saturation + HD Draw
      setStatus("Enhancing: HD scaling & grading...");
      await new Promise(r => setTimeout(r, 10));
      const base = document.createElement('canvas');
      base.width = W; base.height = H;
      const bCtx = base.getContext('2d', { willReadFrequently: true });
      bCtx.imageSmoothingEnabled = true;
      bCtx.imageSmoothingQuality = 'high';
      bCtx.filter = 'brightness(1.06) contrast(1.10) saturate(1.15)';
      bCtx.drawImage(image, 0, 0, W, H);
      bCtx.filter = 'none';

      // PASS 2: Skin smoothing (bilateral approximation)
      setStatus("Enhancing: skin smoothing...");
      await new Promise(r => setTimeout(r, 10));
      const smooth = document.createElement('canvas');
      smooth.width = W; smooth.height = H;
      const sCtx = smooth.getContext('2d');
      sCtx.filter = `blur(${3 * scaleFactor}px)`;
      sCtx.drawImage(base, 0, 0);
      sCtx.filter = `blur(${2 * scaleFactor}px)`;
      sCtx.globalAlpha = 0.5;
      sCtx.drawImage(base, 0, 0);
      sCtx.filter = 'none';
      sCtx.globalAlpha = 1.0;

      const blended = document.createElement('canvas');
      blended.width = W; blended.height = H;
      const blCtx = blended.getContext('2d', { willReadFrequently: true });
      blCtx.drawImage(base, 0, 0);
      blCtx.globalAlpha = 0.42;
      blCtx.drawImage(smooth, 0, 0);
      blCtx.globalAlpha = 0.22;
      blCtx.drawImage(base, 0, 0);
      blCtx.globalAlpha = 1.0;

      // PASS 3: Strong Unsharp Mask — crystal clear pixels
      setStatus("Enhancing: crystal detailing...");
      await new Promise(r => setTimeout(r, 10));
      const blurLayer = document.createElement('canvas');
      blurLayer.width = W; blurLayer.height = H;
      const blurCtx = blurLayer.getContext('2d');
      blurCtx.filter = `blur(${1.2 * scaleFactor}px)`; // tighter radius for crisp edges
      blurCtx.drawImage(blended, 0, 0);
      blurCtx.filter = 'none';

      const sharp = document.createElement('canvas');
      sharp.width = W; sharp.height = H;
      const shCtx = sharp.getContext('2d', { willReadFrequently: true });
      const blendData = blended.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H);
      const blurData  = blurLayer.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H);
      const outData   = shCtx.createImageData(W, H);
      
      const amount = 1.8; // Extreme sharpness for crystal clear pop (was 0.85)
      for (let i = 0; i < blendData.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const orig = blendData.data[i + c];
          const blur = blurData.data[i + c];
          outData.data[i + c] = Math.min(255, Math.max(0, orig + amount * (orig - blur)));
        }
        outData.data[i + 3] = blendData.data[i + 3];
      }
      shCtx.putImageData(outData, 0, 0);

      // PASS 4: Luminance lift + beauty light gradient + final polish
      setStatus("Enhancing: final polish...");
      await new Promise(r => setTimeout(r, 10));
      const final = document.createElement('canvas');
      final.width = W; final.height = H;
      const fCtx = final.getContext('2d');
      fCtx.drawImage(sharp, 0, 0);

      // Radial beauty light — brightens face area (top 35%)
      fCtx.globalCompositeOperation = 'soft-light';
      fCtx.globalAlpha = 0.18;
      const grd = fCtx.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, W * 0.65);
      grd.addColorStop(0, 'rgba(255,248,235,1)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      fCtx.fillStyle = grd;
      fCtx.fillRect(0, 0, W, H);
      fCtx.globalCompositeOperation = 'source-over';
      fCtx.globalAlpha = 1.0;

      // Micro contrast lift
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').drawImage(final, 0, 0);
      fCtx.clearRect(0, 0, W, H);
      fCtx.filter = 'contrast(1.05) saturate(1.06)';
      fCtx.drawImage(tmp, 0, 0);
      fCtx.filter = 'none';

      const dataUrl = final.toDataURL('image/jpeg', 0.96);
      const newImg = new Image();
      newImg.onload = () => {
        saveState();
        setImage(newImg);
        setStatus("Photo Enhanced!");
        setTimeout(() => setStatus("Ready"), 2500);
      };
      newImg.src = dataUrl;
    } catch (err) {
      console.error(err);
      setStatus("Enhancement failed.");
    }
  };

  // Scale with Background: ছবি scale করে background color যোগ করে
  const applyScaleWithBackground = () => {
    if (!image) return alert("প্রথমে একটি ছবি খুলুন।");
    const s = scalePercent / 100;
    // নতুন canvas এর size = original image size (background সেই size এ)
    // subject scale হবে center থেকে
    const canvasW = image.width;
    const canvasH = image.height;
    const newW = Math.round(canvasW * s);
    const newH = Math.round(canvasH * s);
    const offsetX = Math.round((canvasW - newW) / 2);
    const offsetY = Math.round((canvasH - newH) / 2);

    const out = document.createElement("canvas");
    out.width = canvasW;
    out.height = canvasH;
    const ctx = out.getContext("2d");

    // Background fill
    ctx.fillStyle = scaleBgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Subject scaled and centered
    ctx.drawImage(image, offsetX, offsetY, newW, newH);

    const result = new Image();
    result.onload = () => {
      saveState();
      setImage(result);
      setShowScalePanel(false);
      setStatus(`Scale ${scalePercent}% + Background Applied!`);
      setTimeout(() => setStatus("Ready"), 2000);
    };
    result.src = out.toDataURL("image/png");
  };


  return (
    <div className="ps-app">
      {/* Top Menubar */}
      <div className="ps-menubar">
        <button
          onClick={onBackToDashboard}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ps-text-bright)',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '3px',
            transition: 'background-color 0.2s ease',
            marginRight: '10px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4a4a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Browsers size={14} /> Dashboard
        </button>
        <span style={{fontWeight: 700, color: '#2e6ff7'}}>Ps</span>
        <div className="ps-menubar-item" onClick={handleOpenClick} style={{fontWeight: 600}}>File</div>
        <div className="ps-menubar-item" style={{display:'flex', gap:10}}>
           <span>Edit:</span>
           <button className="ps-btn-gray" style={{padding:'2px 6px', fontSize:10, borderColor:'transparent', opacity: (history.length || strokes.length) ? 1 : 0.4}} onClick={undo} disabled={!(history.length || strokes.length)} title="Undo (Ctrl+Z)"><ArrowUUpLeft size={10} /> Undo</button>
           <button className="ps-btn-gray" style={{padding:'2px 6px', fontSize:10, borderColor:'transparent', opacity: (redoStack.length || redoStrokes.length) ? 1 : 0.4}} onClick={redo} disabled={!(redoStack.length || redoStrokes.length)} title="Redo (Ctrl+Y)"><ArrowUUpRight size={10} /> Redo</button>
        </div>
        <div className="ps-menubar-item" onClick={() => alert('Image properties are on the right panel.')}>Image</div>
        <div className="ps-menubar-item" onClick={() => alert('Layer properties are on the right panel.')}>Layer</div>
        <div className="ps-menubar-item" onClick={() => alert('Text typing is not supported in Passport mode.')}>Type</div>
        <div className="ps-menubar-item" onClick={() => alert('Advanced selections require PS Pro.')}>Select</div>
        <div className="ps-menubar-item" onClick={() => alert('Filters: Check Adjustments panel.')}>Filter</div>
      </div>

      {/* Options Bar */}
      <div className="ps-options-bar">
        <Desktop size={14} color="#aaa" onClick={() => fileInputRef.current.click()} style={{cursor:'pointer'}} title="Open File" />
        <span style={{color: '#aaa'}}>|</span>
        <div className="flex items-center gap-2">
            <span style={{color: "#888"}}>Preset Ratio:</span>
            <select style={{background: '#222', color: '#ccc', border: '1px solid #1a1a1a', padding: '2px 4px', fontSize: '11px'}} 
              onChange={(e) => {
                if(e.target.value === "pp") setTemplateCrop(TEMPLATES.passport);
                if(e.target.value === "st") setTemplateCrop(TEMPLATES.stamp);
              }}>
                <option value="">Original</option>
                <option value="pp">Passport (40x50mm)</option>
                <option value="st">Stamp (20x25mm)</option>
            </select>
            {cropBox && activeTool === "crop" && (
                <>
                  <button className="ps-btn-gray ps-btn-blue" style={{marginLeft: 10}} onClick={applyInteractiveCrop}>✓ Apply</button>
                  <button className="ps-btn-gray" onClick={()=>{setCropBox(null); setActiveTool("move");}}>✖ Cancel (Esc)</button>
                </>
            )}
        </div>
        <div className="flex items-center gap-2" style={{marginLeft: 'auto'}}>
            <button className="ps-btn-gray" onClick={undo} disabled={!(history.length || strokes.length)} title="Ctrl+Z">
               <ArrowUUpLeft size={12}/>
            </button>
            <button className="ps-btn-gray" onClick={redo} disabled={!(redoStack.length || redoStrokes.length)} title="Ctrl+Y">
               <ArrowUUpRight size={12}/>
            </button>
            <span style={{color: '#444', margin: '0 5px'}}>|</span>
            <button className="ps-btn-gray" onClick={handleExportSingle} disabled={!image} title="Save current image directly">
                <DownloadSimple size={12}/> Export
            </button>
            <button className="ps-btn-gray" onClick={exportA4} disabled={!image} title="Generate A4 Sheet for Home Printers">
                A4 Sheet
            </button>
            <button className="ps-btn-gray ps-btn-blue" onClick={() => setShowExportModal(true)}>
                <Printer size={12}/> {printQueue.length > 1 ? `Print Layout (${printQueue.length} Images)` : 'Print DNP Layout'}
            </button>
        </div>
      </div>
      
      <div className="ps-main">
        {/* Left Toolbar */}
        <div className="ps-toolbar">
          <div className={`ps-toolbar-btn ${activeTool === "move" ? "active" : ""}`} onClick={() => setActiveTool("move")}><ArrowsOutCardinal size={16} /></div>
          <div className={`ps-toolbar-btn ${activeTool === "crop" ? "active" : ""}`} onClick={() => { setActiveTool("crop"); if(!cropBox) setTemplateCrop(TEMPLATES.passport); }}><CropIcon size={16} /></div>
           <div className={`ps-toolbar-btn ${activeTool === "brush" ? "active" : ""}`} onClick={() => setActiveTool("brush")} title="Brush Tool (B)"><PaintBrush size={16} /></div>
           <div className={`ps-toolbar-btn ${activeTool === "retouch" ? "active" : ""}`} onClick={() => setActiveTool("retouch")} title="Smooth/Retouch Brush (S)"><Sparkle size={16} /></div>
           <div className={`ps-toolbar-btn ${activeTool === "eraser" ? "active" : ""}`} onClick={() => setActiveTool("eraser")} title="Eraser Tool (E)"><Eraser size={16} /></div>
          <div className={`ps-toolbar-btn ${activeTool === "zoom" ? "active" : ""}`} onClick={() => setActiveTool("zoom")}><MagnifyingGlass size={16} /></div>
        </div>

        {/* Canvas Area */}
        <div className="ps-canvas-wrapper flex-col">
            <div className="ps-doc-tabs">
                {image && (
                    <div className="ps-doc-tab">
                        {imageName} @ {Math.round(zoom * 100)}% (Layer 1, RGB/8) <div style={{marginLeft: 15, color:'#777', cursor:'pointer'}}>×</div>
                    </div>
                )}
            </div>
            
            <div 
               className="ps-canvas-area flex items-center justify-center" 
               ref={wrapRef} 
               onWheel={handleWheel} 
               onDragOver={handleDragOver}
               onDrop={handleDrop}
               style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}
            >
              {!image && (
                 <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%', color: '#999', userSelect: 'none',
                    background: 'radial-gradient(circle, #252525 0%, #161616 100%)', zIndex: 10
                 }}>
                    <div style={{
                       padding: '60px', borderRadius: 20, border: '1px solid #333', 
                       display: 'flex', flexDirection: 'column', alignItems: 'center',
                       background: 'rgba(25,25,25,0.6)', backdropFilter: 'blur(15px)',
                       boxShadow: '0 30px 60px rgba(0,0,0,0.5)', transition: 'all 0.3s ease'
                    }}>
                       <div style={{
                          width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #2e6ff7, #1a4abf)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 25,
                          boxShadow: '0 0 20px rgba(46, 111, 247, 0.4)'
                       }}>
                          <ImageSquare size={40} color="#fff" weight="duotone" />
                       </div>
                       <h2 style={{color: '#fff', fontSize: 28, marginBottom: 12, fontWeight: 600, letterSpacing: '-0.5px'}}>ProyojonTake Service Tool</h2>
                       <p style={{marginBottom: 35, fontSize: 14, color: '#888', textAlign: 'center', maxWidth: 300}}>Professional Passport & Editing Suite. <br/>Drag and drop a photo to start.</p>
                       
                       <div className="flex gap-4">
                          <button className="ps-btn-gray ps-btn-blue" style={{padding: '10px 32px', fontSize: 15, borderRadius: 8}} onClick={handleOpenClick}>
                             Open from Computer
                          </button>
                          <button className="ps-btn-gray" style={{padding: '10px 24px', fontSize: 15, borderRadius: 8}} onClick={() => alert("Coming soon: Templates")}>
                             New Project
                          </button>
                       </div>
                       
                       <div style={{marginTop: 50, fontSize: 12, color: '#444', borderTop: '1px solid #222', paddingTop: 20, width: '100%', textAlign: 'center'}}>
                          QUICK ACTIONS: &nbsp; <span style={{color: '#666'}}>AI Background Removal &bull; High-Res Export &bull; Multi-DNP Layout</span>
                       </div>
                    </div>
                 </div>
              )}
              <canvas 
                ref={canvasRef}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  display: image ? 'block' : 'none'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(e) => e.preventDefault()}
              />
              
              {/* Universal AI Action Loading Pill */}
              {(status.includes("...") || status.includes("wait")) && !status.includes("Removing") && (
                <div style={{
                  position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                  padding: '10px 25px', borderRadius: '30px', background: 'rgba(30,30,35,0.85)',
                  backdropFilter: 'blur(10px)', border: '1px solid rgba(46, 111, 247, 0.4)',
                  display: 'flex', alignItems: 'center', gap: 12, zIndex: 90,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transition: 'all 0.3s ease'
                }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', background: '#2e6ff7',
                    animation: 'cyberPulse 1.5s infinite'
                  }} />
                  <span style={{color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: '0.5px'}}>{status}</span>
                </div>
              )}

              {(status.includes("Removing") || status.includes("Retouching")) && (
                 <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(20, 20, 20, 0.75)', backdropFilter: 'blur(8px)',
                    zIndex: 100, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    <style>{`
                      @keyframes simpleSpin { 100% { transform: rotate(360deg); } }
                      @keyframes pulseText { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
                    `}</style>
                    
                    <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 25 }}>
                       <div style={{
                          position: 'absolute', width: '100%', height: '100%', 
                          border: '4px solid rgba(46, 111, 247, 0.1)', borderRadius: '50%'
                       }} />
                       <div style={{
                          position: 'absolute', width: '100%', height: '100%', 
                          border: '4px solid transparent', borderTopColor: '#2e6ff7', borderRadius: '50%',
                          animation: 'simpleSpin 0.8s linear infinite'
                       }} />
                       <div style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace'
                       }}>
                          {status.match(/\d+/)?.[0] || 0}%
                       </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                       <div style={{ color: '#fff', fontSize: '15px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase' }}>
                          {status.includes("Background") ? "Removing Background" : "Processing AI Retouch"}
                       </div>
                       <div style={{ color: '#888', fontSize: '11px', marginTop: 8, animation: 'pulseText 1.5s infinite' }}>
                          Please wait, this may take a few seconds...
                       </div>
                    </div>
                 </div>
              )}

              {/* Scale + Background Panel — PS Theme */}
              {showScalePanel && image && (
                <div style={{
                  position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                  width: 400,
                  background: 'var(--ps-panel-bg)',
                  border: '1px solid #222',
                  borderTop: '2px solid var(--ps-accent)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px #111',
                  zIndex: 85, overflow: 'hidden',
                  fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif',
                  fontSize: 11
                }}>

                  {/* Title bar */}
                  <div style={{
                    height: 28, background: '#3b3b3b',
                    borderBottom: '1px solid #222',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 10px',
                    boxShadow: 'inset 0 1px 0 #555'
                  }}>
                    <span style={{ color: 'var(--ps-text-bright)', fontWeight: 600, fontSize: 11 }}>
                      Scale + Background Color
                    </span>
                    <button
                      onClick={() => setShowScalePanel(false)}
                      className="ps-toolbar-btn"
                      style={{ width: 20, height: 20, fontSize: 13, color: '#aaa' }}
                    >×</button>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                    {/* Scale row */}
                    <div>
                      <div className="ps-section-header first" style={{ marginBottom: 6 }}>
                        Subject Scale
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="ps-btn-gray"
                          style={{ padding: '2px 7px', fontSize: 14, lineHeight: 1, minWidth: 26 }}
                          onClick={() => setScalePercent(s => Math.max(30, s - 5))}
                        >−</button>
                        <input
                          type="range" min="30" max="200" step="1" value={scalePercent}
                          onChange={e => setScalePercent(parseInt(e.target.value))}
                          className="ps-slider" style={{ flex: 1 }}
                        />
                        <button
                          className="ps-btn-gray"
                          style={{ padding: '2px 7px', fontSize: 14, lineHeight: 1, minWidth: 26 }}
                          onClick={() => setScalePercent(s => Math.min(200, s + 5))}
                        >+</button>
                        {/* Editable numeric display */}
                        <input
                          type="number" min="30" max="200" value={scalePercent}
                          onChange={e => setScalePercent(Math.min(200, Math.max(30, parseInt(e.target.value) || 30)))}
                          className="ps-input"
                          style={{ width: 40, color: scalePercent > 100 ? '#7fd17f' : scalePercent < 100 ? '#e07070' : 'var(--ps-text-bright)' }}
                        />
                        <span style={{ color: '#777' }}>%</span>
                      </div>

                      {/* Preset chips */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 7, flexWrap: 'wrap' }}>
                        {[50, 75, 100, 120, 150, 200].map(v => (
                          <button
                            key={v}
                            onClick={() => setScalePercent(v)}
                            className="ps-btn-gray"
                            style={{
                              padding: '2px 8px', fontSize: 10, borderRadius: 2,
                              background: scalePercent === v ? 'var(--ps-accent)' : 'var(--ps-btn-bg)',
                              color: scalePercent === v ? '#fff' : 'var(--ps-text)',
                              border: scalePercent === v ? '1px solid #0050cd' : undefined
                            }}
                          >{v}%</button>
                        ))}
                        <button
                          onClick={() => setScalePercent(100)}
                          className="ps-btn-gray"
                          style={{ padding: '2px 8px', fontSize: 10 }}
                        >Reset</button>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid #222', margin: '0 -12px' }} />

                    {/* BG Color row */}
                    <div>
                      <div className="ps-section-header" style={{ marginBottom: 6, marginTop: 0 }}>
                        Background Color
                      </div>
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                        {[
                          { c: '#008cff', n: 'নীল' },
                          { c: '#4169e1', n: 'রয়েল নীল' },
                          { c: '#ffffff', n: 'সাদা' },
                          { c: '#e8f4fb', n: 'হালকা নীল' },
                          { c: '#ff2222', n: 'লাল' },
                          { c: '#f0f0f0', n: 'ধূসর' },
                          { c: '#000000', n: 'কালো' },
                        ].map(({ c, n }) => (
                          <div
                            key={c} onClick={() => setScaleBgColor(c)} title={n}
                            style={{
                              width: 22, height: 22, borderRadius: 2, backgroundColor: c, cursor: 'pointer',
                              border: scaleBgColor === c ? '2px solid var(--ps-accent)' : '1px solid #555',
                              boxSizing: 'border-box', position: 'relative', flexShrink: 0
                            }}
                          >
                            {scaleBgColor === c && (
                              <div style={{
                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: (c === '#ffffff' || c === '#f0f0f0' || c === '#e8f4fb') ? '#333' : '#fff',
                                fontSize: 11, fontWeight: 'bold', lineHeight: 1
                              }}>✓</div>
                            )}
                          </div>
                        ))}

                        {/* Custom color */}
                        <div style={{ position: 'relative', width: 22, height: 22, borderRadius: 2, overflow: 'hidden', cursor: 'pointer', border: '1px solid #555', flexShrink: 0 }}>
                          <div style={{ width: '100%', height: '100%', background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} />
                          <input type="color" value={scaleBgColor} onChange={e => setScaleBgColor(e.target.value)}
                            style={{ position: 'absolute', top: -3, left: -3, width: 28, height: 28, opacity: 0, cursor: 'pointer' }} />
                        </div>

                        {/* Current color swatch */}
                        <div style={{
                          width: 22, height: 22, borderRadius: 2, background: scaleBgColor,
                          border: '1px solid #444', flexShrink: 0
                        }} title="Current color" />

                        <span style={{ color: '#666', fontSize: 10, marginLeft: 2 }}>{scaleBgColor}</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid #222', margin: '0 -12px' }} />

                    {/* Info note */}
                    <div style={{ color: '#888', fontSize: 10, lineHeight: 1.5 }}>
                      Scales the image and fills the background color. Then use the
                      <span style={{ color: 'var(--ps-text-bright)' }}> Crop tool</span> to manually crop to Passport size.
                    </div>

                    {/* Apply btn */}
                    <button
                      onClick={applyScaleWithBackground}
                      className="ps-btn-gray ps-btn-blue"
                      style={{ padding: '7px 0', fontSize: 12, fontWeight: 600, width: '100%' }}
                    >
                      Apply — Scale {scalePercent}% + Background
                    </button>
                  </div>
                </div>
              )}


              {/* Mini Asset Tray (Bottom Right) */}


              {printQueue.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: 15, right: 15,
                  padding: '8px 12px', borderRadius: '6px',
                  background: 'var(--ps-panel-bg)',
                  border: '1px solid #333',
                  display: 'flex', alignItems: 'center', gap: 8, zIndex: 80,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
                }}>
                   <div style={{ marginRight: 4 }}>
                      <span style={{fontSize: 9, color: '#888', fontWeight: 600, display: 'block', letterSpacing: '0.5px'}}>ASSETS</span>
                      <span style={{fontSize: 13, color: 'var(--ps-text-bright)', fontWeight: 700}}>{printQueue.length}</span>
                   </div>
                   <div style={{display: 'flex', gap: 4}}>
                      {printQueue.slice(-4).map((asset) => (
                         <div key={asset.id} style={{
                            width: 22, height: 28, borderRadius: 2, overflow: 'hidden', border: '1px solid #444', 
                            background: '#fff'
                         }}>
                            <img src={asset.img.src} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                         </div>
                      ))}
                      {printQueue.length > 4 && (
                         <div style={{
                            width: 22, height: 28, borderRadius: 2, background: 'rgba(46, 111, 247, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#aaa',
                            border: '1px solid #444'
                         }}>
                            +{printQueue.length - 4}
                         </div>
                      )}
                   </div>
                </div>
              )}



              {/* Mini Asset Tray (Bottom Right) */}
              {printQueue.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: 15, right: 15,
                  padding: '10px 15px', borderRadius: '12px', background: 'rgba(20,20,25,0.75)',
                  backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', gap: 10, zIndex: 80,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.5)', transition: 'all 0.3s ease'
                }}>
                   <div style={{ marginRight: 6 }}>
                      <span style={{fontSize: 10, color: '#aaa', fontWeight: 600, display: 'block', marginBottom: -2}}>ASSETS</span>
                      <span style={{fontSize: 14, color: '#fff', fontWeight: 700}}>{printQueue.length}</span>
                   </div>
                   <div style={{display: 'flex', gap: 6}}>
                      {printQueue.slice(-4).map((asset, i) => (
                         <div key={asset.id} style={{
                            width: 24, height: 32, borderRadius: 3, overflow: 'hidden', border: '1px solid #444', 
                            background: '#fff', boxShadow: '2px 2px 5px rgba(0,0,0,0.3)'
                         }}>
                            <img src={asset.img.src} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                         </div>
                      ))}
                      {printQueue.length > 4 && (
                         <div style={{
                            width: 24, height: 32, borderRadius: 3, background: 'rgba(46, 111, 247, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff',
                            border: '1px dashed #2e6ff7'
                         }}>
                            +{printQueue.length - 4}
                         </div>
                      )}
                   </div>
                </div>
              )}
            </div>

            <div className="ps-status-bar">
                <span style={{minWidth: '40px'}}>{Math.round(zoom * 100)}%</span>
                <span style={{color: '#666'}}>⯈</span>
                <span>{image ? `${image.width} px x ${image.height} px (72 ppi)` : 'No Document'}</span>
                <span style={{marginLeft: 'auto', color: '#ffb52e'}}>{status !== "Ready" ? status : ""}</span>
            </div>
        </div>

        {/* Right Panels */}
        <div className="ps-right-panels">
            {/* Upper Panel Group */}
            <div className="ps-panel">
                <div className="ps-panel-tabs">
                    <div className={`ps-panel-tab ${activeUpperTab === "Properties" ? "active" : ""}`} onClick={()=>setActiveUpperTab("Properties")}>Properties</div>
                    <div className={`ps-panel-tab ${activeUpperTab === "Adjustments" ? "active" : ""}`} onClick={()=>setActiveUpperTab("Adjustments")}>Adjustments</div>
                    <div className={`ps-panel-tab ${activeUpperTab === "Libraries" ? "active" : ""}`} onClick={()=>setActiveUpperTab("Libraries")}>Libraries</div>
                </div>
                
                <div className="ps-panel-content">
                  {activeUpperTab === "Properties" && (
                    <>
                      <div className="ps-section-header first">
                        <ImageSquare size={14} color="#888" /> Pixel Layer
                      </div>

                      {/* Display / Custom crop dimensions */}
                      <div className="flex items-center gap-4 mb-2" style={{paddingLeft: '15px'}}>
                          <div className="flex items-center gap-2">
                             <span style={{color:'#666'}}>W</span>
                             <input type="text" className="ps-input" 
                                value={activeTool === "crop" && cropBox ? customW : (image ? image.width : 0)} 
                                readOnly={activeTool !== "crop"}
                                onChange={(e) => setCustomW(e.target.value)} />
                             <span style={{color:'#666'}}>px</span>
                          </div>
                          <LockKey size={12} color={cropBox?.aspect ? "#2e6ff7" : "#666"} title={cropBox?.aspect ? "Aspect Ratio Locked" : "Aspect Ratio Free"}/>
                          <div className="flex items-center gap-2">
                             <span style={{color:'#666'}}>H</span>
                             <input type="text" className="ps-input" 
                                value={activeTool === "crop" && cropBox ? customH : (image ? image.height : 0)} 
                                readOnly={activeTool !== "crop"} 
                                onChange={(e) => setCustomH(e.target.value)} />
                             <span style={{color:'#666'}}>px</span>
                          </div>
                      </div>

                       {activeTool === "crop" && cropBox && (
                         <div className="flex items-center" style={{paddingLeft: '40px', marginBottom: 15}}>
                            <button className="ps-btn-gray" style={{padding: '2px 8px', fontSize: 10}} onClick={applyCustomCropDimension}>Apply Custom Size</button>
                         </div>
                      )}

                       {(activeTool === "brush" || activeTool === "eraser" || activeTool === "retouch") && (
                          <>{activeTool === "retouch" ? (
                             <div className="ps-section-header">Retouch (Smooth) Brush</div>
                          ) : (
                             <div className="ps-section-header">Brush Settings</div>
                          )}
                             <div className="ps-slider-wrapper">
                                <span style={{width: 60}}>Size</span>
                                <input type="range" className="ps-slider" min="1" max="500" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} title="Hotkey: [ and ]" />
                                <span style={{width: 35, textAlign: 'right'}}>{brushSize}px</span>
                             </div>
                             <div className="ps-slider-wrapper">
                                <span style={{width: 60}}>Hardness</span>
                                <input type="range" className="ps-slider" min="0" max="100" value={brushHardness} onChange={(e) => setBrushHardness(parseInt(e.target.value))} />
                                <span style={{width: 35, textAlign: 'right'}}>{brushHardness}%</span>
                             </div>
                             <div className="ps-slider-wrapper">
                                <span style={{width: 60}}>Opacity</span>
                                <input type="range" className="ps-slider" min="1" max="100" value={brushOpacity} onChange={(e) => setBrushOpacity(parseInt(e.target.value))} />
                                <span style={{width: 35, textAlign: 'right'}}>{brushOpacity}%</span>
                             </div>
                             <div className="flex gap-2" style={{paddingLeft: '15px', marginBottom: '15px', marginTop: '10px'}}>
                                <span style={{color: '#aaa', fontSize: 11, marginRight: 5}}>Color:</span>
                                <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)} style={{width: 24, height: 24, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4}} />
                             </div>
                         </>
                      )}

                      <div className="ps-section-header">Align and Distribute</div>
                      <div className="flex items-center gap-2 mb-4" style={{paddingLeft: '15px', color: '#555'}}>
                          Align: ▤ ▥ ▦ ▧
                      </div>

                      <div className="ps-section-header">Background Color</div>
                      <div className="flex gap-2" style={{paddingLeft: '15px', marginBottom: '15px'}}>
                          {["#008cff", "#ffffff", "#ff0000", "#000000", "transparent"].map(c => (
                             <div key={c} 
                               onClick={() => setBgColor(c)}
                               style={{
                                   width: 24, height: 24, 
                                   borderRadius: 4, 
                                   backgroundColor: c === "transparent" ? "#333" : c,
                                   border: bgColor === c ? '2px solid #2e6ff7' : '1px solid #444',
                                   cursor: 'pointer',
                                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   backgroundImage: c === "transparent" ? 'repeating-linear-gradient(45deg, #444 25%, transparent 25%, transparent 75%, #444 75%, #444), repeating-linear-gradient(45deg, #444 25%, #333 25%, #333 75%, #444 75%, #444)' : 'none',
                                   backgroundPosition: '0 0, 4px 4px', backgroundSize: '8px 8px'
                               }}
                               title={c}
                             >
                               {bgColor === c && c !== "transparent" && <div style={{width:4, height:4, borderRadius:2, backgroundColor: c==="#ffffff" ? "#000" : "#fff"}}/>}
                             </div>
                          ))}
                          <div style={{position: 'relative', width: 24, height: 24, borderRadius: 4, border: '1px solid #444', overflow: 'hidden', cursor: 'pointer'}} title="Custom Color Picker">
                             <div style={{width: '100%', height: '100%', background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                <span style={{color: '#fff', fontSize: '14px', fontWeight: 'bold', textShadow: '0 0 3px #000'}}>{'+'}</span>
                             </div>
                             <input type="color" 
                                value={bgColor !== "transparent" ? bgColor : "#000000"} 
                                onChange={(e) => setBgColor(e.target.value)} 
                                style={{position: 'absolute', top: -5, left: -5, width: 40, height: 40, opacity: 0, cursor: 'pointer'}} 
                             />
                          </div>
                      </div>

                      <div className="ps-section-header">Quick Actions</div>
                      <div className="flex flex-col gap-2" style={{paddingLeft: '15px'}}>
                          <button className="ps-btn-gray ps-btn-blue" onClick={handleEnhance} disabled={status !== "Ready"}>
                              <Sparkle size={12} /> Photo Enhancer
                          </button>
                          <button className="ps-btn-gray" onClick={handleRemoveBackground} disabled={status.includes("Removing")}>
                              {status.includes("Removing") ? "Processing..." : "Remove Background"}
                          </button>
                          <button
                            className="ps-btn-gray"
                            style={{
                              borderColor: showScalePanel ? '#2e6ff7' : undefined,
                              color: showScalePanel ? '#7aaeff' : undefined,
                              background: showScalePanel ? 'rgba(46,111,247,0.15)' : undefined
                            }}
                            onClick={() => setShowScalePanel(p => !p)}
                            disabled={!image}
                          >
                            📏 Scale + Background Color
                          </button>
                          <button className="ps-btn-gray ps-btn-blue" onClick={addToQueue} disabled={!image} style={{marginTop: 6, backgroundColor: '#005bea'}}>
                              Collect for Multi-Print (+1)
                          </button>
                      </div>
                    </>
                  )}

                  {activeUpperTab === "Adjustments" && (
                    <>
                      <div className="ps-section-header first">Light & Color</div>
                      <div className="ps-slider-wrapper">
                         <span style={{width: 60}}>Brightness</span>
                         <input type="range" className="ps-slider" min="0" max="2" step="0.05" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} />
                         <span style={{width: 25, textAlign: 'right'}}>{brightness.toFixed(1)}</span>
                      </div>
                      <div className="ps-slider-wrapper">
                         <span style={{width: 60}}>Contrast</span>
                         <input type="range" className="ps-slider" min="0" max="2" step="0.05" value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))} />
                         <span style={{width: 25, textAlign: 'right'}}>{contrast.toFixed(1)}</span>
                      </div>
                      <div className="ps-slider-wrapper">
                         <span style={{width: 60}}>Saturation</span>
                         <input type="range" className="ps-slider" min="0" max="2" step="0.05" value={saturation} onChange={(e) => setSaturation(parseFloat(e.target.value))} />
                         <span style={{width: 25, textAlign: 'right'}}>{saturation.toFixed(1)}</span>
                      </div>
                      <div className="ps-slider-wrapper">
                         <span style={{width: 60}}>Skin Polish</span>
                         <input type="range" className="ps-slider" min="0" max="100" value={skinPolish} onChange={(e) => setSkinPolish(parseInt(e.target.value))} />
                         <span style={{width: 25, textAlign: 'right'}}>{skinPolish}%</span>
                      </div>

                      <div className="ps-section-header">Studio Presets</div>
                      <div className="grid grid-cols-2 gap-2 mt-2" style={{paddingLeft: 10}}>
                         <button className="ps-btn-gray" onClick={()=>applyPreset('natural')}>Natural Look</button>
                         <button className="ps-btn-gray" onClick={()=>applyPreset('warm')}>Warm Studio</button>
                         <button className="ps-btn-gray" onClick={()=>applyPreset('cold')}>Cold/Clean</button>
                         <button className="ps-btn-gray" onClick={()=>applyPreset('pop')}>Vibrant Pop</button>
                      </div>
                      
                      <div className="flex gap-2 mt-6">
                        <button className="ps-btn-gray" onClick={() => setIsBW(!isBW)}>
                          {isBW ? "Disable B&W" : "Enable B&W"}
                        </button>
                        <button className="ps-btn-gray" onClick={applyAdjustmentsPermanent}>Rasterize</button>
                      </div>
                    </>
                  )}

                  {activeUpperTab === "Libraries" && (
                    <div style={{padding: '10px'}}>
                       <div style={{fontSize: 12, color: '#aaa', borderBottom: '1px solid #333', paddingBottom: 5, marginBottom: 10, fontWeight: 600, display: 'flex', justifyContent: 'space-between'}}>
                          PROJECT ASSETS ({printQueue.length})
                          {selectedAssetIds.length > 0 && <span style={{color: '#2e6ff7'}}>{selectedAssetIds.length} Selected</span>}
                       </div>
                       
                       {printQueue.length === 0 ? (
                          <div style={{color: '#666', fontSize: 11, textAlign: 'center', marginTop: 20}}>
                             Collect photos here to combine them for printing.
                          </div>
                       ) : (
                          <div className="flex flex-col gap-2">
                             {printQueue.map(asset => (
                                <div key={asset.id} 
                                   onClick={() => toggleAssetSelection(asset.id)}
                                   style={{
                                      display: 'flex', alignItems: 'center', gap: 10, background: '#222', 
                                      padding: '5px 8px', borderRadius: 4, border: selectedAssetIds.includes(asset.id) ? '1px solid #2e6ff7' : '1px solid #333',
                                      cursor: 'pointer', position: 'relative'
                                   }}>
                                   {selectedAssetIds.includes(asset.id) && (
                                      <div style={{position: 'absolute', top: -5, left: -5, width: 14, height: 14, background: '#2e6ff7', borderRadius: '50%', border: '2px solid #111', zIndex: 5}} />
                                   )}
                                   <div style={{width: 32, height: 40, background: '#fff', padding: 1, borderRadius: 2}}>
                                      <img src={asset.img.src} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                   </div>
                                   <div style={{flex: 1, overflow: 'hidden'}}>
                                      <div style={{fontSize: 10, color: '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{asset.name}</div>
                                      <div style={{fontSize: 8, color: '#777'}}>Click to select</div>
                                   </div>
                                   <div style={{cursor: 'pointer', color: '#ff5555', fontSize: 14, padding: '0 5px'}} onClick={(e) => { e.stopPropagation(); removeFromQueue(asset.id); }}>×</div>
                                </div>
                             ))}
                             
                             <div className="flex flex-col gap-2 mt-4 pt-2" style={{borderTop: '1px solid #222'}}>
                                <button className="ps-btn-gray" style={{fontSize: 10}} onClick={() => setPrintQueue([])}>Clear All Assets</button>
                                {selectedAssetIds.length === 2 && (
                                   <button className="ps-btn-gray ps-btn-blue" style={{fontSize: 11, padding: '8px'}} onClick={() => setShowMergeModal(true)}>
                                      Merge Selected as Joint
                                   </button>
                                )}
                             </div>
                          </div>
                       )}
                    </div>
                  )}
                </div>
            </div>

            {/* Lower Panel Group */}
            <div className="ps-panel">
                <div className="ps-panel-tabs">
                    <div className={`ps-panel-tab ${activeLowerTab === "Layers" ? "active" : ""}`} onClick={()=>setActiveLowerTab("Layers")}>Layers</div>
                    <div className={`ps-panel-tab ${activeLowerTab === "Channels" ? "active" : ""}`} onClick={()=>setActiveLowerTab("Channels")}>Channels</div>
                    <div className={`ps-panel-tab ${activeLowerTab === "Paths" ? "active" : ""}`} onClick={()=>setActiveLowerTab("Paths")}>Paths</div>
                </div>

                <div className="ps-panel-content" style={{padding: 0}}>
                   {activeLowerTab === "Layers" && (
                      <>
                         <div className="flex items-center justify-between" style={{padding: '6px 10px', borderBottom: '1px solid #222'}}>
                            <select style={{background: '#222', color: '#aaa', border: '1px solid #1a1a1a', padding: '2px', fontSize: '10px', outline: 'none'}}>
                               <option>Normal</option>
                               <option>Multiply</option>
                               <option>Screen</option>
                               <option>Overlay</option>
                            </select>
                            <div className="flex items-center gap-1">
                               <span style={{color: '#aaa', fontSize: '10px'}}>Opacity:</span>
                               <input type="range" className="ps-slider" min="0" max="100" value={layerOpacity} onChange={(e) => setLayerOpacity(e.target.value)} style={{width: 50}} />
                               <span style={{width: 25, fontSize: '10px', textAlign: 'right'}}>{layerOpacity}%</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2" style={{padding: '6px 10px', borderBottom: '1px solid #222', color: '#aaa'}}>
                            Lock: <span style={{cursor:'pointer'}} title="Lock Transparent Pixels">❖</span> <span style={{cursor:'pointer'}} title="Lock Image Pixels">✦</span> <span style={{cursor:'pointer'}} title="Lock Position">✚</span> <span style={{cursor:'pointer'}} title="Lock All">🔒</span>
                            <span style={{marginLeft: 'auto'}}>Fill: 100%</span>
                        </div>
                        
                        <div className={`layer-row ${image ? 'active' : ''}`} style={{opacity: layerVisible ? 1 : 0.5}}>
                            <Eye size={14} color={layerVisible ? "#ccc" : "#444"} style={{cursor:'pointer'}} onClick={() => setLayerVisible(!layerVisible)} />
                            {image && (
                              <div className="layer-thumb" style={{backgroundImage: `url(${image.src})`, backgroundSize: 'cover', backgroundPosition: 'center'}} /> 
                            )}
                            {!image && <div className="layer-thumb" />}
                            <span style={{color: '#fff'}}>Layer 1</span>
                        </div>
                        {strokes.length > 0 && (
                          <div className="layer-row active">
                              <Eye size={14} color="#ccc" />
                              <div className="layer-thumb" style={{
                                backgroundColor: strokes[strokes.length-1].color, 
                                borderRadius: '50%',
                                opacity: strokes[strokes.length-1].opacity / 100,
                                transform: 'scale(0.8)'
                              }} />
                              <span style={{color: '#fff'}}>Brush Edits ({strokes.length})</span>
                          </div>
                        )}
                      </>
                   )}
                   {activeLowerTab === "Channels" && (
                       <div style={{color: '#888', textAlign: 'center', padding: '20px 0'}}>
                          RGB Channels are locked for Passport output.
                       </div>
                   )}
                   {activeLowerTab === "Paths" && (
                       <div style={{color: '#888', textAlign: 'center', padding: '20px 0'}}>
                          No working paths available.
                       </div>
                   )}
                </div>
            </div>
        </div>

      </div>

      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleOpen} />

      {showExportModal && (image || printQueue.length > 0) && (
         <ExportModal 
           activeImage={image} 
           activeBgColor={bgColor} 
           queue={printQueue} 
           onClose={() => setShowExportModal(false)} 
         />
      )}

      {showMergeModal && (
         <div className="export-modal-overlay">
            <div className="export-modal" style={{maxWidth: '400px', width: '90%'}}>
               <div className="export-modal-header">
                  <h3>Advanced Joint Photo Creator</h3>
                  <button className="ps-toolbar-btn" onClick={() => setShowMergeModal(false)} style={{width:30, height:30}}>×</button>
               </div>
               <div className="export-modal-content">
                  <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                     <div style={{display: 'flex', justifyContent: 'center', gap: 15}}>
                        {selectedAssetIds.map(id => {
                           const a = printQueue.find(qi => qi.id === id);
                           return <img key={id} src={a.img.src} style={{width: 60, height: 80, borderRadius: 4, border: '1px solid #444'}} />;
                        })}
                     </div>
                     
                     <div className="ps-section-header">Layout Orientation</div>
                     <div className="flex gap-4">
                        <label style={{color:'#eee', fontSize: 13, display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                           <input type="radio" checked={mergeSettings.orientation === 'vertical'} onChange={() => setMergeSettings(prev => ({...prev, orientation: 'vertical'}))} /> 
                           Vertical (Top/Bottom)
                        </label>
                        <label style={{color:'#eee', fontSize: 13, display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                           <input type="radio" checked={mergeSettings.orientation === 'horizontal'} onChange={() => setMergeSettings(prev => ({...prev, orientation: 'horizontal'}))} /> 
                           Horizontal (Side-by-Side)
                        </label>
                     </div>

                     <div className="flex items-center justify-between" style={{background: 'rgba(0,0,0,0.2)', padding:'10px', borderRadius:8}}>
                        <span style={{fontSize: 13, color:'#aaa'}}>Swap Positions</span>
                        <button className="ps-btn-gray" onClick={() => setMergeSettings(prev => ({...prev, swap: !prev.swap}))}>
                           {mergeSettings.swap ? "Reverse (B / A)" : "Normal (A / B)"}
                        </button>
                     </div>

                     <div style={{borderTop: '1px solid #333', paddingTop: 15, display: 'flex', justifyContent: 'flex-end', gap: 10}}>
                        <button className="ps-btn-gray" onClick={() => setShowMergeModal(false)}>Cancel</button>
                        <button className="ps-btn-gray ps-btn-blue" onClick={handleCreateJoint}>Create Combined Asset</button>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
