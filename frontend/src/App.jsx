import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, FileText, Shield, Activity } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import DocumentDetail from './pages/DocumentDetail';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>DocIntel</h1>
            <span>Intelligence Pipeline</span>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} /> <span>Dashboard</span>
            </NavLink>
            <NavLink to="/cases" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <FolderOpen size={18} /> <span>Cases</span>
            </NavLink>
          </nav>
          <div style={{padding:'0 12px', marginTop:'auto'}}>
            <div className="card" style={{padding:'14px', background:'var(--bg-input)', fontSize:'12px', color:'var(--text-muted)'}}>
              <div style={{fontWeight:600, color:'var(--text-secondary)', marginBottom:4}}>DocIntel v1.0</div>
              Powered by Gemini AI
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
