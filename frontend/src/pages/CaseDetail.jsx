import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { getCase, getDocuments, uploadDocuments, startProcessing, reprocessCase, getCaseStatus, getCaseSummary, getCaseRedFlags, getCaseTimeline } from '../api/client';
import { Upload, Play, RefreshCw, FileText, AlertTriangle, Clock, Users, Building, MapPin, DollarSign, ChevronLeft, CheckCircle, XCircle, Copy, Eye } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function formatBytes(b) {
  if (!b) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b)/Math.log(k));
  return (b/Math.pow(k,i)).toFixed(1)+' '+s[i];
}

export default function CaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [redFlags, setRedFlags] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('documents');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => { setToast({type,message}); setTimeout(()=>setToast(null),3000); };

  const loadAll = useCallback(async () => {
    try {
      const [c, d] = await Promise.all([getCase(caseId), getDocuments(caseId)]);
      setCaseData(c);
      setDocuments(d.documents || []);
      try { setSummary(await getCaseSummary(caseId)); } catch {}
      try { setRedFlags(await getCaseRedFlags(caseId)); } catch {}
      try { setTimeline(await getCaseTimeline(caseId)); } catch {}
      try { setStatus(await getCaseStatus(caseId)); } catch {}
    } catch { showToast('error','Failed to load case'); }
    setLoading(false);
  }, [caseId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Poll status while processing
  useEffect(() => {
    if (caseData?.status !== 'processing') return;
    const interval = setInterval(async () => {
      try {
        const [c, d, st] = await Promise.all([getCase(caseId), getDocuments(caseId), getCaseStatus(caseId)]);
        setCaseData(c); setDocuments(d.documents||[]); setStatus(st);
        if (c.status !== 'processing') { clearInterval(interval); loadAll(); }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [caseData?.status, caseId, loadAll]);

  const onDrop = useCallback(async (files) => {
    setUploading(true);
    try {
      const res = await uploadDocuments(caseId, files);
      showToast('success', `Uploaded ${res.uploaded_files} files${res.skipped_files ? ` (${res.skipped_files} skipped)` : ''}`);
      loadAll();
    } catch (e) { showToast('error', e.message); }
    setUploading(false);
  }, [caseId, loadAll]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleProcess = async () => {
    try {
      await startProcessing(caseId);
      showToast('success', 'Processing started!');
      loadAll();
    } catch (e) { showToast('error', e.message); }
  };

  const handleReprocess = async () => {
    try {
      await reprocessCase(caseId);
      showToast('success', 'Reprocessing started!');
      loadAll();
    } catch (e) { showToast('error', e.message); }
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>;
  if (!caseData) return <div className="empty-state"><p>Case not found</p></div>;

  const c = caseData;
  const progress = status?.progress_percentage || 0;
  const pending = documents.filter(d=>d.status==='pending').length;
  const pieData = summary?.document_type_distribution ? Object.entries(summary.document_type_distribution).map(([name,value])=>({name,value})) : [];

  return (
    <div>
      <div className="flex gap-12" style={{alignItems:'center',marginBottom:8}}>
        <button className="btn btn-outline btn-sm btn-icon" onClick={()=>navigate('/cases')}><ChevronLeft size={16}/></button>
        <div className="page-header" style={{margin:0}}>
          <div className="flex gap-12" style={{alignItems:'center'}}>
            <h2>{c.name}</h2>
            <span className={`badge badge-${c.status==='completed'?'success':c.status==='processing'?'info':c.status==='failed'?'danger':'muted'}`}>
              {c.status==='processing'&&<span className="pulse-dot"/>}{c.status?.replace('_',' ')}
            </span>
          </div>
          {c.description && <p>{c.description}</p>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-8 mb-24">
        <button className="btn btn-primary" onClick={handleProcess} disabled={c.status==='processing'||pending===0}>
          <Play size={16}/> Process ({pending} pending)
        </button>
        <button className="btn btn-outline" onClick={handleReprocess} disabled={c.status==='processing'}>
          <RefreshCw size={16}/> Reprocess Failed
        </button>
      </div>

      {/* Progress */}
      {c.status === 'processing' && (
        <div className="card mb-24">
          <div className="flex-between mb-16">
            <span style={{fontWeight:600}}>Processing...</span>
            <span style={{fontSize:14,color:'var(--accent)'}}>{progress.toFixed(1)}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}/></div>
        </div>
      )}

      {/* Stats Row */}
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        <div className="card stat-card info"><div className="stat-value">{c.total_documents}</div><div className="stat-label">Total</div></div>
        <div className="card stat-card success"><div className="stat-value">{c.processed_documents}</div><div className="stat-label">Processed</div></div>
        <div className="card stat-card danger"><div className="stat-value">{c.failed_documents}</div><div className="stat-label">Failed</div></div>
        <div className="card stat-card purple"><div className="stat-value">{c.duplicate_documents}</div><div className="stat-label">Duplicates</div></div>
        <div className="card stat-card warning"><div className="stat-value">{redFlags?.total||0}</div><div className="stat-label">Red Flags</div></div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['documents','upload','summary','red-flags','timeline','entities'].map(t=>(
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.replace('-',' ').replace(/\b\w/g,l=>l.toUpperCase())}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab==='documents' && (
        <div className="table-container">
          <table>
            <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Status</th><th>Doc Type</th><th>Red Flags</th><th>Actions</th></tr></thead>
            <tbody>
              {documents.map(d=>(
                <tr key={d.id}>
                  <td style={{fontWeight:500,color:'var(--text-primary)',maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.original_filename||d.filename}</td>
                  <td><span className="badge badge-muted">{d.file_type}</span></td>
                  <td>{formatBytes(d.file_size)}</td>
                  <td>
                    <span className={`badge badge-${d.status==='completed'?'success':d.status==='failed'?'danger':d.status==='duplicate'?'purple':d.status==='pending'?'muted':'info'}`}>
                      {d.status==='processing'&&<span className="pulse-dot"/>}{d.status}
                    </span>
                  </td>
                  <td>{d.document_type||'—'}</td>
                  <td>{d.red_flags?.length>0?<span className="badge badge-danger">{d.red_flags.length}</span>:'—'}</td>
                  <td><button className="btn btn-outline btn-sm" onClick={()=>navigate(`/documents/${d.id}`)}><Eye size={14}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {documents.length===0&&<div className="empty-state"><p>No documents uploaded yet</p></div>}
        </div>
      )}

      {tab==='upload' && (
        <div>
          <div {...getRootProps()} className={`dropzone ${isDragActive?'active':''}`}>
            <input {...getInputProps()} />
            <div className="dropzone-icon"><Upload size={24}/></div>
            {uploading ? <p>Uploading...</p> : isDragActive ? <p>Drop files here</p> : (
              <div><p style={{fontWeight:600,marginBottom:4}}>Drag & drop files or click to browse</p><p style={{fontSize:13,color:'var(--text-muted)'}}>Supports PDF, DOCX, TXT, EML, XLSX, PPTX, images & more</p></div>
            )}
          </div>
        </div>
      )}

      {tab==='summary' && (
        <div>
          {summary ? (
            <div>
              <div className="card mb-24">
                <div className="section-title">Executive Summary</div>
                <p style={{lineHeight:1.7,color:'var(--text-secondary)',whiteSpace:'pre-wrap'}}>{summary.executive_summary||'Not yet generated.'}</p>
              </div>
              {summary.risk_assessment && (
                <div className="card mb-24">
                  <div className="section-title">Risk Assessment</div>
                  <div className="flex gap-16" style={{alignItems:'center',marginBottom:16}}>
                    <span className={`badge badge-${summary.risk_assessment.overall_risk==='critical'||summary.risk_assessment.overall_risk==='high'?'danger':summary.risk_assessment.overall_risk==='medium'?'warning':'success'}`} style={{fontSize:14,padding:'6px 16px'}}>
                      {summary.risk_assessment.overall_risk?.toUpperCase()} RISK
                    </span>
                    {summary.risk_assessment.risk_score && <span style={{fontSize:24,fontWeight:700}}>Score: {summary.risk_assessment.risk_score}/100</span>}
                  </div>
                  {summary.risk_assessment.factors?.map((f,i)=>(
                    <div key={i} className={`flag-card ${f.severity}`}><div style={{fontWeight:600,marginBottom:4}}>{f.factor}</div><p style={{fontSize:13,color:'var(--text-secondary)'}}>{f.description}</p></div>
                  ))}
                </div>
              )}
              {pieData.length>0 && (
                <div className="card">
                  <div className="section-title">Document Types</div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value" label={({name,value})=>`${name}(${value})`} labelLine={false}>
                      {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie>
                      <Tooltip contentStyle={{background:'#1a2035',border:'1px solid #2a3a5c',borderRadius:8,color:'#f0f4ff'}}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : <div className="empty-state"><p>Process documents to generate case summary</p></div>}
        </div>
      )}

      {tab==='red-flags' && (
        <div>
          {redFlags && redFlags.total > 0 ? (
            <div>
              <div className="flex gap-12 mb-24">
                {['critical','high','medium','low'].map(s=>(
                  <div key={s} className="card" style={{padding:'12px 20px',textAlign:'center'}}>
                    <div style={{fontSize:22,fontWeight:700,color:s==='critical'?'#dc2626':s==='high'?'var(--danger)':s==='medium'?'var(--warning)':'var(--info)'}}>{redFlags[s]||0}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)',textTransform:'capitalize'}}>{s}</div>
                  </div>
                ))}
              </div>
              {redFlags.flags?.map((f,i) => (
                <div key={i} className={`flag-card ${f.severity}`}>
                  <div className="flex-between">
                    <div style={{fontWeight:600}}><AlertTriangle size={14} style={{marginRight:6}}/>{f.flag}</div>
                    <span className={`badge badge-${f.severity==='critical'||f.severity==='high'?'danger':f.severity==='medium'?'warning':'info'}`}>{f.severity}</span>
                  </div>
                  <p style={{fontSize:13,color:'var(--text-secondary)',marginTop:6}}>{f.detail}</p>
                  <p style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Source: {f.source_document}</p>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><p>No red flags detected</p></div>}
        </div>
      )}

      {tab==='timeline' && (
        <div className="card">
          {timeline?.timeline?.length>0 ? timeline.timeline.map((t,i) => (
            <div key={i} className="timeline-item">
              <div className={`timeline-dot ${t.significance}`}/>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{t.date}</div>
                <p style={{fontSize:13,color:'var(--text-secondary)',marginTop:2}}>{t.context}</p>
                <p style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>Source: {t.source_document}</p>
              </div>
            </div>
          )) : <div className="empty-state"><p>No timeline events found</p></div>}
        </div>
      )}

      {tab==='entities' && (
        <div>
          {summary?.key_entities_consolidated ? (
            <div className="grid-2">
              <div className="card">
                <div className="section-title"><Users size={16}/> Persons</div>
                <div className="flex flex-wrap">{(summary.key_entities_consolidated.persons||[]).map((p,i)=><span key={i} className="entity-tag person">{p.name||p}</span>)}</div>
                {(!summary.key_entities_consolidated.persons||summary.key_entities_consolidated.persons.length===0)&&<p style={{color:'var(--text-muted)',fontSize:13}}>None found</p>}
              </div>
              <div className="card">
                <div className="section-title"><Building size={16}/> Organizations</div>
                <div className="flex flex-wrap">{(summary.key_entities_consolidated.organizations||[]).map((o,i)=><span key={i} className="entity-tag org">{o.name||o}</span>)}</div>
                {(!summary.key_entities_consolidated.organizations||summary.key_entities_consolidated.organizations.length===0)&&<p style={{color:'var(--text-muted)',fontSize:13}}>None found</p>}
              </div>
              <div className="card">
                <div className="section-title"><MapPin size={16}/> Locations</div>
                <div className="flex flex-wrap">{(summary.key_entities_consolidated.locations||[]).map((l,i)=><span key={i} className="entity-tag location">{l.name||l}</span>)}</div>
              </div>
              <div className="card">
                <div className="section-title"><DollarSign size={16}/> Monetary Values</div>
                <div className="flex flex-wrap">{(summary.key_entities_consolidated.monetary_values||[]).map((m,i)=><span key={i} className="entity-tag money">{m.value||m}</span>)}</div>
              </div>
            </div>
          ) : <div className="empty-state"><p>Process documents to extract entities</p></div>}
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
