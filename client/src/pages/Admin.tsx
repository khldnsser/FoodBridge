import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, Users, Flag, AlertCircle, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { resolveAssetUrl } from '../lib/assetUrl';
import UserProfilePopup from '../components/UserProfilePopup';

interface Report {
  id: string;
  reporter_id: string;
  listing_id?: string;
  reason: string;
  status: string;
  created_at: string;
  reporter?: { name: string | null };
  listings?: { title: string; status: string; user_id: string };
}

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  photos: string[];
  status: string;
  user_id: string;
  expiry_date: string;
  categories: string[];
  dietary_tags: string[];
  pickup_address: string;
  users?: { name: string | null };
}

interface AdminListing {
  id: string;
  title: string;
  photos: string[];
  status: string;
  expiry_date: string;
  neighborhood: string;
  categories: string[];
  created_at: string;
  users?: { name: string | null };
}

interface AdminUser {
  id: string;
  username: string;
  name: string | null;
  email: string;
  role: string;
  id_verified: boolean;
  id_doc_status: string;
  avg_rating: number;
  total_shared: number;
  total_claimed: number;
  is_suspended: boolean;
  is_admin: boolean;
}

type UserFilter = 'all' | 'pending_id' | 'suspended';

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [tab, setTab] = useState<'reports' | 'users' | 'listings'>('reports');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allListings, setAllListings] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);

  // User profile popup
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // ID modal
  const [idModalUser, setIdModalUser] = useState<AdminUser | null>(null);
  const [idDocUrl, setIdDocUrl] = useState<string | null>(null);
  const [idDocType, setIdDocType] = useState<'image' | 'pdf' | null>(null);
  const [idDocLoading, setIdDocLoading] = useState(false);

  // Report modal
  const [reportModal, setReportModal] = useState<Report | null>(null);
  const [reportListing, setReportListing] = useState<ListingDetail | null>(null);
  const [reportListingLoading, setReportListingLoading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!user?.is_admin) { navigate('/home'); return; }
    loadAll();
  }, [user]);

  async function loadAll() {
    const [{ data: r }, { data: u }, { data: l }] = await Promise.all([
      supabase.from('reports').select('*, reporter:users!reporter_id(name), listings(title, status, user_id)').order('created_at', { ascending: false }),
      supabase.from('users').select('*').order('created_at', { ascending: true }),
      supabase.from('listings').select('id, title, photos, status, expiry_date, neighborhood, categories, created_at, users(name)').order('created_at', { ascending: false }),
    ]);
    setReports((r as unknown as Report[]) || []);
    setUsers((u as unknown as AdminUser[]) || []);
    setAllListings((l as unknown as AdminListing[]) || []);
    setLoading(false);
  }

  async function updateReport(id: string, status: string) {
    await supabase.from('reports').update({ status }).eq('id', id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (reportModal?.id === id) setReportModal(prev => prev ? { ...prev, status } : null);
  }

  async function removeListing(listingId: string, reportId: string) {
    await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId);
    await updateReport(reportId, 'resolved');
    if (reportListing?.id === listingId) setReportListing(prev => prev ? { ...prev, status: 'removed' } : null);
    setAllListings(prev => prev.map(l => l.id === listingId ? { ...l, status: 'removed' } : l));
  }

  async function adminRemoveListing(listingId: string) {
    await supabase.from('listings').update({ status: 'removed' }).eq('id', listingId);
    setAllListings(prev => prev.map(l => l.id === listingId ? { ...l, status: 'removed' } : l));
  }

  async function userAction(userId: string, action: 'suspend' | 'unsuspend' | 'verify_id' | 'reject_id') {
    const updates: Record<string, unknown> = {
      suspend:   { is_suspended: true },
      unsuspend: { is_suspended: false },
      verify_id: { id_verified: true, id_doc_status: 'approved' },
      reject_id: { id_doc_status: 'rejected' },
    }[action];

    const { error } = await supabase.from('users').update(updates).eq('id', userId);
    if (error) { console.error('userAction error:', error.message); return; }

    if (action === 'suspend')   setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: true } : u));
    if (action === 'unsuspend') setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: false } : u));
    if (action === 'verify_id') setUsers(prev => prev.map(u => u.id === userId ? { ...u, id_verified: true, id_doc_status: 'approved' } : u));
    if (action === 'reject_id') setUsers(prev => prev.map(u => u.id === userId ? { ...u, id_doc_status: 'rejected' } : u));
  }

  async function openIdModal(u: AdminUser) {
    setIdModalUser(u);
    setIdDocUrl(null);
    setIdDocType(null);
    setIdDocLoading(true);
    for (const ext of ['jpg', 'jpeg', 'png', 'webp', 'pdf']) {
      const { data } = await supabase.storage
        .from('id-documents')
        .createSignedUrl(`${u.id}/id.${ext}`, 300);
      if (data?.signedUrl) {
        setIdDocUrl(data.signedUrl);
        setIdDocType(ext === 'pdf' ? 'pdf' : 'image');
        break;
      }
    }
    setIdDocLoading(false);
  }

  async function openReportModal(report: Report) {
    setReportModal(report);
    setReportListing(null);
    setPhotoIndex(0);
    if (!report.listing_id) return;
    setReportListingLoading(true);
    const { data } = await supabase
      .from('listings')
      .select('id, title, description, photos, status, user_id, expiry_date, categories, dietary_tags, pickup_address, users(name)')
      .eq('id', report.listing_id)
      .single();
    setReportListing((data as unknown as ListingDetail) || null);
    setReportListingLoading(false);
  }

  // Stat card click handlers
  function handleStatClick(stat: string) {
    if (stat === 'reports') {
      setTab('reports');
    } else if (stat === 'users') {
      setTab('users');
      setUserFilter('all');
    } else if (stat === 'pending_id') {
      setTab('users');
      setUserFilter('pending_id');
    } else if (stat === 'suspended') {
      setTab('users');
      setUserFilter('suspended');
    }
  }

  const pendingReports = reports.filter(r => r.status === 'open').length;
  const pendingIds     = users.filter(u => u.id_doc_status === 'pending' && !u.id_verified).length;
  const suspendedUsers = users.filter(u => u.is_suspended).length;

  const filteredUsers = userFilter === 'pending_id'
    ? users.filter(u => u.id_doc_status === 'pending' && !u.id_verified)
    : userFilter === 'suspended'
    ? users.filter(u => u.is_suspended)
    : users;

  if (!user?.is_admin) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <h1 className="font-bold text-gray-900 flex items-center gap-2 text-lg">
            <ShieldAlert size={20} className="text-brand-600" />
            Admin Panel
          </h1>
          {(pendingReports + pendingIds) > 0 && (
            <span className="bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full">
              {pendingReports + pendingIds} pending
            </span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Stats row — clickable */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {([
            { label: 'Total users',     value: users.length,   icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'hover:ring-blue-200',   stat: 'users' },
            { label: 'Open reports',    value: pendingReports, icon: AlertCircle, color: 'text-red-600',    bg: 'bg-red-50',    ring: 'hover:ring-red-200',    stat: 'reports' },
            { label: 'IDs to review',   value: pendingIds,     icon: Clock,       color: 'text-orange-600', bg: 'bg-orange-50', ring: 'hover:ring-orange-200', stat: 'pending_id' },
            { label: 'Suspended users', value: suspendedUsers, icon: XCircle,     color: 'text-gray-600',   bg: 'bg-gray-100',  ring: 'hover:ring-gray-300',   stat: 'suspended' },
          ] as const).map(({ label, value, icon: Icon, color, bg, ring, stat }) => (
            <button
              key={label}
              onClick={() => handleStatClick(stat)}
              className={`card p-4 flex items-center gap-3 text-left w-full cursor-pointer hover:shadow-md transition-all ring-2 ring-transparent ${ring} active:scale-[0.97]`}
            >
              <div className={`${bg} rounded-xl p-2.5 flex-shrink-0`}>
                <Icon size={20} className={color} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {([
            ['reports',  Flag,    `Reports${pendingReports > 0 ? ` (${pendingReports} open)` : ''}`],
            ['users',    Users,   `Users${pendingIds > 0 ? ` (${pendingIds} pending)` : ''}`],
            ['listings', Package, `All Listings (${allListings.length})`],
          ] as const).map(([t, Icon, label]) => (
            <button key={t} onClick={() => { setTab(t as typeof tab); if (t === 'users') setUserFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── REPORTS ─────────────────────────────────── */}
            {tab === 'reports' && (
              reports.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Flag size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="font-medium">No reports</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map(report => (
                    <div
                      key={report.id}
                      onClick={() => openReportModal(report)}
                      className={`card p-4 md:p-5 cursor-pointer hover:shadow-md transition-all active:scale-[0.99] ${
                        report.status === 'open' ? 'border-l-4 border-l-red-400' : 'opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`badge text-xs font-semibold px-2 py-1 ${
                            report.status === 'open' ? 'bg-red-100 text-red-600' :
                            report.status === 'resolved' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {report.status}
                          </span>
                          {report.listings && (
                            <span className="text-xs font-medium text-gray-700">{report.listings.title}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">"{report.reason}"</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Reported by <span className="font-medium text-gray-600">{(report as any).reporter?.name || 'Unknown'}</span>
                        {report.listing_id && <span className="ml-1 text-brand-500">· tap to view listing</span>}
                      </p>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── USERS ───────────────────────────────────── */}
            {tab === 'users' && (
              <>
                {/* User filter pills */}
                {(userFilter !== 'all' || pendingIds > 0 || suspendedUsers > 0) && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {([
                      ['all', 'All users'],
                      ['pending_id', `Pending ID (${pendingIds})`],
                      ['suspended', `Suspended (${suspendedUsers})`],
                    ] as const).map(([f, label]) => (
                      <button key={f} onClick={() => setUserFilter(f)}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                          userFilter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {filteredUsers.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">No users in this filter</div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block card overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            {['User', 'Role', 'Stats', 'ID Status', 'Actions'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredUsers.map(u => (
                            <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${u.is_suspended ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-3 cursor-pointer" onClick={() => setSelectedUserId(u.id)}>
                                <div className="font-medium text-gray-900 hover:text-brand-600 transition-colors">{u.name || 'Unnamed'}</div>
                                <div className="text-xs text-gray-400">{u.email}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="badge bg-gray-100 text-gray-600 capitalize">{u.role}</span>
                                {u.is_admin && <span className="badge bg-purple-100 text-purple-700 ml-1">Admin</span>}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {u.avg_rating > 0 && <div>★ {u.avg_rating.toFixed(1)}</div>}
                                <div>{u.total_shared} shared · {u.total_claimed} claimed</div>
                              </td>
                              <td className="px-4 py-3">
                                {u.id_doc_status === 'pending' && !u.id_verified ? (
                                  <div className="flex gap-1.5">
                                    <button onClick={() => openIdModal(u)}
                                      className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">Review ID</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    {u.id_verified
                                      ? <span className="flex items-center gap-0.5 text-xs text-brand-600"><CheckCircle size={12} /> Verified</span>
                                      : <span className="flex items-center gap-0.5 text-xs text-gray-400"><XCircle size={12} /> {u.id_doc_status}</span>}
                                    {u.is_suspended && <span className="badge bg-red-100 text-red-600 ml-1">Suspended</span>}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1.5">
                                  {!u.is_suspended ? (
                                    <button onClick={() => userAction(u.id, 'suspend')}
                                      className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200">Suspend</button>
                                  ) : (
                                    <button onClick={() => userAction(u.id, 'unsuspend')}
                                      className="text-xs px-2 py-1 rounded-lg bg-brand-100 text-brand-700 font-medium hover:bg-brand-200">Unsuspend</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {filteredUsers.map(u => (
                        <div key={u.id} className={`card p-4 ${u.is_suspended ? 'opacity-50' : ''} ${u.id_doc_status === 'pending' && !u.id_verified ? 'border-l-4 border-l-orange-400' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <button className="text-left" onClick={() => setSelectedUserId(u.id)}>
                              <p className="font-semibold text-sm text-gray-900 hover:text-brand-600 transition-colors">{u.name || 'Unnamed'}</p>
                              <p className="text-xs text-gray-400">{u.email} · {u.role}</p>
                            </button>
                            <div className="flex flex-wrap gap-1 justify-end">
                              {u.is_admin && <span className="badge bg-purple-100 text-purple-700 text-[10px]">Admin</span>}
                              {u.id_verified && <span className="badge bg-brand-100 text-brand-700 text-[10px]">ID ✓</span>}
                              {u.is_suspended && <span className="badge bg-red-100 text-red-700 text-[10px]">Suspended</span>}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mb-3">
                            {u.avg_rating > 0 ? `★ ${u.avg_rating.toFixed(1)} · ` : ''}{u.total_shared} shared · {u.total_claimed} claimed
                          </div>
                          {u.id_doc_status === 'pending' && !u.id_verified && (
                            <div className="bg-orange-50 rounded-xl p-3 mb-3">
                              <p className="text-xs font-semibold text-orange-700 mb-2">ID document pending review</p>
                              <div className="flex gap-2">
                                <button onClick={() => openIdModal(u)} className="text-xs py-1.5 px-3 rounded-lg bg-gray-100 text-gray-700 font-medium">Review</button>
                                <button onClick={() => userAction(u.id, 'verify_id')} className="flex-1 text-xs py-1.5 rounded-lg bg-brand-600 text-white font-medium">Approve</button>
                                <button onClick={() => userAction(u.id, 'reject_id')} className="flex-1 text-xs py-1.5 rounded-lg bg-red-100 text-red-600 font-medium">Reject</button>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2">
                            {!u.is_suspended ? (
                              <button onClick={() => userAction(u.id, 'suspend')} className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium">Suspend</button>
                            ) : (
                              <button onClick={() => userAction(u.id, 'unsuspend')} className="text-xs px-3 py-1.5 rounded-lg bg-brand-100 text-brand-700 font-medium">Unsuspend</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {/* ── LISTINGS ────────────────────────────────── */}
            {tab === 'listings' && (
              allListings.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Package size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="font-medium">No listings</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(['active','reserved','claimed','expired','removed'] as const).map(status => {
                    const group = allListings.filter(l => l.status === status);
                    if (group.length === 0) return null;
                    const STYLE: Record<string, string> = {
                      active: 'bg-brand-100 text-brand-700',
                      reserved: 'bg-yellow-100 text-yellow-700',
                      claimed: 'bg-green-100 text-green-700',
                      expired: 'bg-gray-100 text-gray-500',
                      removed: 'bg-red-100 text-red-500',
                    };
                    return (
                      <div key={status}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1.5 mt-4 first:mt-0">
                          {status} ({group.length})
                        </p>
                        {group.map(l => (
                          <div
                            key={l.id}
                            onClick={() => navigate(`/listing/${l.id}`, { state: { background: location } })}
                            className="card p-3 flex gap-3 mb-2 cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                          >
                            {l.photos[0] ? (
                              <img src={resolveAssetUrl(l.photos[0])} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-xl">🍱</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm text-gray-900 truncate flex-1">{l.title}</p>
                                <span className={`badge text-[10px] font-semibold capitalize flex-shrink-0 ${STYLE[status]}`}>{status}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">by {l.users?.name || '?'} · {l.neighborhood}</p>
                              <p className="text-xs text-gray-400">Expires {new Date(l.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                            </div>
                            {l.status !== 'removed' && (
                              <div className="flex gap-1.5 items-start flex-shrink-0">
                                <button
                                  onClick={e => { e.stopPropagation(); adminRemoveListing(l.id); }}
                                  className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-600 font-medium hover:bg-red-200"
                                >Remove</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* ── REPORT DETAIL MODAL ──────────────────────────── */}
      {reportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={() => setReportModal(null)}>
          <div
            className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs font-semibold ${
                    reportModal.status === 'open' ? 'bg-red-100 text-red-600' :
                    reportModal.status === 'resolved' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{reportModal.status}</span>
                  <h2 className="font-bold text-gray-900 text-sm">Report</h2>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(reportModal.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setReportModal(null)} className="p-2 rounded-full hover:bg-gray-100">
                <XCircle size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Report reason */}
              <div className="px-6 py-4 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reason</p>
                <p className="text-sm text-gray-800 leading-relaxed">"{reportModal.reason}"</p>
                <p className="text-xs text-gray-400 mt-2">
                  Reported by <span className="font-medium text-gray-600">{(reportModal as any).reporter?.name || 'Unknown'}</span>
                </p>
              </div>

              {/* Listing details */}
              {reportModal.listing_id ? (
                reportListingLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : reportListing ? (
                  <div>
                    {/* Photo carousel */}
                    {reportListing.photos.length > 0 ? (
                      <div className="relative bg-gray-100">
                        <img
                          src={resolveAssetUrl(reportListing.photos[photoIndex])}
                          alt="Listing photo"
                          className="w-full h-56 object-cover"
                        />
                        {reportListing.photos.length > 1 && (
                          <>
                            <button
                              onClick={() => setPhotoIndex(i => (i - 1 + reportListing.photos.length) % reportListing.photos.length)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <button
                              onClick={() => setPhotoIndex(i => (i + 1) % reportListing.photos.length)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60"
                            >
                              <ChevronRight size={16} />
                            </button>
                            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                              {reportListing.photos.map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIndex ? 'bg-white' : 'bg-white/50'}`} />
                              ))}
                            </div>
                          </>
                        )}
                        <span className={`absolute top-3 right-3 badge text-[10px] font-bold capitalize ${
                          reportListing.status === 'active' ? 'bg-brand-600 text-white' :
                          reportListing.status === 'removed' ? 'bg-red-600 text-white' :
                          'bg-gray-800 text-white'
                        }`}>{reportListing.status}</span>
                      </div>
                    ) : (
                      <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-3xl">🍱</div>
                    )}

                    {/* Listing info */}
                    <div className="px-6 py-4 space-y-3">
                      <div>
                        <p className="font-bold text-gray-900">{reportListing.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">by {reportListing.users?.name || 'Unknown'}</p>
                      </div>
                      {reportListing.description && (
                        <p className="text-sm text-gray-600 leading-relaxed">{reportListing.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {reportListing.categories.map(c => (
                          <span key={c} className="badge bg-gray-100 text-gray-600 text-[10px]">{c}</span>
                        ))}
                        {reportListing.dietary_tags.map(t => (
                          <span key={t} className="badge bg-brand-50 text-brand-700 text-[10px]">{t}</span>
                        ))}
                      </div>
                      {reportListing.pickup_address && (
                        <p className="text-xs text-gray-500">📍 {reportListing.pickup_address}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Expires: {new Date(reportListing.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center text-gray-400 text-sm">Listing not found or deleted</div>
                )
              ) : (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">No listing attached to this report</div>
              )}
            </div>

            {/* Actions */}
            {reportModal.status === 'open' && (
              <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2">
                {reportModal.listing_id && reportListing?.status === 'active' && (
                  <button
                    onClick={() => removeListing(reportModal.listing_id!, reportModal.id)}
                    className="flex-1 py-2.5 rounded-2xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
                  >
                    Remove listing
                  </button>
                )}
                <button
                  onClick={() => updateReport(reportModal.id, 'resolved')}
                  className="flex-1 py-2.5 rounded-2xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
                >
                  Resolve
                </button>
                <button
                  onClick={() => updateReport(reportModal.id, 'dismissed')}
                  className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ID REVIEW MODAL ──────────────────────────────── */}
      {idModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">ID Document Review</h2>
                <p className="text-sm text-gray-500 mt-0.5">{idModalUser.name || 'Unnamed'} · {idModalUser.email}</p>
              </div>
              <button onClick={() => setIdModalUser(null)} className="p-2 rounded-full hover:bg-gray-100">
                <XCircle size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden bg-gray-50 flex items-center justify-center min-h-64">
              {idDocLoading ? (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Loading document…</p>
                </div>
              ) : idDocUrl ? (
                idDocType === 'pdf' ? (
                  <iframe src={resolveAssetUrl(idDocUrl)} className="w-full h-96" title="ID Document" />
                ) : (
                  <img src={resolveAssetUrl(idDocUrl)} alt="ID Document" className="max-w-full max-h-96 object-contain rounded-xl" />
                )
              ) : (
                <div className="text-center text-gray-400 py-10">
                  <AlertCircle size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm font-medium">No document found</p>
                  <p className="text-xs mt-1">The user may not have uploaded their ID yet</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { userAction(idModalUser.id, 'reject_id'); setIdModalUser(null); }}
                className="flex-1 py-3 rounded-2xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => { userAction(idModalUser.id, 'verify_id'); setIdModalUser(null); }}
                className="flex-1 py-3 rounded-2xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── USER PROFILE POPUP ──────────────────────────── */}
      <UserProfilePopup userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </div>
  );
}
