import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Users, UserPlus, CheckCircle2, XCircle, AlertCircle, Phone, Mail } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { allUsers, currentUser, inviteUser, toggleUserStatus, updateUserRole } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setStatusMsg({ type: 'error', text: 'Name and email are required.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await inviteUser({
        name: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim() || undefined,
        role: newRole,
      });
      setStatusMsg({ type: 'success', text: `User ${newName} invited successfully.` });
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewRole('staff');
      setShowInviteModal(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to invite user.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200">Admin</span>;
      case 'staff':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">Staff</span>;
      case 'driver':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">Driver</span>;
      case 'customer_viewer':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">Customer</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-800" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-display">User & Role Management</h2>
            <p className="text-xs text-gray-500">
              Manage database team members, access roles, and permissions
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm cursor-pointer transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-center gap-2.5">
        <span className="font-semibold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] uppercase tracking-wide">
          Public Signup Disabled
        </span>
        <span>
          For security, public self-registration is permanently disabled. New staff and driver accounts must be created here by an administrator.
        </span>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Registered App Users ({allUsers.length})
          </span>
          <span className="text-[11px] text-gray-400">
            Identity derived directly from PostgreSQL & Supabase Auth
          </span>
        </div>

        <div className="divide-y divide-gray-100 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Member Name</th>
                <th className="py-3 px-4">Email / Phone</th>
                <th className="py-3 px-4">System Role</th>
                <th className="py-3 px-4">Status</th>
                {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{u.name}</div>
                        {u.id === currentUser?.id && (
                          <span className="text-[10px] text-emerald-600 font-medium">(You)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span>{u.email}</span>
                      </div>
                      {u.phone && (
                        <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{u.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {isAdmin && u.id !== currentUser?.id ? (
                      <select
                        value={u.role}
                        onChange={(e) => updateUserRole(u.id, e.target.value as UserRole)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-800 bg-white cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="driver">Driver</option>
                        <option value="customer_viewer">Customer</option>
                      </select>
                    ) : (
                      getRoleBadge(u.role)
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                        <XCircle className="w-3 h-3 text-red-600" /> Inactive
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-3.5 px-4 text-right">
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => toggleUserStatus(u.id, !u.isActive)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                            u.isActive
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 font-display">Invite Team Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Nair"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@starciti.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 9447000000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Access Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="staff">Staff (Operations & Billing Desk)</option>
                  <option value="driver">Driver (Mobile Trip Logging Only)</option>
                  <option value="customer_viewer">Customer (Logbook Review & Approval)</option>
                  <option value="admin">Administrator (Full Access & Series Admin)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Inviting...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
