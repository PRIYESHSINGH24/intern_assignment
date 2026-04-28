import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { getCase, getDocuments, uploadDocuments, startProcessing, reprocessCase, getCaseStatus, getCaseSummary, getCaseRedFlags, getCaseTimeline } from '../api/client';
import { Upload, Play, RefreshCw, FileText, AlertTriangle, Clock, Users, Building, MapPin, DollarSign, ChevronLeft, CheckCircle, XCircle, Copy, Eye, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#5e6ad2', '#00d285', '#ffb020', '#ff4757', '#00a8ff', '#9b59b6', '#ec4899', '#14b8a6'];

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
  const [uploadProgress, setUploadProgress] = useState(0);
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
    setUploadProgress(0);
    try {
      const res = await uploadDocuments(caseId, files, (progress) => {
        setUploadProgress(progress);
      });
      showToast('success', `Uploaded ${res.uploaded_files} files${res.skipped_files ? ` (${res.skipped_files} skipped)` : ''}`);
      loadAll();
    } catch (e) { showToast('error', e.message); }
    setUploading(false);
    setUploadProgress(0);
  }, [caseId, loadAll]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleProcess = async () => {
    try {
      await startProcessing(caseId);
      showToast('success', 'Processing sequence initiated');
      loadAll();
    } catch (e) { showToast('error', e.message); }
  };

  const handleReprocess = async () => {
    try {
      await reprocessCase(caseId);
      showToast('success', 'Reprocessing sequence initiated');
      loadAll();
    } catch (e) { showToast('error', e.message); }
  };

  if (loading) return (
    <div className="loading-container animate-in">
      <div className="loading-spinner" />
      <p style={{marginTop:16, fontWeight:600, letterSpacing:'2px', fontSize:12, textTransform:'uppercase'}}>Loading Case Data...</p>
    </div>
  );
  if (!caseData) return <div className="empty-state animate-in"><p>Case not found</p></div>;

  const c = caseData;
  const progress = status?.progress_percentage || 0;
  const pending = documents.filter(d=>d.status==='pending').length;
  const pieData = summary?.document_type_distribution ? Object.entries(summary.document_type_distribution).map(([name,value])=>({name,value})) : [];

  return (
    <div style={{paddingBottom: 40}}>
      <div className="flex gap-12 animate-in" style={{alignItems:'center',marginBottom:16}}>
        <button className="btn btn-outline btn-sm btn-icon" onClick={()=>navigate('/cases')}><ChevronLeft size={16}/></button>
        <div className="page-header" style={{margin:0}}>
          <div className="flex gap-12" style={{alignItems:'center'}}>
            <h2 style={{margin: 0, fontSize: 32}}>{c.name}</h2>
            <span className={`badge badge-${c.status==='completed'?'success':c.status==='processing'?'info':c.status==='failed'?'danger':'muted'}`}>
              {c.status==='processing'&&<span className="pulse-dot" style={{marginRight:6}}/>}{c.status?.replace('_',' ')}
            </span>
          </div>
          {c.description && <p style={{marginTop: 8}}>{c.description}</p>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-12 mb-32 animate-in delay-100">
        <button className="btn btn-primary" onClick={handleProcess} disabled={c.status==='processing'||pending===0}>
          <Play size={16}/> Initialize Processing ({pending} pending)
        </button>
        <button className="btn btn-outline" onClick={handleReprocess} disabled={c.status==='processing'}>
          <RefreshCw size={16}/> Reprocess Failed
        </button>
      </div>

      {/* Progress */}
      {c.status === 'processing' && (
        <div className="card card-premium mb-32 animate-in delay-100">
          <div className="flex-between mb-16">
            <span style={{fontWeight:600, display:'flex', alignItems:'center', gap:8}}>
              <Sparkles size={16} color="var(--accent)"/> Processing Documents...
            </span>
            <span style={{fontSize:16,color:'var(--accent)', fontWeight:700, fontFamily:'Outfit'}}>{progress.toFixed(1)}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{width:`${progress}%`}}/></div>
        </div>
      )}

      {/* Stats Row */}
      <div className="stats-grid animate-in delay-200" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        <div className="card card-premium stat-card info"><div className="stat-value">{c.total_documents}</div><div className="stat-label">Total Docs</div></div>
        <div className="card card-premium stat-card success"><div className="stat-value">{c.processed_documents}</div><div className="stat-label">Processed</div></div>
        <div className="card card-premium stat-card danger"><div className="stat-value">{c.failed_documents}</div><div className="stat-label">Failed</div></div>
        <div className="card card-premium stat-card purple"><div className="stat-value">{c.duplicate_documents}</div><div className="stat-label">Duplicates</div></div>
        <div className="card card-premium stat-card warning"><div className="stat-value" style={{color: redFlags?.total > 0 ? 'var(--warning)' : 'inherit'}}>{redFlags?.total||0}</div><div className="stat-label">Red Flags</div></div>
      </div>

      {/* Tabs */}
      <div className="tabs animate-in delay-300">
        {['documents','upload','summary','red-flags','timeline','entities'].map(t=>(
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.replace('-',' ').replace(/\b\w/g,l=>l.toUpperCase())}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in delay-400">
        {tab==='documents' && (
          <div className="table-container card-premium">
            <table>
              <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Status</th><th>Doc Type</th><th>Red Flags</th><th>Actions</th></tr></thead>
              <tbody>
                {documents.map((d,i)=>(
                  <tr key={d.id} className="animate-in" style={{animationDelay:`${400 + i*50}ms`}}>
                    <td style={{fontWeight:600,color:'#fff',maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.original_filename||d.filename}</td>
                    <td><span className="badge badge-muted" style={{fontSize: 10}}>{d.file_type}</span></td>
                    <td style={{color:'var(--text-muted)'}}>{formatBytes(d.file_size)}</td>
                    <td>
                      <span className={`badge badge-${d.status==='completed'?'success':d.status==='failed'?'danger':d.status==='duplicate'?'purple':d.status==='pending'?'muted':'info'}`}>
                        {d.status==='processing'&&<span className="pulse-dot" style={{marginRight:6}}/>}{d.status}
                      </span>
                    </td>
                    <td style={{color:'var(--text-secondary)'}}>{d.document_type||'—'}</td>
                    <td>{d.red_flags?.length>0?<span className="badge badge-danger">{d.red_flags.length}</span>:<span style={{color:'var(--text-muted)'}}>—</span>}</td>
                    <td><button className="btn btn-outline btn-sm" onClick={()=>navigate(`/documents/${d.id}`)}><Eye size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {documents.length===0&&<div className="empty-state"><p>No documents uploaded yet</p></div>}
          </div>
        )}

        {tab==='upload' && (
          <div className="card card-premium animate-in">
            <div {...getRootProps()} className={`dropzone ${isDragActive?'active':''}`}>
              <input {...getInputProps()} />
              <div className="dropzone-icon"><Upload size={28}/></div>
              {uploading ? (
                <div style={{width: '100%', maxWidth: '400px', margin: '0 auto'}}>
                  <div className="flex-between mb-8">
                    <p style={{fontSize:16, fontWeight:600, color:'#fff', margin: 0}}>Transmitting payload...</p>
                    <span style={{color:'var(--accent)', fontWeight: 700}}>{uploadProgress}%</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{width:`${uploadProgress}%`, transition: 'width 0.2s ease-out'}}/></div>
                </div>
              ) : isDragActive ? <p style={{fontSize:18, fontWeight:600, color:'var(--accent)'}}>Drop files here to ingest</p> : (
                <div><p style={{fontWeight:700, fontSize:18, marginBottom:8, color:'#fff'}}>Drag & drop files or click to browse</p><p style={{fontSize:14,color:'var(--text-muted)'}}>Supports PDF, DOCX, TXT, EML, XLSX, PPTX, images & more</p></div>
              )}
            </div>
          </div>
        )}

        {tab==='summary' && (
          <div>
            {summary ? (
              <div>
                <div className="card card-premium mb-32 animate-in">
                  <div className="section-title"><FileText size={20} color="var(--accent)"/> Executive Summary</div>
                  <p style={{lineHeight:1.8, fontSize: 15, color:'var(--text-secondary)',whiteSpace:'pre-wrap'}}>{summary.executive_summary||'Not yet generated.'}</p>
                </div>
                {summary.risk_assessment && (
                  <div className="card card-premium mb-32 animate-in delay-100">
                    <div className="section-title"><AlertTriangle size={20} color="var(--warning)"/> Risk Assessment</div>
                    <div className="flex gap-16" style={{alignItems:'center',marginBottom:24}}>
                      <span className={`badge badge-${summary.risk_assessment.overall_risk==='critical'||summary.risk_assessment.overall_risk==='high'?'danger':summary.risk_assessment.overall_risk==='medium'?'warning':'success'}`} style={{fontSize:14,padding:'8px 20px'}}>
                        {summary.risk_assessment.overall_risk?.toUpperCase()} RISK
                      </span>
                      {summary.risk_assessment.risk_score && <span style={{fontSize:28,fontWeight:800, fontFamily:'Outfit', color:'#fff'}}>Score: <span style={{color:'var(--accent)'}}>{summary.risk_assessment.risk_score}</span><span style={{fontSize:16, color:'var(--text-muted)'}}>/100</span></span>}
                    </div>
                    {summary.risk_assessment.factors?.map((f,i)=>(
                      <div key={i} className={`flag-card ${f.severity}`}><div style={{fontWeight:700,marginBottom:6, fontSize:15, color:'#fff'}}>{f.factor}</div><p style={{fontSize:14,color:'var(--text-secondary)'}}>{f.description}</p></div>
                    ))}
                  </div>
                )}
                {pieData.length>0 && (
                  <div className="card card-premium animate-in delay-200">
                    <div className="section-title">Document Taxonomy</div>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" label={({name,value})=>`${name} (${value})`} stroke="none" labelLine={false}>
                        {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} style={{filter: `drop-shadow(0px 0px 8px ${COLORS[i % COLORS.length]}88)`}}/>)}</Pie>
                        <Tooltip contentStyle={{background:'rgba(10,10,15,0.9)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,color:'#fff'}} itemStyle={{color:'#fff', fontWeight:600}}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : <div className="empty-state card card-premium"><p>Process documents to generate case intelligence summary</p></div>}
          </div>
        )}

        {tab==='red-flags' && (
          <div>
            {redFlags && redFlags.total > 0 ? (
              <div>
                <div className="flex gap-16 mb-32 animate-in">
                  {['critical','high','medium','low'].map(s=>(
                    <div key={s} className="card card-premium" style={{flex:1, padding:'20px',textAlign:'center'}}>
                      <div style={{fontSize:36,fontWeight:800, fontFamily:'Outfit', color:s==='critical'?'#ff4757':s==='high'?'#ff6b81':s==='medium'?'#ffb020':'#00a8ff'}}>{redFlags[s]||0}</div>
                      <div style={{fontSize:13,color:'var(--text-muted)',textTransform:'uppercase', fontWeight:600, letterSpacing:'1px', marginTop:4}}>{s}</div>
                    </div>
                  ))}
                </div>
                {redFlags.flags?.map((f,i) => (
                  <div key={i} className={`flag-card ${f.severity} animate-in`} style={{animationDelay: `${100 + i*50}ms`}}>
                    <div className="flex-between">
                      <div style={{fontWeight:700, fontSize:16, color:'#fff'}}><AlertTriangle size={16} style={{marginRight:8}}/>{f.flag}</div>
                      <span className={`badge badge-${f.severity==='critical'||f.severity==='high'?'danger':f.severity==='medium'?'warning':'info'}`}>{f.severity}</span>
                    </div>
                    <p style={{fontSize:14,color:'var(--text-secondary)',marginTop:8}}>{f.detail}</p>
                    <p style={{fontSize:12,color:'var(--text-muted)',marginTop:8}}>Source: <span style={{color:'var(--accent)'}}>{f.source_document}</span></p>
                  </div>
                ))}
              </div>
            ) : <div className="empty-state card card-premium animate-in"><p>No red flags detected in current dataset</p></div>}
          </div>
        )}

        {tab==='timeline' && (
          <div className="card card-premium animate-in">
            {timeline?.timeline?.length>0 ? timeline.timeline.map((t,i) => (
              <div key={i} className="timeline-item animate-in" style={{animationDelay: `${100 + i*50}ms`}}>
                <div className={`timeline-dot ${t.significance}`}/>
                <div>
                  <div style={{fontWeight:700,fontSize:16, color:'#fff', marginBottom:4}}>{t.date}</div>
                  <p style={{fontSize:15,color:'var(--text-secondary)'}}>{t.context}</p>
                  <p style={{fontSize:12,color:'var(--text-muted)',marginTop:6}}>Source: <span style={{color:'var(--accent)'}}>{t.source_document}</span></p>
                </div>
              </div>
            )) : <div className="empty-state"><p>No temporal events extracted</p></div>}
          </div>
        )}

        {tab==='entities' && (
          <div>
            {summary?.key_entities_consolidated ? (
              <div className="grid-2 animate-in">
                <div className="card card-premium">
                  <div className="section-title"><Users size={20} color="#8c9eff"/> Persons</div>
                  <div className="flex flex-wrap">{(summary.key_entities_consolidated.persons||[]).map((p,i)=><span key={i} className="entity-tag person">{p.name||p}</span>)}</div>
                  {(!summary.key_entities_consolidated.persons||summary.key_entities_consolidated.persons.length===0)&&<p style={{color:'var(--text-muted)',fontSize:14}}>None identified</p>}
                </div>
                <div className="card card-premium">
                  <div className="section-title"><Building size={20} color="#33ffb8"/> Organizations</div>
                  <div className="flex flex-wrap">{(summary.key_entities_consolidated.organizations||[]).map((o,i)=><span key={i} className="entity-tag org">{o.name||o}</span>)}</div>
                  {(!summary.key_entities_consolidated.organizations||summary.key_entities_consolidated.organizations.length===0)&&<p style={{color:'var(--text-muted)',fontSize:14}}>None identified</p>}
                </div>
                <div className="card card-premium">
                  <div className="section-title"><MapPin size={20} color="#ffd670"/> Locations</div>
                  <div className="flex flex-wrap">{(summary.key_entities_consolidated.locations||[]).map((l,i)=><span key={i} className="entity-tag location">{l.name||l}</span>)}</div>
                  {(!summary.key_entities_consolidated.locations||summary.key_entities_consolidated.locations.length===0)&&<p style={{color:'var(--text-muted)',fontSize:14}}>None identified</p>}
                </div>
                <div className="card card-premium">
                  <div className="section-title"><DollarSign size={20} color="#d698f5"/> Monetary Values</div>
                  <div className="flex flex-wrap">{(summary.key_entities_consolidated.monetary_values||[]).map((m,i)=><span key={i} className="entity-tag money">{m.value||m}</span>)}</div>
                  {(!summary.key_entities_consolidated.monetary_values||summary.key_entities_consolidated.monetary_values.length===0)&&<p style={{color:'var(--text-muted)',fontSize:14}}>None identified</p>}
                </div>
              </div>
            ) : <div className="empty-state card card-premium"><p>Process documents to extract key entities</p></div>}
          </div>
        )}
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
