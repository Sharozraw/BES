import React, { useEffect, useState } from 'react';
import { biddersAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, X, Check } from 'lucide-react';

const emptyBidder = {
  name: '', address: '', contact_person: '', email: '',
  phone: '', bid_price: '', currency: 'LKR', bid_price_with_vat: '',
  registration_no: ''
};

export default function BidderManager({ projectId, isAdmin }) {
  const [bidders, setBidders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyBidder);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    biddersAPI.getByProject(projectId)
      .then(res => setBidders(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId]);

  const openAdd = () => { setEditing(null); setForm(emptyBidder); setShowModal(true); };
  const openEdit = (b) => {
    setEditing(b.id);
    setForm({
      name: b.name || '', address: b.address || '',
      contact_person: b.contact_person || '', email: b.email || '',
      phone: b.phone || '', bid_price: b.bid_price || '',
      currency: b.currency || 'LKR', bid_price_with_vat: b.bid_price_with_vat || '',
      registration_no: b.registration_no || ''
    });
    setShowModal(true);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name) { toast.error('Bidder name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        bid_price: form.bid_price ? parseFloat(form.bid_price) : null,
        bid_price_with_vat: form.bid_price_with_vat ? parseFloat(form.bid_price_with_vat) : null,
      };
      if (editing) {
        await biddersAPI.update(editing, payload);
        toast.success('Bidder updated');
      } else {
        await biddersAPI.create(projectId, payload);
        toast.success('Bidder added');
      }
      setShowModal(false);
      load();
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await biddersAPI.delete(id);
      toast.success('Bidder removed');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: '600', fontSize: '15px' }}>
            Bidders ({bidders.length})
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            Active: {bidders.filter(b => b.status === 'active').length} · Eliminated: {bidders.filter(b => b.status === 'eliminated').length}
          </span>
        </div>
        {isAdmin && (
          <button className="btn btn-navy btn-sm" onClick={openAdd}>
            <Plus size={14} /> Add Bidder
          </button>
        )}
      </div>

      {/* Bid opening summary */}
      {bidders.length > 0 && (
        <div style={{
          background: 'linear-gradient(to right, var(--navy), var(--navy-medium))',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          gap: '32px'
        }}>
          {[
            ['Total Bids', bidders.length],
            ['Lowest Bid', bidders.filter(b => b.bid_price).length > 0
              ? `Rs. ${Math.min(...bidders.map(b => Number(b.bid_price)).filter(Boolean)).toLocaleString()}`
              : '—'
            ],
            ['Highest Bid', bidders.filter(b => b.bid_price).length > 0
              ? `Rs. ${Math.max(...bidders.map(b => Number(b.bid_price)).filter(Boolean)).toLocaleString()}`
              : '—'
            ],
            ['Active', bidders.filter(b => b.status === 'active').length],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', letterSpacing: '1px' }}>{label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: '600', color: 'white', fontSize: '15px' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : bidders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No bidders added</div>
            <p style={{ fontSize: '13px' }}>Bidders may be auto-extracted from uploaded PDFs, or added manually.</p>
            {isAdmin && (
              <button className="btn btn-navy" style={{ marginTop: '12px' }} onClick={openAdd}>
                <Plus size={15} /> Add Bidder
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Bidder Name</th>
                  <th>Address</th>
                  <th>Registration No.</th>
                  <th>Bid Price (No VAT)</th>
                  <th>Bid Price (With VAT)</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {bidders.map((b, idx) => (
                  <tr key={b.id} style={{ opacity: b.status === 'eliminated' ? 0.65 : 1 }}>
                    <td style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: '500' }}>{b.name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.address || '—'}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>{b.registration_no || '—'}</td>
                    <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: '500', color: 'var(--navy)' }}>
                      {b.bid_price ? `Rs. ${Number(b.bid_price).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px' }}>
                      {b.bid_price_with_vat ? `Rs. ${Number(b.bid_price_with_vat).toLocaleString()}` : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${b.status}`}>
                        {b.status}
                      </span>
                      {b.status === 'eliminated' && b.elimination_reason && (
                        <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '2px' }}>{b.elimination_reason}</div>
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(b)}>
                            <Edit size={12} />
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                            onClick={() => handleDelete(b.id, b.name)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: '600' }}>
                {editing ? 'Edit Bidder' : 'Add Bidder'}
              </h3>
              <button className="btn btn-icon btn-outline" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid form-grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Bidder Name *</label>
                  <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full company name" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Address</label>
                  <textarea className="form-control" value={form.address} onChange={e => set('address', e.target.value)} rows={2} placeholder="Full address" />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input className="form-control" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Contact name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Registration No.</label>
                  <input className="form-control" value={form.registration_no} onChange={e => set('registration_no', e.target.value)} placeholder="Company reg. number" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@company.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+94..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Bid Price (Without VAT)</label>
                  <input type="number" className="form-control" value={form.bid_price} onChange={e => set('bid_price', e.target.value)} placeholder="0.00" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Bid Price (With VAT)</label>
                  <input type="number" className="form-control" value={form.bid_price_with_vat} onChange={e => set('bid_price_with_vat', e.target.value)} placeholder="0.00" min="0" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-navy" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : <><Check size={15} /> {editing ? 'Update' : 'Add Bidder'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
