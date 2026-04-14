import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Users, List, Flag } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

interface Report {
  id: string;
  reporter_name: string;
  listing_title?: string;
  listing_status?: string;
  reported_user_name?: string;
  reported_user_suspended?: number;
  category: string;
  description: string;
  status: string;
  admin_note: string;
  created_at: string;
  listing_id?: string;
  reported_user_id?: string;
}

interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  phone_verified: number;
  id_verified: number;
  id_doc_status: string;
  avg_rating: number;
  total_shared: number;
  total_claimed: number;
  is_suspended: number;
  is_admin: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<'reports' | 'users'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNote, setActionNote] = useState('');

  useEffect(() => {
    if (!user?.is_admin) { navigate('/home'); return; }
    Promise.all([api.get('/admin/reports'), api.get('/admin/users')])
      .then(([r, u]) => { setReports(r.data.reports); setUsers(u.data.users); })
      .finally(() => setLoading(false));
  }, []);

  async function updateReport(id: string, status: string, note?: string) {
    await api.patch(`/admin/reports/${id}`, { status, admin_note: note || '' });
    setReports(prev => prev.map(r => r.id === id ? { ...r, status, admin_note: note || r.admin_note } : r));
  }

  async function removeReportedListing(listingId: string, reportId: string) {
    await api.delete(`/admin/listings/${listingId}`);
    await updateReport(reportId, 'resolved', 'Listing removed');
  }

  async function userAction(userId: string, action: string, note?: string) {
    await api.patch(`/admin/users/${userId}`, { action, note });
    if (action === 'suspend') setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: 1 } : u));
    if (action === 'unsuspend') setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: 0 } : u));
    if (action === 'verify_id') setUsers(prev => prev.map(u => u.id === userId ? { ...u, id_verified: 1, id_doc_status: 'approved' } : u));
    if (action === 'reject_id') setUsers(prev => prev.map(u => u.id === userId ? { ...u, id_doc_status: 'rejected' } : u));
  }

  const pendingReports = reports.filter(r => r.status === 'pending').length;
  const pendingIds = users.filter(u => u.id_doc_status === 'pending').length;

  if (!user?.is_admin) return null;

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => navigate('/profile')} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert size={18} className="text-brand-600" /> Admin Panel
            </h1>
          </div>
          {(pendingReports > 0 || pendingIds > 0) && (
            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
              {pendingReports + pendingIds} pending
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {([
            ['reports', Flag, `Reports (${pendingReports})`],
            ['users', Users, `Users (${pendingIds} ID pending)`],
          ] as const).map(([t, Icon, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-4 pb-20 space-y-3">
          {tab === 'reports' && (
            reports.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Flag size={40} className="mx-auto mb-3 text-gray-200" />
                <p>No reports</p>
              </div>
            ) : reports.map(report => (
              <div key={report.id} className={`card p-4 ${report.status === 'pending' ? 'border-l-4 border-l-red-400' : 'opacity-60'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`badge text-xs ${report.status === 'pending' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                      {report.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(report.created_at).toLocaleDateString()}</span>
                </div>

                <p className="text-sm font-semibold text-gray-800 mb-1">{report.category}</p>
                {report.description && <p className="text-xs text-gray-500 mb-2">{report.description}</p>}

                <div className="text-xs text-gray-500 space-y-0.5 mb-3">
                  <p>By: <span className="font-medium">{report.reporter_name}</span></p>
                  {report.listing_title && <p>Listing: <span className="font-medium">{report.listing_title}</span> ({report.listing_status})</p>}
                  {report.reported_user_name && <p>User: <span className="font-medium">{report.reported_user_name}</span> {report.reported_user_suspended ? '(suspended)' : ''}</p>}
                </div>

                {report.admin_note && (
                  <p className="text-xs text-brand-700 bg-brand-50 rounded-lg px-3 py-2 mb-3">Note: {report.admin_note}</p>
                )}

                {report.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    {report.listing_id && report.listing_status === 'active' && (
                      <button onClick={() => removeReportedListing(report.listing_id!, report.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium">
                        Remove listing
                      </button>
                    )}
                    {report.reported_user_id && !report.reported_user_suspended && (
                      <>
                        <button onClick={() => userAction(report.reported_user_id!, 'warn', report.category).then(() => updateReport(report.id, 'resolved', 'User warned'))}
                          className="text-xs px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 font-medium">
                          Warn user
                        </button>
                        <button onClick={() => userAction(report.reported_user_id!, 'suspend').then(() => updateReport(report.id, 'resolved', 'User suspended'))}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium">
                          Suspend
                        </button>
                      </>
                    )}
                    {report.reported_user_id && report.reported_user_suspended && (
                      <button onClick={() => userAction(report.reported_user_id!, 'unsuspend').then(() => updateReport(report.id, 'resolved', 'User unsuspended'))}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand-100 text-brand-700 font-medium">
                        Unsuspend
                      </button>
                    )}
                    <button onClick={() => updateReport(report.id, 'dismissed')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 font-medium">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          {tab === 'users' && (
            users.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No users</div>
            ) : users.map(u => (
              <div key={u.id} className={`card p-4 ${u.is_suspended ? 'opacity-50' : ''} ${u.id_doc_status === 'pending' ? 'border-l-4 border-l-orange-400' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{u.name || 'Unnamed'}</p>
                    <p className="text-xs text-gray-400">{u.phone} · {u.role}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {u.is_admin && <span className="badge bg-purple-100 text-purple-700 text-[10px]">Admin</span>}
                    {u.phone_verified ? <span className="badge bg-blue-100 text-blue-700 text-[10px]">Phone ✓</span> : null}
                    {u.id_verified ? <span className="badge bg-brand-100 text-brand-700 text-[10px]">ID ✓</span> : null}
                    {u.is_suspended ? <span className="badge bg-red-100 text-red-700 text-[10px]">Suspended</span> : null}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  ★ {u.avg_rating.toFixed(1)} · {u.total_shared} shared · {u.total_claimed} claimed
                </div>

                {/* ID Doc review */}
                {u.id_doc_status === 'pending' && !u.id_verified && (
                  <div className="bg-orange-50 rounded-xl p-3 mb-3">
                    <p className="text-xs font-semibold text-orange-700 mb-2">ID document pending review</p>
                    <div className="flex gap-2">
                      <button onClick={() => userAction(u.id, 'verify_id')}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-brand-600 text-white font-medium">
                        Approve ID
                      </button>
                      <button onClick={() => userAction(u.id, 'reject_id')}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-red-100 text-red-600 font-medium">
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {!u.is_suspended ? (
                    <button onClick={() => userAction(u.id, 'suspend')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium">
                      Suspend
                    </button>
                  ) : (
                    <button onClick={() => userAction(u.id, 'unsuspend')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-brand-100 text-brand-700 font-medium">
                      Unsuspend
                    </button>
                  )}
                  <button onClick={() => userAction(u.id, 'warn', 'Please review our community guidelines.')}
                    className="text-xs px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 font-medium">
                    Warn
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
