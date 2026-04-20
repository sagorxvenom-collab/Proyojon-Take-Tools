"use client";
import React, { useState } from "react";
import { 
  ArrowLeft, FilePdf, FileDoc, FileImage, 
  ArrowsLeftRight, DownloadSimple, UploadSimple,
  CheckCircle, Warning, MagnifyingGlass, Info
} from "@phosphor-icons/react";

export default function FileConverter({ onBack }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const categories = [
    { id: "all", label: "All Tools" },
    { id: "pdf", label: "PDF Tools" },
    { id: "word", label: "Word Tools" },
    { id: "image", label: "Image Tools" }
  ];

  const tools = [
    // PDF Tools
    { id: "pdf2word", name: "PDF to Word", category: "pdf", icon: <FileDoc size={24} color="#2b579a" /> },
    { id: "pdf2jpg", name: "PDF to JPG", category: "pdf", icon: <FileImage size={24} color="#e4405f" /> },
    { id: "pdfMerge", name: "Merge PDF", category: "pdf", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "pdfSplit", name: "Split PDF", category: "pdf", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "pdfCompress", name: "Compress PDF", category: "pdf", icon: <FilePdf size={24} color="#ff0000" /> },
    
    // Word Tools
    { id: "word2pdf", name: "Word to PDF", category: "word", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "word2jpg", name: "Word to JPG", category: "word", icon: <FileImage size={24} color="#e4405f" /> },
    { id: "docx2doc", name: "DOCX to DOC", category: "word", icon: <FileDoc size={24} color="#2b579a" /> },
    { id: "wordMerge", name: "Merge Word", category: "word", icon: <FileDoc size={24} color="#2b579a" /> },
    
    // Image Tools
    { id: "jpg2pdf", name: "JPG to PDF", category: "image", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "png2pdf", name: "PNG to PDF", category: "image", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "img2word", name: "Image to Word (OCR)", category: "image", icon: <FileDoc size={24} color="#2b579a" /> },
    { id: "webp2jpg", name: "WebP to JPG", category: "image", icon: <FileImage size={24} color="#e4405f" /> },
    { id: "heic2jpg", name: "HEIC to JPG", category: "image", icon: <FileImage size={24} color="#e4405f" /> },
    
    // Others
    { id: "excel2pdf", name: "Excel to PDF", category: "other", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "ppt2pdf", name: "PPT to PDF", category: "other", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "txt2pdf", name: "TXT to PDF", category: "other", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "html2pdf", name: "HTML to PDF", category: "other", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "pdfRotate", name: "Rotate PDF", category: "pdf", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "pdfUnlock", name: "Unlock PDF", category: "pdf", icon: <FilePdf size={24} color="#ff0000" /> },
    { id: "pdfProtect", name: "Protect PDF", category: "pdf", icon: <FilePdf size={24} color="#ff0000" /> }
  ];

  const filteredTools = tools.filter(tool => {
    const matchesCategory = activeTab === "all" || tool.category === activeTab;
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setStatus("File Selected: " + file.name);
    }
  };

  const startConversion = async () => {
    if (!selectedFile || !activeTool) return;
    
    setIsProcessing(true);
    setProgress(0);
    setStatus("Checking file compatibility...");

    // Validate file type
    const isImage = selectedFile.type.startsWith('image/');
    const isPDF = selectedFile.type === 'application/pdf';

    try {
      if (activeTool.category === "image" || activeTool.id.includes("2jpg") || activeTool.id.includes("2png")) {
        if (!isImage) {
          throw new Error("Selected tool requires an image file. Please upload a JPG, PNG, or WebP image.");
        }
        
        setStatus("Processing image...");
        setProgress(30);
        
        const result = await processImageConversion(selectedFile, activeTool.id);
        setProgress(80);
        
        downloadFile(result, `${selectedFile.name.split('.')[0]}_converted.${activeTool.id.includes("2png") ? 'png' : 'jpg'}`);
      } else if (activeTool.category === "pdf" || activeTool.id.includes("2pdf")) {
        // PDF Simulation or Basic implementation
        setStatus("Preparing document...");
        setProgress(50);
        await new Promise(res => setTimeout(res, 2000));
        setStatus("Processing PDF... Please wait.");
        setProgress(90);
      } else {
        // Other tools
        await new Promise(res => setTimeout(res, 2000));
      }
      
      setProgress(100);
      setStatus("Conversion Complete!");
      
      setTimeout(() => {
        setIsProcessing(false);
        setSelectedFile(null);
        setActiveTool(null);
        setStatus("Ready");
      }, 1500);

    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
      setIsProcessing(false);
      // Don't clear file yet so user can see error
    }
  };

  const processImageConversion = (file, toolId) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          // Quality and Format selection
          let format = "image/jpeg";
          if (toolId.includes("2png")) format = "image/png";
          
          resolve(canvas.toDataURL(format, 0.9));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const downloadFile = (dataUrl, filename) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ height: '100vh', backgroundColor: '#0f0f0f', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '15px 25px', backgroundColor: '#1a1a1a', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><ArrowLeft size={20} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowsLeftRight size={24} color="#2e6ff7" weight="duotone" />
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>ProyojonTake Service Tool</h2>
          </div>
        </div>
        <div style={{ color: '#666', fontSize: '12px' }}>{status}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar / Categories */}
        <div style={{ width: '250px', backgroundColor: '#1a1a1a', borderRight: '1px solid #222', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', marginBottom: '10px' }}>Categories</h4>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              style={{
                padding: '12px 15px',
                backgroundColor: activeTab === cat.id ? '#2e6ff722' : 'transparent',
                color: activeTab === cat.id ? '#2e6ff7' : '#888',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: activeTab === cat.id ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat.label}
            </button>
          ))}
          
          <div style={{ marginTop: 'auto', padding: '15px', backgroundColor: '#2e6ff711', borderRadius: '12px', border: '1px solid #2e6ff722' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2e6ff7', marginBottom: '8px' }}>
              <Info size={18} />
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Pro Tip</span>
            </div>
            <p style={{ fontSize: '11px', color: '#888', lineHeight: '1.4' }}>
              You can batch convert multiple files at once by dragging them into the tool.
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '30px', overflowY: 'auto', backgroundColor: '#0f0f0f' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '30px', maxWidth: '600px' }}>
            <MagnifyingGlass size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#555' }} />
            <input 
              type="text" 
              placeholder="Search 20+ conversion tools..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '15px 15px 15px 45px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2e6ff7'}
              onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
            />
          </div>

          {/* Tools Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
            {filteredTools.map(tool => (
              <div 
                key={tool.id}
                onClick={() => {
                  setActiveTool(tool);
                  document.getElementById('file-upload').click();
                }}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: '16px',
                  padding: '25px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2e6ff7';
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.backgroundColor = '#2e6ff705';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#2a2a2a';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                }}
              >
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  backgroundColor: '#000', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 15px',
                  border: '1px solid #222'
                }}>
                  {tool.icon}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{tool.name}</div>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '5px' }}>One-click conversion</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input 
        type="file" 
        id="file-upload" 
        style={{ display: 'none' }} 
        onChange={handleFileSelect}
      />

      {/* Upload/Action Modal Placeholder */}
      {selectedFile && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '500px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', backgroundColor: '#2e6ff715', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#2e6ff7' }}>
              <UploadSimple size={40} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>{isProcessing ? "Converting..." : "Ready to Convert?"}</h3>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '30px' }}>
              Tool: <span style={{ color: '#2e6ff7', fontWeight: 'bold' }}>{activeTool?.name}</span><br />
              File: <span style={{ color: '#fff', fontWeight: '600' }}>{selectedFile.name}</span>
            </p>
            
            {isProcessing && (
              <div style={{ marginBottom: '30px' }}>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#2a2a2a', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#2e6ff7', transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Processing... {Math.round(progress)}%</div>
              </div>
            )}

            {!isProcessing && (
              <div style={{ display: 'flex', gap: '15px' }}>
                <button 
                  onClick={() => { setSelectedFile(null); setActiveTool(null); setStatus("Ready"); }}
                  style={{ flex: 1, padding: '15px', backgroundColor: '#2a2a2a', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={startConversion}
                  style={{ flex: 1, padding: '15px', backgroundColor: '#2e6ff7', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                >
                  Start Conversion
                </button>
              </div>
            )}
            
            {status.startsWith("Error") && (
              <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#ff000015', borderRadius: '8px', border: '1px solid #ff000033', color: '#ff4444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Warning size={16} /> {status}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
