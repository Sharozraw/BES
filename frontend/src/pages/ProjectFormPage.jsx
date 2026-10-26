import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/common/Layout';
import { projectsAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { Save, ArrowLeft } from 'lucide-react';

export default function ProjectFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    file_no: '',
    title: '',
    description: '',
    invitation_date: '',
    bid_close_date: '',
    bid_open_date: '',
    pre_bid_date: '',
    document_sale_date: '',
  });

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      projectsAPI.getById(id)
        .then(res => {
          const p = res.data;
          setForm({
            file_no: p.file_no || '',
            title: p.title || '',
            description: p.description || '',
            invitation_date: p.invitation_date ? p.invitation_date.slice(0, 10) : '',
            bid_close_date: p.bid_close_date ? p.bid_close_date.slice(0, 16) : '',
            bid_open_date: p.bid_open_date ? p.bid_open_date.slice(0, 16) : '',
            pre_bid_date: p.pre_bid_date ? p.pre_bid_date.slice(0, 16) : '',
            document_sale_date: p.document_sale_date ? p.document_sale_date.slice(0, 10) : '',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file_no || !form.title) {
      toast.error('File No. and Title are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        procurement_method: 'NCB', // always NCB, not shown to user
        invitation_date: form.invitation_date || null,
        bid_close_date: form.bid_close_date || null,
        bid_open_date: form.bid_open_date || null,
        pre_bid_date: form.pre_bid_date || null,
        document_sale_date: form.document_sale_date || null,
      };
      if (isEdit) {
        await projectsAPI.update(id, payload);
        toast.success('Project updated');
        navigate(`/projects/${id}`);
      } else {
        const res = await projectsAPI.create(payload);
        toast.success('Project created');
        navigate(`/projects/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout title={isEdit ? 'Edit Project' : 'New Project'}>
        <div className="loading-center"><div className="spinner" /></div>
      </Layout>
    );
  }

  return (
    <Layout
      title={isEdit ? 'Edit Project' : 'New Project'}
      breadcrumb={`Projects › ${isEdit ? 'Edit' : 'Create'}`}
    >
      <div style={{ maxWidth: '860px' }}>
        <div style={{ marginBottom: '20px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(isEdit ? `/projects/${id}` : '/projects')}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <span className="card-title">Basic Information</span>
            </div>
            <div className="card-body">
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">File Number *</label>
                  <input
                    className="form-control"
                    value={form.file_no}
                    onChange={e => set('file_no', e.target.value)}
                    placeholder="e.g. RUH/ENG/CE/NCB/2025/02"
                    disabled={isEdit}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Project Title *</label>
                <input
                  className="form-control"
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="Full description of goods / works / services"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Additional details about this procurement..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <span className="card-title">Key Dates</span>
            </div>
            <div className="card-body">
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Date of Invitation</label>
                  <input type="date" className="form-control" value={form.invitation_date}
                    onChange={e => set('invitation_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Document Sale Date</label>
                  <input type="date" className="form-control" value={form.document_sale_date}
                    onChange={e => set('document_sale_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pre-Bid Meeting</label>
                  <input type="datetime-local" className="form-control" value={form.pre_bid_date}
                    onChange={e => set('pre_bid_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bid Close Date &amp; Time</label>
                  <input type="datetime-local" className="form-control" value={form.bid_close_date}
                    onChange={e => set('bid_close_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bid Open Date &amp; Time</label>
                  <input type="datetime-local" className="form-control" value={form.bid_open_date}
                    onChange={e => set('bid_open_date', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="submit" className="btn btn-navy btn-lg" disabled={submitting}>
              {submitting
                ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Saving...</>
                : <><Save size={16} /> {isEdit ? 'Save Changes' : 'Create Project'}</>
              }
            </button>
            <button type="button" className="btn btn-outline btn-lg"
              onClick={() => navigate(isEdit ? `/projects/${id}` : '/projects')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
