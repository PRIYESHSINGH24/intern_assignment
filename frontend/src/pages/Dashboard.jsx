import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../api/client';
import { FileText, FolderOpen, CheckCircle, AlertTriangle, XCircle, Copy, HardDrive, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-container"><div className="loading-spinner" /><p style={{marginTop:16}}>Loading dashboard...</p></div>;

  const s = stats || { total_cases:0, total_documents:0, total_processed:0, total_failed:0, total_duplicates:0, total_red_flags:0, storage_used_bytes:0, recent_cases:[], document_type_distribution:{} };

  const pieData = Object.entries(s.document_type_distribution || {}).map(([name, value]) => ({ name, value }));
  const barData = Object.entries(s.document_type_distribution || {}).map(([name, value]) => ({ name: name.replace(/_/g,' '), count: value }));

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your document intelligence pipeline</p>
      </div>

      <div className="stats-grid">
        <div className="card stat-card accent">
          <div className="stat-icon accent"><FolderOpen size={20} /></div>
          <div className="stat-value">{s.total_cases}</div>
          <div className="stat-label">Total Cases</div>
        </div>
        <div className="card stat-card info">
          <div className="stat-icon info"><FileText size={20} /></div>
          <div className="stat-value">{s.total_documents}</div>
          <div className="stat-label">Total Documents</div>
        </div>
        <div className="card stat-card success">
          <div className="stat-icon success"><CheckCircle size={20} /></div>
          <div className="stat-value">{s.total_processed}</div>
          <div className="stat-label">Processed</div>
        </div>
        <div className="card stat-card danger">
          <div className="stat-icon danger"><XCircle size={20} /></div>
          <div className="stat-value">{s.total_failed}</div>
          <div className="stat-label">Failed</div>
        </div>
        <div className="card stat-card purple">
          <div className="stat-icon purple"><Copy size={20} /></div>
          <div className="stat-value">{s.total_duplicates}</div>
          <div className="stat-label">Duplicates</div>
        </div>
        <div className="card stat-card warning">
          <div className="stat-icon warning"><AlertTriangle size={20} /></div>
          <div className="stat-value">{s.total_red_flags}</div>
          <div className="stat-label">Red Flags</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">Document Type Distribution</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" label={({name,value}) => `${name} (${value})`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{background:'#1a2035',border:'1px solid #2a3a5c',borderRadius:8,color:'#f0f4ff'}} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{padding:40}}><p>No data yet. Process some documents to see distribution.</p></div>
          )}
        </div>

        <div className="card">
          <div className="flex-between mb-16">
            <div className="section-title" style={{margin:0}}>Recent Cases</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/cases')}>View All</button>
          </div>
          {(s.recent_cases || []).length > 0 ? s.recent_cases.map(c => (
            <div key={c.id} onClick={() => navigate(`/cases/${c.id}`)} style={{padding:'12px 0',borderBottom:'1px solid var(--border)',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{c.name}</div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{c.total_documents} docs</div>
              </div>
              <span className={`badge badge-${c.status === 'completed' ? 'success' : c.status === 'processing' ? 'info' : c.status === 'failed' ? 'danger' : 'muted'}`}>
                {c.status === 'processing' && <span className="pulse-dot" />}
                {c.status}
              </span>
            </div>
          )) : (
            <div className="empty-state" style={{padding:40}}><p>No cases yet. Create one to get started!</p></div>
          )}
        </div>
      </div>

      <div className="card" style={{marginTop:24}}>
        <div className="section-title">Storage Usage</div>
        <div className="flex gap-16" style={{alignItems:'center'}}>
          <HardDrive size={24} style={{color:'var(--accent)'}} />
          <div>
            <div style={{fontSize:20,fontWeight:700}}>{formatBytes(s.storage_used_bytes)}</div>
            <div style={{fontSize:13,color:'var(--text-muted)'}}>Total storage used across all cases</div>
          </div>
        </div>
      </div>
    </div>
  );
}
