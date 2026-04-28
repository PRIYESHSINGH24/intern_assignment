import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDocument, getDocumentText } from '../api/client';
import { ChevronLeft, FileText, AlertTriangle, Clock, Users, Building, MapPin, DollarSign, CheckCircle, Copy, Eye } from 'lucide-react';

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

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>;
  if (!doc) return <div className="empty-state"><p>Document not found</p></div>;

  const entities = doc.key_entities || {};
  const dates = doc.important_dates || [];
  const flags = doc.red_flags || [];
  const meta = doc.ai_metadata || {};

  return (
    <div>
      <div className="flex gap-12" style={{ alignItems: 'center', marginBottom: 8 }}>
        <button className="btn btn-outline btn-sm btn-icon" onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
        <div className="page-header" style={{ margin: 0 }}>
          <div className="flex gap-12" style={{ alignItems: 'center' }}>
            <h2 style={{ fontSize: 22 }}>{doc.original_filename}</h2>
            <span className={`badge badge-${doc.status === 'completed' ? 'success' : doc.status === 'failed' ? 'danger' : doc.status === 'duplicate' ? 'purple' : 'muted'}`}>{doc.status}</span>
          </div>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex gap-16 mb-24" style={{ flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>File Type</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{doc.file_type?.toUpperCase()}</div>
        </div>
        <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Size</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{(doc.file_size / 1024).toFixed(1)} KB</div>
        </div>
        <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Doc Type</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{doc.document_type || 'Unknown'}</div>
        </div>
        <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confidence</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{doc.confidence_score ? `${(doc.confidence_score * 100).toFixed(0)}%` : '—'}</div>
        </div>
        {doc.is_duplicate && (
          <div className="card" style={{ padding: '12px 20px', flex: 1, minWidth: 150, borderColor: '#8b5cf6' }}>
            <div style={{ fontSize: 11, color: '#8b5cf6', textTransform: 'uppercase' }}>Duplicate</div>
            <div style={{ fontWeight: 600, marginTop: 2, color: '#8b5cf6' }}>{doc.similarity_score ? `${(doc.similarity_score * 100).toFixed(0)}% similar` : 'Exact'}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'entities', 'dates', 'red-flags', 'text'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="card mb-24">
            <div className="section-title">Summary</div>
            <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>{doc.summary || 'No summary available.'}</p>
          </div>
          {meta.additional && (
            <div className="card mb-24">
              <div className="section-title">Metadata</div>
              <div className="grid-2">
                <div>
                  <p style={{ fontSize: 13 }}><strong>Language:</strong> {meta.language || 'en'}</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}><strong>Tone:</strong> {meta.tone || 'neutral'}</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}><strong>Pages:</strong> {doc.page_count || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ fontSize: 13 }}><strong>OCR Applied:</strong> {doc.ocr_applied ? 'Yes' : 'No'}</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}><strong>Has Images:</strong> {doc.has_images ? 'Yes' : 'No'}</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}><strong>Text Length:</strong> {doc.text_length?.toLocaleString()} chars</p>
                </div>
              </div>
              {meta.additional?.requires_action && (
                <div className="flag-card medium" style={{ marginTop: 16 }}>
                  <div style={{ fontWeight: 600 }}>Action Required</div>
                  <ul style={{ marginTop: 6, paddingLeft: 20, fontSize: 13 }}>
                    {(meta.additional.action_items || []).map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'entities' && (
        <div className="grid-2">
          <div className="card">
            <div className="section-title"><Users size={16} /> Persons</div>
            {(entities.persons || []).length > 0
              ? entities.persons.map((p, i) => <span key={i} className="entity-tag person">{p}</span>)
              : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</p>}
          </div>
          <div className="card">
            <div className="section-title"><Building size={16} /> Organizations</div>
            {(entities.organizations || []).length > 0
              ? entities.organizations.map((o, i) => <span key={i} className="entity-tag org">{o}</span>)
              : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</p>}
          </div>
          <div className="card">
            <div className="section-title"><MapPin size={16} /> Locations</div>
            {(entities.locations || []).length > 0
              ? entities.locations.map((l, i) => <span key={i} className="entity-tag location">{l}</span>)
              : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</p>}
          </div>
          <div className="card">
            <div className="section-title"><DollarSign size={16} /> Monetary Values</div>
            {(entities.monetary_values || []).length > 0
              ? entities.monetary_values.map((m, i) => <span key={i} className="entity-tag money">{m}</span>)
              : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>None</p>}
          </div>
        </div>
      )}

      {tab === 'dates' && (
        <div className="card">
          {dates.length > 0 ? dates.map((d, i) => (
            <div key={i} className="timeline-item">
              <div className={`timeline-dot ${d.significance || 'medium'}`} />
              <div>
                <div style={{ fontWeight: 600 }}>{d.date}</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{d.context}</p>
              </div>
            </div>
          )) : <div className="empty-state"><p>No important dates found</p></div>}
        </div>
      )}

      {tab === 'red-flags' && (
        <div>
          {flags.length > 0 ? flags.map((f, i) => (
            <div key={i} className={`flag-card ${f.severity}`}>
              <div className="flex-between">
                <div style={{ fontWeight: 600 }}><AlertTriangle size={14} style={{ marginRight: 6 }} />{f.flag}</div>
                <span className={`badge badge-${f.severity === 'critical' || f.severity === 'high' ? 'danger' : f.severity === 'medium' ? 'warning' : 'info'}`}>{f.severity}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{f.detail}</p>
              {f.location && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Location: {f.location}</p>}
            </div>
          )) : <div className="empty-state"><p>No red flags detected</p></div>}
        </div>
      )}

      {tab === 'text' && (
        <div className="card">
          <div className="flex-between mb-16">
            <div className="section-title" style={{ margin: 0 }}>Extracted Text</div>
            <span className="badge badge-muted">{doc.text_length?.toLocaleString()} chars</span>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', maxHeight: 600, overflow: 'auto', background: 'var(--bg-input)', padding: 16, borderRadius: 8 }}>
            {text || 'No text extracted.'}
          </pre>
        </div>
      )}
    </div>
  );
}
