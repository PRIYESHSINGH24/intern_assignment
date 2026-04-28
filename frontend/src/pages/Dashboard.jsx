import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../api/client';
import { FileText, FolderOpen, CheckCircle, AlertTriangle, XCircle, Copy, HardDrive, Sparkles, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#5e6ad2', '#00d285', '#ffb020', '#ff4757', '#00a8ff', '#9b59b6', '#ec4899', '#14b8a6'];

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

  if (loading) return (
    <div className="loading-container animate-in">
      <div className="loading-spinner" />
      <p style={{marginTop:16, fontWeight:600, letterSpacing:'2px', fontSize:12, textTransform:'uppercase'}}>Initializing Neural Link...</p>
    </div>
  );

  const s = stats || { total_cases:0, total_documents:0, total_processed:0, total_failed:0, total_duplicates:0, total_red_flags:0, storage_used_bytes:0, recent_cases:[], document_type_distribution:{} };

  const pieData = Object.entries(s.document_type_distribution || {}).map(([name, value]) => ({ name, value }));

  return (
    <div style={{paddingBottom: 40}}>
      <div className="page-header animate-in">
        <h2 style={{display:'flex', alignItems:'center', gap:12}}>
          <Sparkles color="var(--accent)" size={32} />
          DocIntel Command Center
        </h2>
        <p>Enterprise Document Intelligence & Case Analytics</p>
      </div>

      <div className="stats-grid">
        <div className="card card-premium stat-card animate-in delay-100">
          <div className="stat-icon accent"><FolderOpen size={24} /></div>
          <div className="stat-value">{s.total_cases}</div>
          <div className="stat-label">Active Cases</div>
        </div>
        <div className="card card-premium stat-card animate-in delay-100">
          <div className="stat-icon info"><FileText size={24} /></div>
          <div className="stat-value">{s.total_documents}</div>
          <div className="stat-label">Ingested Documents</div>
        </div>
        <div className="card card-premium stat-card animate-in delay-200">
          <div className="stat-icon success"><CheckCircle size={24} /></div>
          <div className="stat-value">{s.total_processed}</div>
          <div className="stat-label">Processed via AI</div>
        </div>
        <div className="card card-premium stat-card animate-in delay-200">
          <div className="stat-icon danger"><XCircle size={24} /></div>
          <div className="stat-value">{s.total_failed}</div>
          <div className="stat-label">Processing Failed</div>
        </div>
        <div className="card card-premium stat-card animate-in delay-300">
          <div className="stat-icon" style={{background:'rgba(155, 89, 182, 0.15)', color:'#9b59b6'}}><Copy size={24} /></div>
          <div className="stat-value">{s.total_duplicates}</div>
          <div className="stat-label">Near-Duplicates</div>
        </div>
        <div className="card card-premium stat-card animate-in delay-300">
          <div className="stat-icon warning"><AlertTriangle size={24} /></div>
          <div className="stat-value" style={{color: s.total_red_flags > 0 ? 'var(--warning)' : 'inherit'}}>{s.total_red_flags}</div>
          <div className="stat-label">Red Flags Detected</div>
        </div>
      </div>

      <div className="grid-2 animate-in delay-400">
        <div className="card card-premium">
          <div className="section-title">
            <Activity size={20} color="var(--accent)" />
            Document Taxonomy
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie 
                  data={pieData} 
                  cx="50%" cy="50%" 
                  innerRadius={70} 
                  outerRadius={100} 
                  paddingAngle={8} 
                  dataKey="value" 
                  label={({name,value}) => `${name} (${value})`} 
                  labelLine={false}
                  stroke="none"
                  cornerRadius={6}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} style={{filter: `drop-shadow(0px 0px 8px ${COLORS[i % COLORS.length]}88)`}} />)}
                </Pie>
                <Tooltip 
                  contentStyle={{background:'rgba(10,10,15,0.9)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, color:'#fff', backdropFilter:'blur(10px)', boxShadow:'0 10px 30px rgba(0,0,0,0.5)'}}
                  itemStyle={{color: '#fff', fontWeight: 600}}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{padding:60}}><p>No data yet. Process some documents to populate the taxonomy.</p></div>
          )}
        </div>

        <div className="card card-premium">
          <div className="flex-between mb-16">
            <div className="section-title" style={{margin:0}}>
              <FolderOpen size={20} color="var(--accent)" />
              Recent Cases
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/cases')}>View All</button>
          </div>
          {(s.recent_cases || []).length > 0 ? s.recent_cases.map((c, i) => (
            <div key={c.id} 
              className="animate-in" 
              style={{animationDelay: `${400 + (i * 100)}ms`, padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.2s', borderRadius: 8}}
              onClick={() => navigate(`/cases/${c.id}`)}
              onMouseOver={(e) => {e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}}
              onMouseOut={(e) => {e.currentTarget.style.background = 'transparent'}}
            >
              <div>
                <div style={{fontWeight:600,fontSize:15, color:'#fff'}}>{c.name}</div>
                <div style={{fontSize:13,color:'var(--text-muted)',marginTop:4}}>{c.total_documents} documents indexed</div>
              </div>
              <span className={`badge badge-${c.status === 'completed' ? 'success' : c.status === 'processing' ? 'info' : c.status === 'failed' ? 'danger' : 'muted'}`}>
                {c.status === 'processing' && <span className="pulse-dot" style={{marginRight:6}} />}
                {c.status}
              </span>
            </div>
          )) : (
            <div className="empty-state" style={{padding:60}}><p>No cases yet. Initialize a new case to get started.</p></div>
          )}
        </div>
      </div>

      <div className="card card-premium animate-in delay-500" style={{marginTop:32}}>
        <div className="flex-between">
          <div className="flex gap-16" style={{alignItems:'center'}}>
            <div style={{width: 56, height: 56, background: 'rgba(94, 106, 210, 0.15)', borderRadius: 16, display: 'flex', alignItems:'center', justifyContent:'center'}}>
              <HardDrive size={28} style={{color:'var(--accent)'}} />
            </div>
            <div>
              <div className="section-title" style={{margin:0}}>Storage Allocation</div>
              <div style={{fontSize:14,color:'var(--text-muted)', marginTop:4}}>Total storage consumed by ingested documents</div>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontFamily: 'Outfit', fontSize:32,fontWeight:700, letterSpacing:'-1px'}}>{formatBytes(s.storage_used_bytes)}</div>
            <div style={{fontSize:13, color:'var(--success)', fontWeight:600}}>System Optimal</div>
          </div>
        </div>
      </div>
    </div>
  );
}
