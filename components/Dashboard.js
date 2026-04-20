"use client";
import React, { useState, useEffect } from "react";
import { 
  Camera, ImageSquare, Sparkle, Stack, 
  Files, Browsers, Gear, Question, ArrowsLeftRight, LockKey, SignOut
} from "@phosphor-icons/react";
import PhotoStudio from "./PhotoStudio";
import DocScanner from "./DocScanner";
import NIDMaker from "./NIDMaker";
import FileConverter from "./FileConverter";

export default function Dashboard() {
  const [activeApp, setActiveApp] = useState("loading");
  const [loginData, setLoginData] = useState({ user: "", pass: "" });
  const [loginError, setLoginError] = useState("");

  // Session Management (12 Hours)
  useEffect(() => {
    const session = localStorage.getItem("proyojon_session");
    if (session) {
      const { expiry } = JSON.parse(session);
      if (new Date().getTime() < expiry) {
        setActiveApp("dashboard");
      } else {
        localStorage.removeItem("proyojon_session");
        setActiveApp("login");
      }
    } else {
      setActiveApp("login");
    }
  }, []);

  const handleLogin = () => {
    if (loginData.user === "admin" && loginData.pass === "admin") {
      const expiry = new Date().getTime() + (12 * 60 * 60 * 1000); // 12 Hours
      localStorage.setItem("proyojon_session", JSON.stringify({ user: "admin", expiry }));
      setActiveApp("dashboard");
      setLoginError("");
    } else {
      setLoginError("Invalid username or password");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("proyojon_session");
    setActiveApp("login");
  };

  const tools = [
    {
      id: "studio",
      name: "Photo Studio",
      desc: "Passport & Editing Suite",
      icon: <Camera size={32} weight="duotone" />,
      color: "#2e6ff7",
      status: "Active"
    },
    {
      id: "scanner",
      name: "Doc Scanner",
      desc: "CamScanner style cleanup & Perspective Fix",
      icon: <Files size={32} weight="duotone" />,
      color: "#10b981",
      status: "Active"
    },
    {
      id: "nid",
      name: "NID Maker",
      desc: "Auto A4 Layout for NID Front & Back",
      icon: <ImageSquare size={32} weight="duotone" />,
      color: "#f59e0b",
      status: "Active"
    },
    {
      id: "converter",
      name: "File Converter",
      desc: "20+ PDF, Word & Image Tools",
      icon: <ArrowsLeftRight size={32} weight="duotone" />,
      color: "#2e6ff7",
      status: "Active"
    },
    {
      id: "batch",
      name: "Batch Process",
      desc: "Bulk BG Removal & Enhance",
      icon: <Sparkle size={32} weight="duotone" />,
      color: "#f59e0b",
      status: "Coming Soon"
    },
    {
      id: "templates",
      name: "Design Templates",
      desc: "Social Media & Print Layouts",
      icon: <Stack size={32} weight="duotone" />,
      color: "#ec4899",
      status: "Coming Soon"
    }
  ];

  if (activeApp === "loading") {
    return <div style={{ height: '100vh', backgroundColor: '#0f0f0f' }} />;
  }

  if (activeApp === "login") {
    return (
      <div style={{ height: '100vh', backgroundColor: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ width: '100%', maxWidth: '400px', padding: '40px', backgroundColor: '#1a1a1a', borderRadius: '24px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#2e6ff715', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2e6ff7', margin: '0 auto 24px' }}>
            <Gear size={32} weight="duotone" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>Admin Login</h2>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '32px' }}>Enter your credentials to access tools</p>
          
          <div style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '8px' }}>Username</label>
            <input 
              type="text" 
              value={loginData.user}
              onChange={(e) => setLoginData({...loginData, user: e.target.value})}
              style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '12px', color: '#fff', outline: 'none' }}
              placeholder="Enter admin username"
            />
          </div>
          
          <div style={{ textAlign: 'left', marginBottom: '32px' }}>
            <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '8px' }}>Password</label>
            <input 
              type="password" 
              value={loginData.pass}
              onChange={(e) => setLoginData({...loginData, pass: e.target.value})}
              style={{ width: '100%', padding: '12px 16px', backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '12px', color: '#fff', outline: 'none' }}
              placeholder="Enter password"
            />
          </div>

          {loginError && <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '16px' }}>{loginError}</p>}

          <button 
            onClick={handleLogin}
            style={{ width: '100%', padding: '14px', backgroundColor: '#2e6ff7', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '16px' }}
          >
            Login to Workspace
          </button>
          
          <p style={{ marginTop: '24px', fontSize: '11px', color: '#444' }}>ProyojonTake Service Tool v2.0.4</p>
        </div>
      </div>
    );
  }

  if (activeApp === "studio") {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <button 
          onClick={() => setActiveApp("dashboard")}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 1000,
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #444',
            padding: '5px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Browsers size={14} /> Back to Dashboard
        </button>
        <PhotoStudio />
      </div>
    );
  }

  if (activeApp === "scanner") {
    return <DocScanner onBack={() => setActiveApp("dashboard")} />;
  }

  if (activeApp === "nid") {
    return <NIDMaker onBack={() => setActiveApp("dashboard")} />;
  }

  if (activeApp === "converter") {
    return <FileConverter onBack={() => setActiveApp("dashboard")} />;
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#0f0f0f', 
      color: '#fff', 
      fontFamily: 'system-ui, sans-serif',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <header style={{ marginBottom: '50px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '700', marginBottom: '10px', letterSpacing: '-1px' }}>
            ProyojonTake <span style={{ color: '#2e6ff7' }}>Service Tool</span>
          </h1>
          <p style={{ color: '#888', fontSize: '16px' }}>Select a tool to begin your professional workflow</p>
        </header>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '25px',
          marginBottom: '60px'
        }}>
          {tools.map((tool) => (
            <div 
              key={tool.id}
              onClick={() => tool.status === "Active" && setActiveApp(tool.id)}
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '16px',
                padding: '30px',
                cursor: tool.status === "Active" ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                opacity: tool.status === "Active" ? 1 : 0.6
              }}
              onMouseEnter={(e) => {
                if (tool.status === "Active") {
                  e.currentTarget.style.borderColor = tool.color;
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = `0 10px 30px -10px ${tool.color}44`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#2a2a2a';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ 
                width: '60px', 
                height: '60px', 
                backgroundColor: `${tool.color}15`, 
                borderRadius: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: tool.color,
                marginBottom: '20px'
              }}>
                {tool.icon}
              </div>
              
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>{tool.name}</h3>
              <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>{tool.desc}</p>
              
              <div style={{ 
                marginTop: '20px', 
                fontSize: '11px', 
                fontWeight: '700', 
                textTransform: 'uppercase', 
                letterSpacing: '1px',
                color: tool.status === "Active" ? tool.color : '#444'
              }}>
                {tool.status}
              </div>
            </div>
          ))}
        </div>

        <footer style={{ 
          borderTop: '1px solid #222', 
          paddingTop: '30px', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#444'
        }}>
          <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Gear size={14} /> Settings</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Question size={14} /> Help Center</span>
            <button 
              onClick={handleLogout}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                color: '#fff',
                backgroundColor: '#ef444422',
                border: '1px solid #ef444433',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ef444444'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef444422'}
            >
              <SignOut size={14} weight="bold" /> Logout
            </button>
          </div>
          <div style={{ fontSize: '12px' }}>v2.0.4 Premium Edition</div>
        </footer>
      </div>
    </div>
  );
}
