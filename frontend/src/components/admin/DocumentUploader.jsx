import React, { useEffect, useState, useRef } from 'react';
import { documentsAPI, biddersAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Upload, File, Trash2, Eye, X, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const DOCUMENT_TYPES = [
  'bid_document', 'technical_specification', 'financial_document',
  'authorization_letter', 'bid_security', 'registration_certificate',
  'tec_report', 'other'
];

export default function DocumentUploader({ projectId, isAdmin }) {
  const [docs, setDocs] = useState([]);
  const [bidders, setBidders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadForm, setUploadForm] = useState({ bidderId: '', documentType: 'bid_document' });
  const fileRef = useRef();

  const load = () => {
    Promise.all([
      documentsAPI.getByProject(projectId),
      biddersAPI.getByProject(projectId)
    ]).then(([dRes, bRes]) => {
      setDocs(dRes.data || []);
      setBidders(bRes.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);
        if (uploadForm.bidderId) formData.append('bidderId', uploadForm.bidderId);
        formData.append('documentType', uploadForm.documentType);

        await documentsAPI.upload(formData);
        toast.success(`${file.name} uploaded successfully`);
      } catch (e) {
        toast.error(`Failed to upload ${file.name}: ${e.message}`);
      }
    }
    setUploading(false);
    load();
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await documentsAPI.delete(id);
      toast.success('Document deleted');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle size={14} color="var(--success)" />;
      case 'failed': return <AlertCircle size={14} color="var(--danger)" />;
      default: return <Clock size={14} color="var(--warning)" />;
    }
  };

  return (
    <div>
      {/* Upload zone */}
      {isAdmin && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Associate with Bidder (optional)</label>
              <select className="form-control" value={uploadForm.bidderId} onChange={e => setUploadForm(f => ({ ...f, bidderId: e.target.value }))}>
                <option value="">— Project-level document —</option>
                {bidders.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Document Type</label>
              <select className="form-control" value={uploadForm.documentType} onChange={e => setUploadForm(f => ({ ...f, documentType: e.target.value }))}>
                {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
            </div>
          </div>

          <div
            style={{
              border: `2px dashed ${dragOver ? 'var(--blue)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center',
              background: dragOver ? '#e3f2fd' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              handleUpload(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={e => handleUpload(e.target.files)}
            />
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div className="spinner" />
                <span style={{ color: 'var(--text-muted)' }}>Uploading & extracting...</span>
              </div>
            ) : (
              <>
                <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                <div style={{ fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
                  Drag & drop files or click to browse
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (max 50MB)
                </div>
                <div className="alert alert-info" style={{ marginTop: '12px', textAlign: 'left', maxWidth: '400px', margin: '12px auto 0' }}>
                  📄 PDF files will be automatically parsed to extract bidder details, prices, and project information.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Documents list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Documents ({docs.length})</span>
        </div>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FileText size={28} /></div>
            <div className="empty-title">No documents uploaded</div>
            <p style={{ fontSize: '13px' }}>Upload bid documents and the system will auto-extract data.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Bidder</th>
                  <th>Size</th>
                  <th>Extraction</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="var(--text-muted)" />
                        <span style={{ fontWeight: '500', fontSize: '13px' }}>{doc.original_name || doc.file_name}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--bg)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        {doc.document_type?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {doc.bidder_name || <span style={{ color: 'var(--text-muted)' }}>Project-level</span>}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
                      {formatSize(doc.file_size)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        {statusIcon(doc.extraction_status)}
                        {doc.extraction_status}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>{doc.uploaded_by_name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                          onClick={() => handleDelete(doc.id, doc.original_name)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
