import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { getCases, createCase, deleteCase, uploadDocuments, getDashboardStats } from '../api/client';
import { Plus, FolderOpen, Trash2, Search, X, Sparkles, Upload, File as FileIcon, Activity, AlertTriangle, FileText } from 'lucide-react';

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', description: '', priority: 'normal' });
  const [filesToUpload, setFilesToUpload] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const load = useCallback((searchTerm) => {
    setLoading(true);
    
    // Fetch cases (fast)
    getCases(searchTerm ? `search=${searchTerm}` : '')
      .then(d => setCases(d.cases || []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
      
    // Fetch stats separately (slower) so it doesn't block the table loading
    if (!stats) {
      getDashboardStats()
        .then(s => setStats(s))
        .catch(() => null);
    }
  }, [stats]);

  // Initial load
  useEffect(() => { 
    if (!stats) load(''); 
  }, [load, stats]);

  // Debounced Search load
  useEffect(() => {
    const handler = setTimeout(() => {
      load(search);
    }, 400); // 400ms debounce
    return () => clearTimeout(handler);
  }, [search, load]);

  const onDrop = useCallback((acceptedFiles) => {
    setFilesToUpload(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const removeFile = (index) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      setUploading(true);
      const c = await createCase(form);
      
      if (filesToUpload.length > 0) {
        await uploadDocuments(c.id, filesToUpload, (progress) => {
          setUploadProgress(progress);
        });
      }

      setShowModal(false);
      setForm({ name: '', description: '', priority: 'normal' });
      setFilesToUpload([]);
      setUploading(false);
      setUploadProgress(0);
      setToast({ type: 'success', message: `Case "${c.name}" created!` });
      
      // Auto-navigate to the new case
      navigate(`/cases/${c.id}`);
    } catch (e) {
      setUploading(false);
      setToast({ type: 'error', message: e.message });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!confirm(`Delete case "${name}"? This will remove all documents.`)) return;
    try {
      await deleteCase(id);
      setToast({ type: 'success', message: 'Case deleted' });
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (e) {
      setToast({ type: 'error', message: e.message });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const statusBadge = (s) => {
    const map = { completed: 'success', processing: 'info', failed: 'danger', created: 'muted', partially_completed: 'warning' };
    return <span className={`badge badge-${map[s] || 'muted'}`}>{s === 'processing' && <span className="pulse-dot" style={{marginRight:6}}/>}{s.replace('_', ' ')}</span>;
  };

  return (
    <div style={{paddingBottom: 40}}>
      <div className="flex-between page-header animate-in">
        <div>
          <h2 style={{display:'flex', alignItems:'center', gap:12}}>
            <FolderOpen color="var(--accent)" size={32} />
            Global Workspace
          </h2>
          <p>Manage document cases and organizational intelligence</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> New Case</button>
      </div>

      {stats && (
        <div className="stats-grid animate-in delay-100 mb-32" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="card card-premium stat-card info">
            <div className="flex-between"><Activity size={20} color="var(--info)"/><div className="stat-value">{stats.total_cases}</div></div>
            <div className="stat-label">Total Cases</div>
          </div>
          <div className="card card-premium stat-card success">
            <div className="flex-between"><FileText size={20} color="var(--success)"/><div className="stat-value">{stats.total_processed}</div></div>
            <div className="stat-label">Documents Processed</div>
          </div>
          <div className="card card-premium stat-card warning">
            <div className="flex-between"><AlertTriangle size={20} color="var(--warning)"/><div className="stat-value" style={{color: stats.total_red_flags > 0 ? 'var(--warning)' : 'inherit'}}>{stats.total_red_flags}</div></div>
            <div className="stat-label">Global Red Flags</div>
          </div>
          <div className="card card-premium stat-card purple">
            <div className="flex-between"><Sparkles size={20} color="#9b59b6"/><div className="stat-value">{stats.total_duplicates}</div></div>
            <div className="stat-label">Duplicates Caught</div>
          </div>
        </div>
      )}

      <div className="animate-in delay-100" style={{ marginBottom: 24 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={18} style={{ position: 'absolute', left: 16, top: 14, color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="Search active cases..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 44, height: 48, borderRadius: 24, background: 'rgba(10,10,15,0.6)' }} />
          {search && <X size={18} style={{ position: 'absolute', right: 16, top: 14, color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSearch('')} />}
        </div>
      </div>

      {loading ? (
        <div className="loading-container animate-in delay-200">
          <div className="loading-spinner" />
          <p style={{marginTop:16, fontWeight:600, letterSpacing:'2px', fontSize:12, textTransform:'uppercase'}}>Fetching Cases...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="empty-state animate-in delay-200">
          <div className="empty-state-icon"><FolderOpen size={36} /></div>
          <h3 style={{ marginBottom: 8, fontSize: 24, color: '#fff' }}>No cases found</h3>
          <p>Create your first case to start processing documents</p>
          <button className="btn btn-gradient-pulse" style={{ marginTop: 24, padding: '0 24px' }} onClick={() => setShowModal(true)}><Plus size={18} /> Create Case</button>
        </div>
      ) : (
        <div className="table-container card-premium animate-in delay-200">
          <table>
            <thead><tr><th>Case Name</th><th>Status</th><th>Priority</th><th>Documents</th><th>Processed</th><th>Failed</th><th>Duplicates</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {cases.map((c, i) => (
                <tr key={c.id} 
                    className="animate-in hover-glow" 
                    style={{ animationDelay: `${200 + (i * 50)}ms`, cursor: 'pointer' }}
                    onClick={() => navigate(`/cases/${c.id}`)}>
                  <td style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>{c.name}</td>
                  <td>{statusBadge(c.status)}</td>
                  <td><span className={`badge badge-${c.priority === 'urgent' ? 'danger' : c.priority === 'high' ? 'warning' : 'muted'}`}>{c.priority}</span></td>
                  <td>{c.total_documents}</td>
                  <td style={{ color: 'var(--success)' }}>{c.processed_documents}</td>
                  <td style={{ color: c.failed_documents > 0 ? 'var(--danger)' : 'inherit' }}>{c.failed_documents}</td>
                  <td style={{ color: c.duplicate_documents > 0 ? '#9b59b6' : 'inherit' }}>{c.duplicate_documents}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td><button className="btn btn-danger btn-icon btn-sm" onClick={e => handleDelete(e, c.id, c.name)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => !uploading && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: 600}}>
            <h3 style={{display:'flex', alignItems:'center', gap:10}}>
              <Sparkles size={24} color="var(--accent)" />
              Initialize New Case
            </h3>
            <div className="form-group">
              <label>Case Name *</label>
              <input className="form-input" placeholder="e.g., Smith v. Johnson 2024" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus disabled={uploading}/>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-input form-textarea" placeholder="Brief description of the case..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} disabled={uploading}/>
            </div>
            <div className="form-group">
              <label>Priority Matrix</label>
              <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} disabled={uploading}>
                <option value="low">Low Priority</option>
                <option value="normal">Standard Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Processing</option>
              </select>
            </div>

            <div className="form-group" style={{marginTop: 24}}>
              <label>Initial Documents (Optional)</label>
              <div {...getRootProps()} className={`dropzone ${isDragActive?'active':''}`} style={{padding: '24px 16px', minHeight: 120, opacity: uploading ? 0.5 : 1, pointerEvents: uploading ? 'none' : 'auto'}}>
                <input {...getInputProps()} />
                <div className="dropzone-icon" style={{width:40,height:40}}><Upload size={20}/></div>
                <p style={{fontWeight:600, fontSize:14, marginBottom:4, color:'#fff'}}>Drag & drop files here</p>
                <p style={{fontSize:12,color:'var(--text-muted)'}}>Upload initial documents now or later</p>
              </div>
              
              {filesToUpload.length > 0 && (
                <div style={{marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto'}}>
                  {filesToUpload.map((f, i) => (
                    <div key={i} className="flex-between" style={{background:'rgba(255,255,255,0.05)', padding:'8px 12px', borderRadius:8}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, overflow:'hidden'}}>
                        <FileIcon size={14} color="var(--accent)"/>
                        <span style={{fontSize:13, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.name}</span>
                      </div>
                      {!uploading && <button className="btn btn-icon btn-sm" onClick={() => removeFile(i)} style={{color:'var(--danger)'}}><X size={14}/></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {uploading && filesToUpload.length > 0 && (
              <div style={{marginTop: 20}}>
                <div className="flex-between mb-8">
                  <span style={{fontSize:13, fontWeight:600, color:'#fff'}}>Uploading Payload...</span>
                  <span style={{fontSize:13, color:'var(--accent)', fontWeight:700}}>{uploadProgress}%</span>
                </div>
                <div className="progress-bar" style={{height: 6}}><div className="progress-fill" style={{width:`${uploadProgress}%`}}/></div>
              </div>
            )}

            <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 32 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)} disabled={uploading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name.trim() || uploading}>
                {uploading ? 'Initializing...' : 'Create Case & Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
