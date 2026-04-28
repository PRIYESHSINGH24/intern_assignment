import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocument, getDocumentText } from '../api/client';
import { ChevronLeft, FileText, AlertTriangle, Clock, Users, Building, MapPin, DollarSign, CheckCircle, Copy, Eye, FileSearch } from 'lucide-react';

export default function DocumentDetail() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [text, setText] = useState('');
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDocument(docId), getDocumentText(docId)])
      .then(([d, t]) => { setDoc(d); setText(t.text || ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) return (
    <div className="loading-container animate-in">
      <div className="loading-spinner" />
      <p style={{marginTop:16, fontWeight:600, letterSpacing:'2px', fontSize:12, textTransform:'uppercase'}}>Extracting Document Data...</p>
    </div>
  );
  if (!doc) return <div className="empty-state animate-in"><p>Document not found in pipeline</p></div>;

  const entities = doc.key_entities || {};
  const dates = doc.important_dates || [];
  const flags = doc.red_flags || [];
  const meta = doc.ai_metadata || {};

  return (
    <div style={{paddingBottom: 40}}>
      <div className="flex gap-12 animate-in" style={{ alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm btn-icon" onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
        <div className="page-header" style={{ margin: 0 }}>
          <div className="flex gap-12" style={{ alignItems: 'center' }}>
            <h2 style={{ fontSize: 26, margin: 0 }}>{doc.original_filename}</h2>
            <span className={`badge badge-${doc.status === 'completed' ? 'success' : doc.status === 'failed' ? 'danger' : doc.status === 'duplicate' ? 'purple' : 'muted'}`}>{doc.status}</span>
          </div>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex gap-16 mb-32 animate-in delay-100" style={{ flexWrap: 'wrap' }}>
        <div className="card card-premium" style={{ padding: '16px 20px', flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight:600, letterSpacing:'0.5px' }}>File Type</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4, color:'#fff' }}>{doc.file_type?.toUpperCase()}</div>
        </div>
        <div className="card card-premium" style={{ padding: '16px 20px', flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight:600, letterSpacing:'0.5px' }}>Payload Size</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4, color:'#fff' }}>{(doc.file_size / 1024).toFixed(1)} KB</div>
        </div>
        <div className="card card-premium" style={{ padding: '16px 20px', flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight:600, letterSpacing:'0.5px' }}>Doc Type Taxonomy</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4, color:'var(--accent)' }}>{doc.document_type || 'Unknown'}</div>
        </div>
        <div className="card card-premium" style={{ padding: '16px 20px', flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight:600, letterSpacing:'0.5px' }}>AI Confidence</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4, color: doc.confidence_score > 0.8 ? 'var(--success)' : 'var(--warning)' }}>{doc.confidence_score ? `${(doc.confidence_score * 100).toFixed(0)}%` : '—'}</div>
        </div>
        {doc.is_duplicate && (
          <div className="card card-premium" style={{ padding: '16px 20px', flex: 1, minWidth: 150, borderColor: 'rgba(139, 92, 246, 0.4)', background: 'rgba(139, 92, 246, 0.05)' }}>
            <div style={{ fontSize: 12, color: '#8b5cf6', textTransform: 'uppercase', fontWeight:600, letterSpacing:'0.5px' }}>Duplicate Status</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4, color: '#a78bfa' }}>{doc.similarity_score ? `${(doc.similarity_score * 100).toFixed(0)}% similar` : 'Exact'}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs animate-in delay-200">
        {['overview', 'entities', 'dates', 'red-flags', 'text'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in delay-300">
        {tab === 'overview' && (
          <div>
            <div className="card card-premium mb-24 animate-in">
              <div className="section-title"><FileText size={20} color="var(--accent)"/> Document Summary</div>
              <p style={{ lineHeight: 1.8, fontSize: 15, color: 'var(--text-secondary)' }}>{doc.summary || 'No summary sequence generated.'}</p>
            </div>
            {meta.additional && (
              <div className="card card-premium mb-24 animate-in delay-100">
                <div className="section-title"><FileSearch size={20} color="var(--info)"/> Deep AI Metadata</div>
                <div className="grid-2">
                  <div>
                    <p style={{ fontSize: 14, color: '#fff' }}><strong style={{color:'var(--text-muted)'}}>Language Matrix:</strong> {meta.language || 'en'}</p>
                    <p style={{ fontSize: 14, color: '#fff', marginTop: 10 }}><strong style={{color:'var(--text-muted)'}}>Semantic Tone:</strong> {meta.tone || 'neutral'}</p>
                    <p style={{ fontSize: 14, color: '#fff', marginTop: 10 }}><strong style={{color:'var(--text-muted)'}}>Page Count:</strong> {doc.page_count || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, color: '#fff' }}><strong style={{color:'var(--text-muted)'}}>Vision OCR Applied:</strong> {doc.ocr_applied ? <span style={{color:'var(--success)'}}>True</span> : 'False'}</p>
                    <p style={{ fontSize: 14, color: '#fff', marginTop: 10 }}><strong style={{color:'var(--text-muted)'}}>Contains Images:</strong> {doc.has_images ? 'True' : 'False'}</p>
                    <p style={{ fontSize: 14, color: '#fff', marginTop: 10 }}><strong style={{color:'var(--text-muted)'}}>Extracted Bytes:</strong> {doc.text_length?.toLocaleString()} chars</p>
                  </div>
                </div>
                {meta.additional?.requires_action && (
                  <div className="flag-card medium" style={{ marginTop: 24 }}>
                    <div style={{ fontWeight: 700, fontSize:15, color:'#fff' }}>System Action Required</div>
                    <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 14, color:'var(--text-secondary)' }}>
                      {(meta.additional.action_items || []).map((a, i) => <li key={i} style={{marginBottom: 6}}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'entities' && (
          <div className="grid-2 animate-in">
            <div className="card card-premium">
              <div className="section-title"><Users size={20} color="#8c9eff"/> Persons Identified</div>
              <div className="flex flex-wrap">
                {(entities.persons || []).length > 0
                  ? entities.persons.map((p, i) => <span key={i} className="entity-tag person">{p}</span>)
                  : <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>None identified</p>}
              </div>
            </div>
            <div className="card card-premium">
              <div className="section-title"><Building size={20} color="#33ffb8"/> Organizations Identified</div>
              <div className="flex flex-wrap">
                {(entities.organizations || []).length > 0
                  ? entities.organizations.map((o, i) => <span key={i} className="entity-tag org">{o}</span>)
                  : <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>None identified</p>}
              </div>
            </div>
            <div className="card card-premium">
              <div className="section-title"><MapPin size={20} color="#ffd670"/> Geographic Locations</div>
              <div className="flex flex-wrap">
                {(entities.locations || []).length > 0
                  ? entities.locations.map((l, i) => <span key={i} className="entity-tag location">{l}</span>)
                  : <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>None identified</p>}
              </div>
            </div>
            <div className="card card-premium">
              <div className="section-title"><DollarSign size={20} color="#d698f5"/> Financial Values</div>
              <div className="flex flex-wrap">
                {(entities.monetary_values || []).length > 0
                  ? entities.monetary_values.map((m, i) => <span key={i} className="entity-tag money">{m}</span>)
                  : <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>None identified</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'dates' && (
          <div className="card card-premium animate-in">
            {dates.length > 0 ? dates.map((d, i) => (
              <div key={i} className="timeline-item animate-in" style={{animationDelay: `${100 + i*50}ms`}}>
                <div className={`timeline-dot ${d.significance || 'medium'}`} />
                <div>
                  <div style={{ fontWeight: 700, fontSize:15, color:'#fff' }}>{d.date}</div>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{d.context}</p>
                </div>
              </div>
            )) : <div className="empty-state"><p>No critical chronological events found</p></div>}
          </div>
        )}

        {tab === 'red-flags' && (
          <div className="animate-in">
            {flags.length > 0 ? flags.map((f, i) => (
              <div key={i} className={`flag-card ${f.severity} animate-in`} style={{animationDelay: `${100 + i*50}ms`}}>
                <div className="flex-between">
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}><AlertTriangle size={16} style={{ marginRight: 8 }} />{f.flag}</div>
                  <span className={`badge badge-${f.severity === 'critical' || f.severity === 'high' ? 'danger' : f.severity === 'medium' ? 'warning' : 'info'}`}>{f.severity}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>{f.detail}</p>
                {f.location && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Source Location: <span style={{color:'var(--accent)'}}>{f.location}</span></p>}
              </div>
            )) : <div className="empty-state card card-premium"><p>No red flags detected in document</p></div>}
          </div>
        )}

        {tab === 'text' && (
          <div className="card card-premium animate-in">
            <div className="flex-between mb-24">
              <div className="section-title" style={{ margin: 0 }}>Raw Extracted Data</div>
              <span className="badge badge-muted">{doc.text_length?.toLocaleString()} sequence chars</span>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', maxHeight: 600, overflow: 'auto', background: 'rgba(5,5,10,0.8)', padding: 24, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
              {text || 'No text extracted.'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
