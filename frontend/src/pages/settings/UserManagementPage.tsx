import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Edit2, Save, X, Users, Shield, Bell, Mail, Building2, AlertCircle, Send, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

type Role = 'ADMIN' | 'OPERATOR';
const DEPARTMENTS = ['AUT', 'DIR', 'FIA', 'GAF', 'HRD', 'NAT', 'PPI', 'PUR', 'RND', 'SDC', 'SLS'];

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  username: string;
  role: Role;
  department: string;
}

type UserForm = Omit<AppUser, 'id'> & { password?: string };

const EMPTY_FORM: UserForm = {
  fullName: '',
  email: '',
  whatsapp: '',
  username: '',
  role: 'OPERATOR',
  department: 'AUT',
  password: '',
};

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UserForm>(EMPTY_FORM);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<any[]>('/api/users');
      setUsers(
        res.data.map((u) => ({
          id: String(u.id),
          fullName: u.fullName,
          email: u.email,
          whatsapp: u.whatsappNumber,
          username: u.username,
          role: u.role,
          department: u.department || '-',
        })),
      );
    } catch (e) {
      console.error(e);
      setError('Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setShowCreateModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.username || !form.password) {
      setError('Full name, email, username, and password are required');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await apiClient.post('/api/users', {
        fullName: form.fullName,
        email: form.email,
        whatsappNumber: form.whatsapp,
        username: form.username,
        role: form.role,
        department: form.department,
        password: form.password,
      });
      await fetchUsers();
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error creating user');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user: AppUser) => {
    setEditingUserId(user.id);
    setEditForm({
      fullName: user.fullName,
      email: user.email,
      whatsapp: user.whatsapp,
      username: user.username,
      role: user.role,
      department: user.department || 'AUT',
      password: '',
    });
    setError(null);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingUserId) return;
    try {
      setSaving(true);
      setError(null);
      const payload: any = {
        fullName: editForm.fullName,
        email: editForm.email,
        whatsappNumber: editForm.whatsapp,
        username: editForm.username,
        role: editForm.role,
        department: editForm.department,
      };
      if (editForm.password) payload.password = editForm.password;
      await apiClient.put(`/api/users/${editingUserId}`, payload);
      await fetchUsers();
      setShowEditModal(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error updating user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (!window.confirm(`Delete user ${user.fullName}?`)) return;
    try {
      setSaving(true);
      setError(null);
      await apiClient.delete(`/api/users/${user.id}`);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      setError('Error deleting user');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async (user: AppUser) => {
    if (testingId) return;
    setTestingId(user.id);
    try {
      const res = await apiClient.post(`/api/users/${user.id}/test-notification`);
      alert(`Test sent to ${user.fullName}!\n\nStatus:\n${res.data?.details || 'Check logs for details'}`);
    } catch (e: any) {
      alert(`Failed to send test: ${e.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const roleColor = (role: string) =>
    role === 'ADMIN'
      ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
      : 'bg-gradient-to-r from-blue-500 to-cyan-500';
  const roleLabel = (role: string) => (role === 'ADMIN' ? 'Administrator' : 'User');

  const renderFormFields = (state: UserForm, setState: React.Dispatch<React.SetStateAction<UserForm>>, isEdit: boolean) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Full Name *</label>
        <input type="text" value={state.fullName} onChange={(e) => setState({ ...state, fullName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="John Doe" />
      </div>
      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
        <input type="email" value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="email@example.com" />
      </div>
      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp</label>
        <input type="tel" value={state.whatsapp} onChange={(e) => setState({ ...state, whatsapp: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0812..." />
      </div>
      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Username *</label>
        <input type="text" value={state.username} onChange={(e) => setState({ ...state, username: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="username" />
      </div>
      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Department *</label>
        <div className="relative">
          <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={state.department} onChange={(e) => setState({ ...state, department: e.target.value })} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
        </div>
      </div>
      <div>
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Role *</label>
        <div className="relative">
          <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={state.role} onChange={(e) => setState({ ...state, role: e.target.value as Role })} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
            <option value="ADMIN">Administrator</option>
            <option value="OPERATOR">User</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {isEdit ? 'New Password (optional)' : 'Password *'}
        </label>
        <input type="password" value={state.password} onChange={(e) => setState({ ...state, password: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={isEdit ? 'Leave blank to keep' : '•••••••'} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with icon-only "Create New User" button */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-xl p-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-slate-400 text-sm">Manage user profiles</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          title="Create New User"
          aria-label="Create New User"
          className="p-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg shadow-emerald-500/30 transition-colors"
        >
          <UserPlus size={22} />
        </button>
      </div>

      {error && !showCreateModal && !showEditModal && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Registered Users table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users size={20} /> Registered Users
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-4 px-6">User Details</th>
                <th className="py-4 px-6">Contact</th>
                <th className="py-4 px-6">Department</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 text-white font-bold shadow-md ${roleColor(user.role)}`}>
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{user.fullName}</div>
                        <div className="text-xs text-gray-500">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Mail size={14} /> {user.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Bell size={14} /> {user.whatsapp}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      <Building2 size={12} className="mr-1" />
                      {user.department}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${roleColor(user.role)}`}>
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleTestNotification(user)} disabled={testingId === user.id} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Test Notification (Email & WA)">
                        {testingId === user.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                      <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(user)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserPlus size={20} /> Create New User
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-200 flex items-center gap-2 mb-4 text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <form onSubmit={handleCreate}>
              {renderFormFields(form, setForm, false)}
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-white shadow-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit2 size={20} /> Edit User
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-200 flex items-center gap-2 mb-4 text-sm">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            {renderFormFields(editForm, setEditForm, true)}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={handleUpdate} disabled={saving} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-semibold flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
