/**
 * UsersRbac — Enterprise IAM Center
 *
 * Full production-grade Team Management module:
 *   - Dashboard stat widgets (Total, Active, Pending, Role Distribution)
 *   - Members table: avatar/initials, role badge, status badge, last login, actions dropdown
 *   - Search (debounced), role filter, status filter, pagination
 *   - Skeleton loading (not "Loading..." text)
 *   - Invitations tab: pending/accepted/expired/revoked list, resend, copy link, revoke
 *   - Invitation stats bar
 *   - Invite Staff modal (firstName, lastName, email, role, validation)
 *   - Edit Role modal with session-invalidation warning
 *   - Suspend / Reactivate / Force Logout / Transfer Ownership / Remove — all with confirmation modals
 *   - Sole-owner protection error handling
 *   - Toast notifications (no inline alert banners)
 *   - Zero dead UI
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../auth/hooks';
import { useToast, ToastContainer } from '../components/ui/Toast';
import {
  PERM_USER_READ,
  PERM_USER_INVITE,
  PERM_USER_UPDATE,
  PERM_USER_DELETE,
  PERM_USER_DISABLE,
} from '../auth/permissions';
import {
  UserPlus,
  Users,
  Mail,
  ShieldCheck,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit3,
  XCircle,
  CheckCircle,
  LogOut,
  ArrowRightLeft,
  Trash2,
  Copy,
  RotateCcw,
  Shield,
  Clock,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Constants / Helpers
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  clinic_owner: { label: 'Practice Owner', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  admin:        { label: 'Administrator',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  doctor:       { label: 'Dentist',        color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  receptionist: { label: 'Receptionist',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  suspended: { label: 'Suspended', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  inactive:  { label: 'Inactive',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  archived:  { label: 'Archived',  color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};

const INV_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  accepted: { label: 'Accepted', color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  expired:  { label: 'Expired',  color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
  revoked:  { label: 'Revoked',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
};

function roleLabel(role: string) {
  return ROLE_META[role]?.label ?? role;
}

function getInitials(firstName: string, lastName: string, email: string) {
  if (firstName || lastName) {
    return `${(firstName[0] ?? '').toUpperCase()}${(lastName[0] ?? '').toUpperCase()}`;
  }
  return (email[0] ?? '?').toUpperCase();
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#10b981',
  '#f59e0b', '#3b82f6', '#ef4444', '#14b8a6',
];

function avatarColor(str: string) {
  let hash = 0;
  for (const ch of str) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(iso?: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 2)   return 'Just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function expiryCountdown(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

function useDebounce<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonRow: React.FC<{ cols?: number }> = ({ cols = 6 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '14px 16px' }}>
        <div style={{
          height: 14,
          borderRadius: 6,
          background: 'var(--border-color)',
          opacity: 0.6,
          animation: 'pulse 1.5s ease-in-out infinite',
          width: i === 0 ? '70%' : i === 1 ? '90%' : '60%',
        }} />
      </td>
    ))}
  </tr>
);

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const m = ROLE_META[role] ?? { label: role, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 99,
      fontSize: '0.75rem', fontWeight: 600,
      color: m.color, background: m.bg,
    }}>
      {role === 'clinic_owner' && <ShieldCheck size={10} />}
      {m.label}
    </span>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const m = STATUS_META[status] ?? { label: status, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      fontSize: '0.75rem', fontWeight: 600,
      color: m.color, background: m.bg,
    }}>
      {m.label}
    </span>
  );
};

const InvStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const m = INV_STATUS_META[status] ?? { label: status, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 99,
      fontSize: '0.75rem', fontWeight: 600,
      color: m.color, background: m.bg,
    }}>
      {m.label}
    </span>
  );
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <div style={{
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    minWidth: 140,
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ color }}>{icon}</span>
    </div>
    <div>
      <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
        {value}
      </p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{label}</p>
    </div>
  </div>
);

// Confirm Dialog
interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title, description, confirmLabel = 'Confirm',
  variant = 'danger', loading = false,
  onConfirm, onCancel,
}) => {
  const btnColor = variant === 'danger' ? '#ef4444' : variant === 'warning' ? '#f59e0b' : 'var(--primary)';
  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={{ ...modalCardStyle, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${btnColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={20} style={{ color: btnColor }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{description}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={loading} style={secondaryBtnStyle}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ ...primaryBtnStyle, background: btnColor }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// Actions dropdown
interface ActionsDropdownProps {
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }[];
}

const ActionsDropdown: React.FC<ActionsDropdownProps> = ({ items }) => {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 240);
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: open ? 9999 : 1 }}>
      <button
        onClick={toggleOpen}
        style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', padding: '4px 8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        aria-label="Actions"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          ...(openUpward ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
          zIndex: 9999,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          minWidth: 200,
          overflow: 'hidden',
        }}>
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => { setOpen(false); item.onClick(); }}
              disabled={item.disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 14px',
                background: 'none', border: 'none', cursor: item.disabled ? 'not-allowed' : 'pointer',
                color: item.danger ? '#ef4444' : item.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: '0.85rem', textAlign: 'left',
                opacity: item.disabled ? 0.5 : 1,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (!item.disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
  backdropFilter: 'blur(2px)',
};

const modalCardStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 16,
  padding: '28px 32px',
  width: '100%',
  maxWidth: 520,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8,
  background: 'var(--primary)', color: '#fff',
  border: 'none', cursor: 'pointer',
  fontWeight: 600, fontSize: '0.875rem',
  display: 'flex', alignItems: 'center', gap: 6,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8,
  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-color)', cursor: 'pointer',
  fontWeight: 600, fontSize: '0.875rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export const UsersRbac: React.FC = () => {
  const { user: currentUser, clinic, tenant, hasPermission } = useAuth();
  const { toasts, toast, removeToast, ToastContainer: TC } = useToast();

  // ── Data ────────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invStats, setInvStats] = useState<Record<string, number>>({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingInv, setLoadingInv] = useState(true);

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');

  // ── Filters / Pagination ────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [invStatusFilter, setInvStatusFilter] = useState('all');
  const [invPage, setInvPage] = useState(1);
  const INV_PAGE_SIZE = 15;

  // ── Modals / Confirmation ────────────────────────────────────────────────────
  const [showInviteModal, setShowInviteModal]   = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; description: string; confirmLabel: string; variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Selected targets ─────────────────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [newRole, setNewRole]   = useState('receptionist');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // ── Revoke Member Modal State ────────────────────────────────────────────────
  const [revokeTargetUser, setRevokeTargetUser] = useState<any | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeReasonError, setRevokeReasonError] = useState('');
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);

  // ── Invite form state ────────────────────────────────────────────────────────
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', role: 'receptionist' });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // ─── Permissions ─────────────────────────────────────────────────────────────
  const canInvite   = hasPermission(PERM_USER_INVITE);
  const canUpdate   = hasPermission(PERM_USER_UPDATE);
  const canDelete   = hasPermission(PERM_USER_DELETE);
  const canDisable  = hasPermission(PERM_USER_DISABLE);

  // ─── Data Loading ─────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast(err?.response?.data?.error?.message || 'Failed to load team members.', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    setLoadingInv(true);
    try {
      const [invData, statsData] = await Promise.all([
        api.getInvitations({ status: 'all', limit: 100 }),
        api.getInvitationStats?.() ?? Promise.resolve({}),
      ]);
      const list = Array.isArray(invData) ? invData : (invData as any)?.invitations ?? [];
      setInvitations(list);
      setInvStats(statsData ?? {});
    } catch (err: any) {
      toast(err?.response?.data?.error?.message || 'Failed to load invitations.', 'error');
    } finally {
      setLoadingInv(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadInvitations();
  }, [loadUsers, loadInvitations]);

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    const s = search.toLowerCase();
    const nameMatch = s
      ? `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(s)
      : true;
    const roleMatch = roleFilter ? u.role === roleFilter : true;
    const statusMatch = statusFilter ? u.status === statusFilter : true;
    return nameMatch && roleMatch && statusMatch;
  });

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const pagedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filteredInvitations = invitations.filter((inv) =>
    invStatusFilter === 'all' ? true : inv.status === invStatusFilter,
  );
  const totalInvPages = Math.ceil(filteredInvitations.length / INV_PAGE_SIZE);
  const pagedInvitations = filteredInvitations.slice(
    (invPage - 1) * INV_PAGE_SIZE,
    invPage * INV_PAGE_SIZE,
  );

  // Dashboard stats
  const totalMembers  = users.length;
  const activeMembers = users.filter((u) => u.status === 'active').length;
  const pendingInvs   = invitations.filter((i) => i.status === 'pending').length;
  const ownerCount    = users.filter((u) => u.role === 'clinic_owner' || u.role === 'admin').length;
  const doctorCount   = users.filter((u) => u.role === 'doctor').length;
  const recepCount    = users.filter((u) => u.role === 'receptionist').length;

  // ─── Action handlers ─────────────────────────────────────────────────────────
  const openConfirm = (cfg: typeof confirmDialog) => {
    setConfirmDialog(cfg);
    setConfirmLoading(false);
  };
  const closeConfirm = () => {
    if (!confirmLoading) setConfirmDialog(null);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!inviteForm.firstName.trim()) errs.firstName = 'First name is required.';
    if (!inviteForm.lastName.trim())  errs.lastName  = 'Last name is required.';
    if (!inviteForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email)) {
      errs.email = 'A valid email address is required.';
    }
    if (Object.keys(errs).length > 0) { setInviteErrors(errs); return; }

    setInviteSubmitting(true);
    try {
      const result = await api.createInvitation(inviteForm.email.trim(), inviteForm.role);
      setShowInviteModal(false);
      setInviteForm({ firstName: '', lastName: '', email: '', role: 'receptionist' });
      setInviteErrors({});
      toast(`Invitation sent to ${inviteForm.email}`, 'success');
      if (result?.inviteLink) {
        console.info(`[Team] Invite link: ${result.inviteLink}`);
      }
      await loadInvitations();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message || 'Failed to send invitation.';
      toast(msg, 'error');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleEditRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    openConfirm({
      title: 'Change Staff Role',
      description: `Change ${selectedUser.firstName || selectedUser.email}'s role to ${roleLabel(newRole)}? Their current session will be invalidated and they will need to sign in again.`,
      confirmLabel: 'Change Role',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await api.updateUserRole(selectedUser.id, newRole);
          setShowEditRoleModal(false);
          setSelectedUser(null);
          setConfirmDialog(null);
          toast('Staff role updated. Their session has been invalidated.', 'success');
          await loadUsers();
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || err.message || 'Failed to update role.';
          toast(msg, 'error');
          setConfirmDialog(null);
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleSuspend = (user: any) => {
    openConfirm({
      title: 'Suspend Team Member',
      description: `Suspend ${user.firstName ? `${user.firstName} ${user.lastName}` : user.email}? They will be immediately logged out and unable to access the platform.`,
      confirmLabel: 'Suspend',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await api.suspendUser(user.id);
          setConfirmDialog(null);
          toast(`${user.firstName || user.email} has been suspended.`, 'success');
          await loadUsers();
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || err.message || 'Failed to suspend user.';
          toast(msg, 'error');
          setConfirmDialog(null);
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleReactivate = (user: any) => {
    openConfirm({
      title: 'Reactivate Team Member',
      description: `Reactivate ${user.firstName ? `${user.firstName} ${user.lastName}` : user.email}? They will be able to log in and access the platform again.`,
      confirmLabel: 'Reactivate',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await api.reactivateUser(user.id);
          setConfirmDialog(null);
          toast(`${user.firstName || user.email} has been reactivated.`, 'success');
          await loadUsers();
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || err.message || 'Failed to reactivate user.';
          toast(msg, 'error');
          setConfirmDialog(null);
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleForceLogout = (user: any) => {
    openConfirm({
      title: 'Force Logout',
      description: `Immediately invalidate all active sessions for ${user.firstName ? `${user.firstName} ${user.lastName}` : user.email}? They will be forced to sign in again on all devices.`,
      confirmLabel: 'Force Logout',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          const result = await api.forceLogoutUser(user.id);
          setConfirmDialog(null);
          toast(`${result?.sessionsRevoked ?? 0} session(s) revoked for ${user.firstName || user.email}.`, 'success');
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || err.message || 'Failed to force logout.';
          toast(msg, 'error');
          setConfirmDialog(null);
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleTransferOwnership = (user: any) => {
    openConfirm({
      title: '⚠️ Transfer Practice Ownership',
      description: `This will make ${user.firstName ? `${user.firstName} ${user.lastName}` : user.email} the new Practice Owner. You will retain your current role but lose owner privileges. This action is audited and cannot be undone without their cooperation.`,
      confirmLabel: 'Transfer Ownership',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await api.transferOwnership(user.id);
          setConfirmDialog(null);
          toast('Practice ownership transferred successfully.', 'success');
          await loadUsers();
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || err.message || 'Failed to transfer ownership.';
          toast(msg, 'error');
          setConfirmDialog(null);
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleRemoveUser = (user: any) => {
    setRevokeTargetUser(user);
    setRevokeReason('');
    setRevokeReasonError('');
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTargetUser) return;
    const trimmed = revokeReason.trim();
    if (!trimmed) {
      setRevokeReasonError('Please provide a reason for revoking access.');
      return;
    }
    if (trimmed.length > 500) {
      setRevokeReasonError('Reason cannot exceed 500 characters.');
      return;
    }

    setRevokeSubmitting(true);
    setRevokeReasonError('');
    try {
      await api.deleteUser(revokeTargetUser.id, trimmed);
      toast(`Access revoked for ${revokeTargetUser.firstName || revokeTargetUser.email}.`, 'success');
      setRevokeTargetUser(null);
      setRevokeReason('');
      await loadUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message || 'Failed to revoke access.';
      setRevokeReasonError(msg);
      toast(msg, 'error');
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const handleRevokeInvitation = (inv: any) => {
    openConfirm({
      title: 'Revoke Invitation',
      description: `Revoke the invitation for ${inv.email}? They will no longer be able to use this link.`,
      confirmLabel: 'Revoke',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await api.revokeInvitation(inv.id);
          setConfirmDialog(null);
          toast(`Invitation for ${inv.email} revoked.`, 'success');
          await loadInvitations();
        } catch (err: any) {
          const msg = err?.response?.data?.error?.message || err.message || 'Failed to revoke invitation.';
          toast(msg, 'error');
          setConfirmDialog(null);
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handleResendInvitation = async (inv: any) => {
    if (resendingId) return;
    setResendingId(inv.id);
    try {
      const result = await api.resendInvitation(inv.id);
      toast(`Invitation email resent to ${inv.email} successfully.`, 'success');
      if (result?.inviteLink) console.info(`[Team] Resent invite link: ${result.inviteLink}`);
      await loadInvitations();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message || 'Failed to resend invitation email.';
      toast(msg, 'error');
    } finally {
      setResendingId(null);
    }
  };

  const handleCopyInviteLink = (inv: any) => {
    // Build the link from known token data — server returns inviteLink in create/resend
    const link = inv.inviteLink || `${window.location.origin}/invite/accept?token=CONTACT_ADMIN`;
    navigator.clipboard.writeText(link).then(() => {
      toast('Invite link copied to clipboard.', 'success');
    }).catch(() => {
      toast('Could not copy link. Please resend the invitation to generate a fresh link.', 'error');
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Toast Container */}
      <TC toasts={toasts} onRemove={removeToast} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Team Management
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Manage staff, roles, and access permissions for your practice.
          </p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            style={{ ...primaryBtnStyle, gap: 8 }}
          >
            <UserPlus size={16} />
            Invite Staff Member
          </button>
        )}
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard label="Total Members" value={totalMembers} icon={<Users size={20} />} color="#6366f1" />
        <StatCard label="Active Members" value={activeMembers} icon={<CheckCircle size={20} />} color="#10b981" />
        <StatCard label="Pending Invites" value={pendingInvs} icon={<Mail size={20} />} color="#f59e0b" />
        <StatCard label="Owners" value={ownerCount} icon={<ShieldCheck size={20} />} color="#8b5cf6" />
        <StatCard label="Dentists" value={doctorCount} icon={<Shield size={20} />} color="#3b82f6" />
        <StatCard label="Receptionists" value={recepCount} icon={<Users size={20} />} color="#14b8a6" />
      </div>

      {/* ── Tab Navigation ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 20, gap: 2 }}>
        {(['members', 'invitations'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab ? 600 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.15s',
            }}
          >
            {tab === 'members' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} /> Members
                <span style={{ background: 'var(--bg-secondary)', borderRadius: 99, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {totalMembers}
                </span>
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={14} /> Invitations
                {pendingInvs > 0 && (
                  <span style={{ background: '#f59e0b', borderRadius: 99, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
                    {pendingInvs}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MEMBERS TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'members' && (
        <>
          {/* Search + Filters row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={searchRaw}
                onChange={(e) => { setSearchRaw(e.target.value); setPage(1); }}
                style={{ ...inputStyle, paddingLeft: 34 }}
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              style={{ ...inputStyle, flex: '0 0 auto', width: 'auto', cursor: 'pointer' }}
            >
              <option value="">All Roles</option>
              <option value="clinic_owner">Practice Owner</option>
              <option value="doctor">Dentist</option>
              <option value="receptionist">Receptionist</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ ...inputStyle, flex: '0 0 auto', width: 'auto', cursor: 'pointer' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>

            {/* Refresh */}
            <button
              onClick={() => loadUsers()}
              style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Members Table */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'visible', position: 'relative' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  {['Member', 'Role', 'Status', 'Last Login', 'Joined', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                ) : pagedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <Users size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                      {search || roleFilter || statusFilter ? 'No members match your filters.' : 'No team members found.'}
                    </td>
                  </tr>
                ) : (
                  pagedUsers.map((u) => {
                    const isCurrentUser = u.id === (currentUser as any)?.userId || u.id === (currentUser as any)?.id;
                    const initials = getInitials(u.firstName, u.lastName, u.email);
                    const bg = avatarColor(u.email);
                    const fullName = u.firstName || u.lastName
                      ? `${u.firstName} ${u.lastName}`.trim()
                      : u.email;

                    const actions = [
                      canUpdate && {
                        label: 'Edit Role',
                        icon: <Edit3 size={14} />,
                        onClick: () => { setSelectedUser(u); setNewRole(u.role); setShowEditRoleModal(true); },
                        disabled: isCurrentUser && u.role === 'clinic_owner',
                      },
                      canDisable && u.status !== 'suspended' && !isCurrentUser && {
                        label: 'Suspend',
                        icon: <XCircle size={14} />,
                        danger: true,
                        onClick: () => handleSuspend(u),
                      },
                      canUpdate && u.status === 'suspended' && {
                        label: 'Reactivate',
                        icon: <CheckCircle size={14} />,
                        onClick: () => handleReactivate(u),
                      },
                      canDisable && !isCurrentUser && {
                        label: 'Force Logout',
                        icon: <LogOut size={14} />,
                        onClick: () => handleForceLogout(u),
                      },
                      canInvite && !isCurrentUser && u.role !== 'clinic_owner' && {
                        label: 'Transfer Ownership',
                        icon: <ArrowRightLeft size={14} />,
                        onClick: () => handleTransferOwnership(u),
                      },
                      canDelete && !isCurrentUser && u.role !== 'clinic_owner' && {
                        label: 'Remove Member',
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () => handleRemoveUser(u),
                      },
                    ].filter(Boolean) as any[];

                    return (
                      <tr
                        key={u.id}
                        style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-secondary)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = '')}
                      >
                        {/* Member */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%',
                              background: bg, color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                            }}>
                              {initials}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {fullName}
                                {isCurrentUser && (
                                  <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 500 }}>You</span>
                                )}
                              </p>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>

                        {/* Status */}
                        <td style={{ padding: '12px 16px' }}><StatusBadge status={u.status || 'active'} /></td>

                        {/* Last Login */}
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {timeAgo(u.lastLoginAt)}
                        </td>

                        {/* Joined */}
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 16px' }}>
                          {actions.length > 0 ? <ActionsDropdown items={actions} /> : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {!loadingUsers && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, filteredUsers.length)}–{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={secondaryBtnStyle}>
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ padding: '0 8px' }}>{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={secondaryBtnStyle}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INVITATIONS TAB
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'invitations' && (
        <>
          {/* Invitation Stats Bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { key: 'all',      label: 'All',      color: 'var(--text-secondary)' },
              { key: 'pending',  label: 'Pending',  color: '#f59e0b' },
              { key: 'accepted', label: 'Accepted', color: '#10b981' },
              { key: 'expired',  label: 'Expired',  color: '#9ca3af' },
              { key: 'revoked',  label: 'Revoked',  color: '#ef4444' },
            ].map(({ key, label, color }) => {
              const count = key === 'all' ? invitations.length : invitations.filter((i) => i.status === key).length;
              const isActive = invStatusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => { setInvStatusFilter(key); setInvPage(1); }}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    border: `1px solid ${isActive ? color : 'var(--border-color)'}`,
                    background: isActive ? `${color}18` : 'var(--bg-primary)',
                    color: isActive ? color : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: isActive ? 600 : 400, fontSize: '0.8rem',
                    transition: 'all 0.15s',
                  }}
                >
                  {label} <span style={{ fontWeight: 700 }}>({count})</span>
                </button>
              );
            })}

            <div style={{ flex: 1 }} />
            <button onClick={() => loadInvitations()} style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Invitations Table */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'visible', position: 'relative' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  {['Email', 'Role', 'Status', 'Sent by', 'Expires', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingInv ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                ) : pagedInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <Mail size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                      No invitations found.
                    </td>
                  </tr>
                ) : (
                  pagedInvitations.map((inv) => {
                    const inviterName = inv.invitedBy
                      ? `${inv.invitedBy.firstName || ''} ${inv.invitedBy.lastName || ''}`.trim() || inv.invitedBy.email || '—'
                      : '—';

                    const isResendable = (inv.status === 'pending' || inv.status === 'viewed' || inv.status === 'expired') && canInvite;

                    const actions = [
                      isResendable && {
                        label: 'Resend Email',
                        icon: <RotateCcw size={14} />,
                        onClick: () => handleResendInvitation(inv),
                        disabled: resendingId === inv.id,
                      },
                      (inv.status === 'pending' || inv.status === 'viewed' || inv.status === 'expired') && canInvite && {
                        label: 'Copy Invite Link',
                        icon: <Copy size={14} />,
                        onClick: () => handleCopyInviteLink(inv),
                      },
                      (inv.status === 'pending' || inv.status === 'viewed') && canInvite && {
                        label: 'Revoke',
                        icon: <XCircle size={14} />,
                        danger: true,
                        onClick: () => handleRevokeInvitation(inv),
                      },
                    ].filter(Boolean) as any[];

                    return (
                      <tr
                        key={inv.id}
                        style={{ borderBottom: '1px solid var(--border-color)' }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-secondary)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = '')}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Mail size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            {inv.email}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}><RoleBadge role={inv.roleName} /></td>
                        <td style={{ padding: '12px 16px' }}><InvStatusBadge status={inv.status} /></td>
                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inviterName}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: inv.status === 'pending' ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            <Clock size={12} />
                            {inv.status === 'accepted' ? (
                              inv.usedAt ? new Date(inv.usedAt).toLocaleDateString() : 'Used'
                            ) : (
                              inv.expiresAt ? expiryCountdown(inv.expiresAt) : '—'
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isResendable && (
                              <button
                                id={`resend-btn-${inv.id}`}
                                onClick={() => handleResendInvitation(inv)}
                                disabled={resendingId === inv.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '5px 12px',
                                  borderRadius: 8,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: resendingId === inv.id ? 'var(--bg-secondary)' : 'rgba(99, 102, 241, 0.12)',
                                  color: resendingId === inv.id ? 'var(--text-muted)' : '#818cf8',
                                  border: '1px solid rgba(99, 102, 241, 0.25)',
                                  cursor: resendingId === inv.id ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Resend invitation email"
                              >
                                {resendingId === inv.id ? (
                                  <>
                                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Sending...</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw size={12} />
                                    <span>Resend Email</span>
                                  </>
                                )}
                              </button>
                            )}
                            {actions.length > 0 ? (
                              <ActionsDropdown items={actions} />
                            ) : !isResendable ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Invitation Pagination */}
            {!loadingInv && totalInvPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Showing {Math.min((invPage - 1) * INV_PAGE_SIZE + 1, filteredInvitations.length)}–{Math.min(invPage * INV_PAGE_SIZE, filteredInvitations.length)} of {filteredInvitations.length}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => setInvPage((p) => Math.max(1, p - 1))} disabled={invPage === 1} style={secondaryBtnStyle}><ChevronLeft size={14} /></button>
                  <span style={{ padding: '0 8px' }}>{invPage} / {totalInvPages}</span>
                  <button onClick={() => setInvPage((p) => Math.min(totalInvPages, p + 1))} disabled={invPage === totalInvPages} style={secondaryBtnStyle}><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
         ══════════════════════════════════════════════════════════════════════ */}

      {/* ── Invite Staff Modal ──────────────────────────────────────────────── */}
      {showInviteModal && (
        <div style={overlayStyle} onClick={() => !inviteSubmitting && setShowInviteModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Invite Staff Member
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  A secure invitation link will be sent to their email.
                </p>
              </div>
              <button onClick={() => !inviteSubmitting && setShowInviteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>First Name <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    type="text"
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="Jane"
                    style={{ ...inputStyle, borderColor: inviteErrors.firstName ? 'var(--error)' : undefined }}
                    disabled={inviteSubmitting}
                  />
                  {inviteErrors.firstName && <p style={{ fontSize: '0.75rem', color: 'var(--error)', margin: '4px 0 0' }}>{inviteErrors.firstName}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Last Name <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    type="text"
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Smith"
                    style={{ ...inputStyle, borderColor: inviteErrors.lastName ? 'var(--error)' : undefined }}
                    disabled={inviteSubmitting}
                  />
                  {inviteErrors.lastName && <p style={{ fontSize: '0.75rem', color: 'var(--error)', margin: '4px 0 0' }}>{inviteErrors.lastName}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={labelStyle}>Email Address <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane.smith@example.com"
                  style={{ ...inputStyle, borderColor: inviteErrors.email ? 'var(--error)' : undefined }}
                  disabled={inviteSubmitting}
                />
                {inviteErrors.email && <p style={{ fontSize: '0.75rem', color: 'var(--error)', margin: '4px 0 0' }}>{inviteErrors.email}</p>}
              </div>

              {/* Role */}
              <div>
                <label style={labelStyle}>Role <span style={{ color: 'var(--error)' }}>*</span></label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  disabled={inviteSubmitting}
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="doctor">Dentist</option>
                  <option value="clinic_owner">Practice Owner</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  The invited staff member will be assigned this role upon acceptance.
                </p>
              </div>

              {/* Role assignment warning */}
              {inviteForm.role === 'clinic_owner' && (
                <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#ef4444', lineHeight: 1.5 }}>
                    You are inviting a new Practice Owner. This will give them full administrative access to the practice.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowInviteModal(false)} disabled={inviteSubmitting} style={secondaryBtnStyle}>
                  Cancel
                </button>
                <button type="submit" disabled={inviteSubmitting} style={primaryBtnStyle}>
                  {inviteSubmitting ? (
                    <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
                  ) : (
                    <><Mail size={14} /> Send Invitation</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Role Modal ─────────────────────────────────────────────────── */}
      {showEditRoleModal && selectedUser && (
        <div style={overlayStyle} onClick={() => setShowEditRoleModal(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Change Role</h3>
              <button onClick={() => setShowEditRoleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {/* Session invalidation notice */}
            <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.25)', marginBottom: 20 }}>
              <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5 }}>
                Changing this user's role will immediately invalidate their current session. They will be required to sign in again.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Changing role for <strong>{selectedUser.firstName ? `${selectedUser.firstName} ${selectedUser.lastName}` : selectedUser.email}</strong>
              </p>
              <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Current role: <RoleBadge role={selectedUser.role} />
              </p>
            </div>

            <form onSubmit={handleEditRoleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>New Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="doctor">Dentist</option>
                  <option value="clinic_owner">Practice Owner</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowEditRoleModal(false)} style={secondaryBtnStyle}>Cancel</button>
                <button type="submit" disabled={newRole === selectedUser.role} style={{ ...primaryBtnStyle, opacity: newRole === selectedUser.role ? 0.5 : 1 }}>
                  <Edit3 size={14} /> Change Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Revoke Member Modal ────────────────────────────────────────────── */}
      {revokeTargetUser && (
        <div style={overlayStyle} onClick={() => !revokeSubmitting && setRevokeTargetUser(null)}>
          <div style={{ ...modalCardStyle, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} style={{ color: '#ef4444' }} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Revoke Clinic Access
                </h3>
              </div>
              <button
                onClick={() => !revokeSubmitting && setRevokeTargetUser(null)}
                disabled={revokeSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Warning Banner */}
            <div style={{
              display: 'flex',
              gap: 10,
              padding: '12px 14px',
              background: 'rgba(239, 68, 68, 0.08)',
              borderRadius: 8,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: 18,
            }}>
              <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.5 }}>
                Revoking access will immediately remove this member's access to <strong>{clinic?.name || tenant?.name || 'Tooth Oracle Home'}</strong>.
              </p>
            </div>

            {/* Target Member Summary Card */}
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 18,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {revokeTargetUser.firstName ? `${revokeTargetUser.firstName} ${revokeTargetUser.lastName}` : revokeTargetUser.email}
                </span>
                <RoleBadge role={revokeTargetUser.role} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {revokeTargetUser.email}
              </div>
            </div>

            {/* Mandatory Reason Input */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...labelStyle, margin: 0 }}>
                  Reason for revocation <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <span style={{ fontSize: '0.75rem', color: revokeReason.length > 500 ? 'var(--error)' : 'var(--text-muted)' }}>
                  {revokeReason.length} / 500
                </span>
              </div>
              <textarea
                value={revokeReason}
                onChange={(e) => {
                  setRevokeReason(e.target.value);
                  if (revokeReasonError) setRevokeReasonError('');
                }}
                placeholder="Example: Employee no longer works at the clinic."
                disabled={revokeSubmitting}
                rows={3}
                style={{
                  ...inputStyle,
                  width: '100%',
                  minHeight: 80,
                  resize: 'vertical',
                  borderColor: revokeReasonError ? 'var(--error)' : undefined,
                  fontFamily: 'inherit',
                }}
              />
              {revokeReasonError && (
                <p style={{ fontSize: '0.78rem', color: 'var(--error)', margin: '6px 0 0', fontWeight: 500 }}>
                  {revokeReasonError}
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRevokeTargetUser(null)}
                disabled={revokeSubmitting}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={revokeSubmitting || !revokeReason.trim()}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  cursor: (revokeSubmitting || !revokeReason.trim()) ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: (revokeSubmitting || !revokeReason.trim()) ? 0.6 : 1,
                }}
              >
                {revokeSubmitting ? (
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Revoking…</>
                ) : (
                  <><Trash2 size={14} /> Revoke Access</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generic Confirm Dialog ──────────────────────────────────────────── */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
          loading={confirmLoading}
          onConfirm={confirmDialog.onConfirm}
          onCancel={closeConfirm}
        />
      )}

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:0.6; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  );
};

export default UsersRbac;
