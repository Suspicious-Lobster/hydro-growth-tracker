import React, { useState, useEffect } from 'react';
import { Edit3, Save, X, Calendar, Camera, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api, { resolveImageUrl } from '../api/api';

const LogViewer = ({ onRefresh }) => {
  const { colors } = useTheme();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/logs');
      const logsData = Array.isArray(res.data) ? res.data : [];
      // Sort logs by date, newest first
      const sortedLogs = logsData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setLogs(sortedLogs);
    } catch (err) {
      setError('Failed to load logs. Please try again.');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const startEditing = (log) => {
    setEditingLog(log.id);
    setEditForm({
      plant_name: log.plant_name || '',
      height: log.height || '',
      nutrients: log.nutrients || '',
      notes: log.notes || ''
    });
  };

  const cancelEditing = () => {
    setEditingLog(null);
    setEditForm({});
  };

  const saveLog = async (logId) => {
    try {
      await api.put(`/logs/${logId}`, editForm);
      setEditingLog(null);
      setEditForm({});
      fetchLogs(); // Refresh the list
      if (onRefresh) onRefresh(); // Refresh parent data
    } catch (err) {
      console.error('Error updating log:', err);
      setError('Failed to update log. Please try again.');
    }
  };

  const deleteLog = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this log?')) return;
    
    try {
      await api.delete(`/logs/${logId}`);
      fetchLogs(); // Refresh the list
      if (onRefresh) onRefresh(); // Refresh parent data
    } catch (err) {
      console.error('Error deleting log:', err);
      setError('Failed to delete log. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={`${colors.bgPrimary} rounded-xl shadow-lg w-full p-8`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto`}></div>
          <p className={`${colors.textMuted} mt-4`}>Loading logs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${colors.bgPrimary} rounded-xl shadow-lg w-full p-8`}>
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-400" size={20} />
            <div>
              <h3 className={`font-semibold ${colors.text}`}>Error Loading Logs</h3>
              <p className={`${colors.textMuted} text-sm mt-1`}>{error}</p>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            className={`mt-4 px-4 py-2 ${colors.primaryBg} text-white rounded-lg text-sm hover:opacity-90 transition-opacity`}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${colors.bgPrimary} rounded-xl shadow-lg w-full`}>
      {/* Header */}
      <div className={`${colors.bgSecondary} p-6 rounded-t-xl border-b ${colors.border}`}>
        <div className="flex items-center gap-3">
          <Edit3 className="text-green-400" size={24} />
          <h2 className={`text-2xl font-bold ${colors.text}`}>View & Edit Logs</h2>
        </div>
        <p className={`${colors.textMuted} mt-2`}>
          View, edit, or delete your plant growth logs. Total logs: {logs.length}
        </p>
      </div>

      {/* Logs List */}
      <div className="p-6">
        {logs.length === 0 ? (
          <div className={`text-center ${colors.textMuted} py-12`}>
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>No logs found. Add your first growth log!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className={`${colors.bgSecondary} rounded-lg p-4 border ${colors.border}`}>
                {editingLog === log.id ? (
                  // Edit Form
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={`block text-sm font-medium ${colors.text} mb-1`}>Plant Name</label>
                        <input
                          type="text"
                          value={editForm.plant_name}
                          onChange={(e) => setEditForm({...editForm, plant_name: e.target.value})}
                          className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${colors.text} mb-1`}>Height (cm)</label>
                        <input
                          type="number"
                          value={editForm.height}
                          onChange={(e) => setEditForm({...editForm, height: e.target.value})}
                          className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${colors.text} mb-1`}>Nutrients</label>
                        <input
                          type="text"
                          value={editForm.nutrients}
                          onChange={(e) => setEditForm({...editForm, nutrients: e.target.value})}
                          className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${colors.text} mb-1`}>Notes</label>
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveLog(log.id)}
                        className={`px-4 py-2 ${colors.primaryBg} text-white rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center gap-2`}
                      >
                        <Save size={16} />
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEditing}
                        className={`px-4 py-2 ${colors.bgAccent} ${colors.text} rounded-lg text-sm hover:opacity-80 transition-opacity flex items-center gap-2`}
                      >
                        <X size={16} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className={`text-lg font-semibold ${colors.text}`}>{log.plant_name}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            {formatDate(log.created_at)}
                          </div>
                          {log.image_url && (
                            <div className="flex items-center gap-1">
                              <Camera size={14} />
                              Has Image
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(log)}
                          className={`${colors.textMuted} hover:${colors.primary} transition-colors p-2 rounded`}
                          title="Edit log"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => deleteLog(log.id)}
                          className={`${colors.textMuted} hover:text-red-500 transition-colors p-2 rounded`}
                          title="Delete log"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                      <div className={`${colors.bgAccent} p-3 rounded`}>
                        <span className={`text-sm ${colors.textMuted}`}>Height</span>
                        <div className={`font-semibold ${colors.text}`}>{log.height} cm</div>
                      </div>
                      <div className={`${colors.bgAccent} p-3 rounded`}>
                        <span className={`text-sm ${colors.textMuted}`}>Nutrients</span>
                        <div className={`font-semibold ${colors.text}`}>{log.nutrients || 'Not specified'}</div>
                      </div>
                      <div className={`${colors.bgAccent} p-3 rounded`}>
                        <span className={`text-sm ${colors.textMuted}`}>pH</span>
                        <div className={`font-semibold ${colors.text}`}>{log.ph || 'Not measured'}</div>
                      </div>
                    </div>

                    {log.notes && (
                      <div className={`${colors.bgAccent} p-3 rounded mb-3`}>
                        <span className={`text-sm ${colors.textMuted}`}>Notes</span>
                        <div className={`${colors.text} mt-1`}>{log.notes}</div>
                      </div>
                    )}

                    {log.image_url && (
                      <div className="mt-3">
                        <img
                          src={resolveImageUrl(log.image_url)}
                          alt={`${log.plant_name} growth photo`}
                          className="max-w-xs rounded-lg shadow-md"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
