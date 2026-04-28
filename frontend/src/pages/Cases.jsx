import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCases, createCase, deleteCase } from '../api/client';
import { Plus, FolderOpen, Trash2, Search, X, Sparkles } from 'lucide-react';

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', description: '', priority: 'normal' });
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getCases(search ? `search=${search}` : '')
      .then(d => setCases(d.cases || []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      const c = await createCase(form);
      setShowModal(false);
      setForm({ name: '', description: '', priority: 'normal' });
      setToast({ type: 'success', message: `Case "${c.name}" created!` });
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (e) {
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
            Active Cases
          </h2>
          <p>Manage document cases and processing</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> New Case</button>
      </div>

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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{display:'flex', alignItems:'center', gap:10}}>
              <Sparkles size={24} color="var(--accent)" />
              Initialize New Case
            </h3>
            <div className="form-group">
              <label>Case Name *</label>
              <input className="form-input" placeholder="e.g., Smith v. Johnson 2024" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-input form-textarea" placeholder="Brief description of the case..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Priority Matrix</label>
              <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low Priority</option>
                <option value="normal">Standard Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Processing</option>
              </select>
            </div>
            <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginTop: 32 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name.trim()}>Create Case</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
