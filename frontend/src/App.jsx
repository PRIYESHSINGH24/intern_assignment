import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Shield, Hexagon } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import DocumentDetail from './pages/DocumentDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Ambient Global Orbs */}
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>

        <aside className="sidebar sidebar-premium">
          <div className="sidebar-logo">
            <h1><Hexagon size={28} className="text-accent" style={{color: 'var(--accent)'}}/> DocIntel</h1>
            <span>Intelligence Pipeline</span>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} /> <span>Command Center</span>
            </NavLink>
            <NavLink to="/cases" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <FolderOpen size={20} /> <span>Active Cases</span>
            </NavLink>
          </nav>
          <div style={{padding:'0 20px', marginTop:'auto', marginBottom: '20px'}}>
            <div className="card card-glass" style={{padding:'16px', borderRadius:'16px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)'}}>
              <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px'}}>
                <Shield size={24} color="var(--success)" />
                <div>
                  <div style={{fontSize:'13px', fontWeight:700, color:'#fff'}}>AI Engine Live</div>
                  <div style={{fontSize:'11px', color:'var(--success)', letterSpacing:'0.5px'}}>GEMINI 2.0 FLASH</div>
                </div>
              </div>
              <div className="progress-bar" style={{height:'4px', background:'rgba(255,255,255,0.1)'}}>
                <div className="progress-fill" style={{width:'100%', background:'var(--success)'}}></div>
              </div>
            </div>
          </div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/cases/:caseId" element={<CaseDetail />} />
            <Route path="/documents/:docId" element={<DocumentDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
