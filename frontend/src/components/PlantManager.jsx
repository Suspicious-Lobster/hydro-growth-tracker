import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const PlantManager = ({ plants, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [newPlantName, setNewPlantName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { colors } = useTheme();

  const handleAddPlant = async (e) => {
    e.preventDefault();
    if (!newPlantName.trim()) return;

    setIsSubmitting(true);
    try {
      // Check if plant already exists
      if (plants[newPlantName.trim()]) {
        alert('A plant with this name already exists!');
        return;
      }

      // Create an initial log entry for the new plant
      const response = await fetch('http://localhost:5000/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plant_name: newPlantName.trim(),
          height: 0,
          nutrients: 'Initial setup',
          notes: 'Plant added to tracking system',
        }),
      });

      if (response.ok) {
        setNewPlantName('');
        setShowAddForm(false);
        onRefresh(); // Refresh the plants list
      } else {
        throw new Error('Failed to add plant');
      }
    } catch (error) {
      console.error('Error adding plant:', error);
      alert('Failed to add plant. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlant = async (plantName) => {
    setIsSubmitting(true);
    try {
      // Delete all logs for this plant
      const response = await fetch(`http://localhost:5000/logs/plant/${encodeURIComponent(plantName)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShowDeleteConfirm(null);
        onRefresh(); // Refresh the plants list
      } else {
        throw new Error('Failed to delete plant');
      }
    } catch (error) {
      console.error('Error deleting plant:', error);
      alert('Failed to delete plant. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const plantNames = Object.keys(plants);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-3xl font-bold ${colors.primary}`}>🌱 Plant Management</h2>
          <p className={`${colors.textMuted}`}>Add new plants or remove ones you no longer want to track</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className={`${colors.primaryBg} text-white px-4 py-2 rounded-lg font-medium ${colors.primaryHover} transition-colors duration-200 flex items-center gap-2`}
        >
          <Plus size={18} />
          Add Plant
        </button>
      </div>

      {/* Add Plant Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgSecondary} rounded-lg p-6 w-full max-w-md mx-4 ${colors.border} border`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-semibold ${colors.text}`}>Add New Plant</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className={`${colors.textMuted} hover:${colors.text} transition-colors`}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPlant} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                  Plant Name
                </label>
                <input
                  type="text"
                  value={newPlantName}
                  onChange={(e) => setNewPlantName(e.target.value)}
                  placeholder="e.g., Tomato Plant #1, Basil, Lettuce"
                  className="input-field"
                  required
                  disabled={isSubmitting}
                />
                <p className={`text-sm ${colors.textMuted} mt-1`}>
                  Choose a unique name to identify this plant
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting || !newPlantName.trim()}
                  className={`flex-1 ${colors.primaryBg} text-white py-2 rounded-lg font-medium ${colors.primaryHover} transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isSubmitting ? 'Adding...' : 'Add Plant'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  disabled={isSubmitting}
                  className={`px-4 py-2 ${colors.bgAccent} ${colors.text} rounded-lg font-medium hover:${colors.bgSecondary} transition-colors duration-200`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${colors.bgSecondary} rounded-lg p-6 w-full max-w-md mx-4 ${colors.border} border`}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-500" />
              <h3 className={`text-xl font-semibold ${colors.text}`}>Delete Plant</h3>
            </div>

            <p className={`${colors.text} mb-2`}>
              Are you sure you want to delete <strong>"{showDeleteConfirm}"</strong>?
            </p>
            <p className={`text-sm ${colors.textMuted} mb-6`}>
              This will permanently delete all {plants[showDeleteConfirm]?.length || 0} logs for this plant. This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => handleDeletePlant(showDeleteConfirm)}
                disabled={isSubmitting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Plant'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isSubmitting}
                className={`px-4 py-2 ${colors.bgAccent} ${colors.text} rounded-lg font-medium hover:${colors.bgSecondary} transition-colors duration-200`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plants List */}
      <div className={`${colors.bgSecondary} rounded-lg p-6 ${colors.border} border`}>
        <h3 className={`text-xl font-semibold ${colors.text} mb-4`}>Current Plants ({plantNames.length})</h3>
        
        {plantNames.length === 0 ? (
          <div className={`text-center ${colors.textMuted} py-8`}>
            <div className="text-6xl mb-4">🌱</div>
            <h4 className="text-lg font-medium mb-2">No plants being tracked</h4>
            <p>Add your first plant to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plantNames.map((plantName) => {
              const plantLogs = plants[plantName];
              const latestLog = plantLogs[plantLogs.length - 1];
              const firstLog = plantLogs[0];
              const totalGrowth = latestLog && firstLog ? (parseFloat(latestLog.height) - parseFloat(firstLog.height)).toFixed(1) : '0';
              const daysTracked = plantLogs.length > 1 
                ? Math.ceil((new Date(latestLog.created_at) - new Date(firstLog.created_at)) / (1000 * 60 * 60 * 24))
                : 0;

              return (
                <div key={plantName} className={`${colors.bgAccent} rounded-lg p-4 flex items-center justify-between ${colors.border} border`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <h4 className={`font-semibold ${colors.text}`}>{plantName}</h4>
                        <div className={`text-sm ${colors.textMuted} flex gap-4`}>
                          <span>{plantLogs.length} logs</span>
                          <span>{latestLog?.height || 0} cm current</span>
                          <span>+{totalGrowth} cm growth</span>
                          <span>{daysTracked} days tracked</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowDeleteConfirm(plantName)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors duration-200"
                    title={`Delete ${plantName}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {plantNames.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${colors.bgSecondary} rounded-lg p-4 text-center ${colors.border} border`}>
            <div className={`text-2xl font-bold ${colors.primary}`}>
              {plantNames.length}
            </div>
            <div className={`text-sm ${colors.textMuted}`}>
              Plants Tracked
            </div>
          </div>
          
          <div className={`${colors.bgSecondary} rounded-lg p-4 text-center ${colors.border} border`}>
            <div className={`text-2xl font-bold ${colors.secondary}`}>
              {Object.values(plants).reduce((total, logs) => total + logs.length, 0)}
            </div>
            <div className={`text-sm ${colors.textMuted}`}>
              Total Logs
            </div>
          </div>
          
          <div className={`${colors.bgSecondary} rounded-lg p-4 text-center ${colors.border} border`}>
            <div className={`text-2xl font-bold ${colors.accent}`}>
              {Object.values(plants).reduce((total, logs) => {
                const latest = logs[logs.length - 1];
                return total + (parseFloat(latest?.height) || 0);
              }, 0).toFixed(1)}
            </div>
            <div className={`text-sm ${colors.textMuted}`}>
              Combined Height (cm)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantManager;