import React from 'react';
import { TrendingUp, Calendar, Camera, FileText } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import GrowthChart from './GrowthChart';

// The effective entry date: the user-entered date when present, otherwise the
// timestamp the log was created.
const logDate = (log) => log.date || log.created_at;

const PlantCard = ({ plantName, plantLogs, large = false }) => {
  const { colors } = useTheme();

  // Sort logs chronologically by their effective date for charting.
  const sortedLogs = [...plantLogs].sort(
    (a, b) => new Date(logDate(a)) - new Date(logDate(b))
  );

  const chartData = sortedLogs.map((log) => ({
    date: new Date(logDate(log)).toLocaleDateString(),
    height: parseFloat(log.height),
    ph: log.ph ?? null,
  }));

  // Summary stats
  const latest = sortedLogs[sortedLogs.length - 1];
  const first = sortedLogs[0];
  const totalGrowth = latest && first ? (latest.height - first.height).toFixed(1) : '0';
  const daysTracked = sortedLogs.length > 1 
    ? Math.ceil((new Date(latest.created_at) - new Date(first.created_at)) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className={`${colors.bgSecondary} rounded-xl shadow-xl p-6 mb-6 ${colors.border} border transition-colors duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-2xl font-bold ${colors.primary}`}>{plantName}</h3>
        <div className={`flex items-center gap-2 ${colors.textMuted}`}>
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm">Active</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${colors.bgAccent} rounded-lg p-3 text-center`}>
          <div className="flex items-center justify-center mb-1">
            <TrendingUp size={16} className="text-green-400" />
          </div>
          <div className={`text-xl font-bold ${colors.text}`}>{latest?.height || 0}</div>
          <div className={`text-xs ${colors.textMuted}`}>Current Height (cm)</div>
        </div>
        
        <div className={`${colors.bgAccent} rounded-lg p-3 text-center`}>
          <div className="flex items-center justify-center mb-1">
            <TrendingUp size={16} className="text-blue-400" />
          </div>
          <div className={`text-xl font-bold ${colors.text}`}>+{totalGrowth}</div>
          <div className={`text-xs ${colors.textMuted}`}>Total Growth (cm)</div>
        </div>
        
        <div className={`${colors.bgAccent} rounded-lg p-3 text-center`}>
          <div className="flex items-center justify-center mb-1">
            <Calendar size={16} className="text-purple-400" />
          </div>
          <div className={`text-xl font-bold ${colors.text}`}>{daysTracked}</div>
          <div className={`text-xs ${colors.textMuted}`}>Days Tracked</div>
        </div>
        
        <div className={`${colors.bgAccent} rounded-lg p-3 text-center`}>
          <div className="flex items-center justify-center mb-1">
            <FileText size={16} className="text-orange-400" />
          </div>
          <div className={`text-xl font-bold ${colors.text}`}>{plantLogs.length}</div>
          <div className={`text-xs ${colors.textMuted}`}>Total Entries</div>
        </div>
      </div>

      {/* Growth Chart */}
      {chartData.length > 1 ? (
        <div className="mb-8">
          <h4 className={`text-lg font-semibold ${colors.text} mb-3`}>Growth Progress</h4>
          <GrowthChart data={chartData} large={large} />
        </div>
      ) : (
        <div className={`mb-8 ${colors.bgAccent} rounded-xl p-6 text-center`}>
          <TrendingUp size={28} className={`mx-auto mb-2 ${colors.textMuted} opacity-60`} />
          <p className={`text-sm ${colors.textMuted}`}>
            Add another log to see the growth trend.
          </p>
        </div>
      )}

      {/* Recent Logs - Fixed spacing to prevent overlap */}
      <div>
        <h4 className={`text-lg font-semibold ${colors.text} mb-3 flex items-center gap-2`}>
          <FileText size={18} />
          Recent Logs
        </h4>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {sortedLogs.slice(-3).reverse().map((log) => (
            <div
              key={log.id}
              className={`${colors.bgAccent} rounded-lg p-4 ${colors.border} border transition-colors duration-200`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`text-sm font-medium ${colors.text}`}>
                    {new Date(logDate(log)).toLocaleDateString()}
                  </div>
                  {log.image_url && (
                    <Camera size={14} className="text-blue-400" />
                  )}
                </div>
                <div className={`text-lg font-bold ${colors.primary}`}>
                  {log.height} cm
                </div>
              </div>

              <div className={`text-sm ${colors.textMuted} mb-2`}>
                <strong>Nutrients:</strong> {log.nutrients}
                {(log.ph !== null && log.ph !== undefined) && (
                  <span className="ml-3"><strong>pH:</strong> {log.ph}</span>
                )}
              </div>
              
              {log.notes && (
                <div className={`text-sm ${colors.text} italic`}>
                  "{log.notes}"
                </div>
              )}
            </div>
          ))}
          
          {plantLogs.length === 0 && (
            <div className={`text-center ${colors.textMuted} py-8`}>
              <FileText size={48} className="mx-auto mb-2 opacity-50" />
              <p>No logs yet. Add your first growth entry!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PlantCards = ({ plants, selectedPlant }) => {
  const { colors } = useTheme();

  if (!plants || Object.keys(plants).length === 0) {
    return (
      <div className={`${colors.bgSecondary} rounded-xl shadow-xl p-8 text-center ${colors.border} border transition-colors duration-300`}>
        <TrendingUp size={64} className={`mx-auto mb-4 ${colors.textMuted} opacity-50`} />
        <h3 className={`text-xl font-semibold ${colors.text} mb-2`}>
          No Plants Yet
        </h3>
        <p className={`${colors.textMuted}`}>
          Add your first plant to start tracking its growth journey!
        </p>
      </div>
    );
  }

  // A single selected plant gets a larger, focused detail chart.
  if (selectedPlant && plants[selectedPlant]) {
    return (
      <div className="space-y-6">
        <PlantCard
          key={selectedPlant}
          plantName={selectedPlant}
          plantLogs={plants[selectedPlant]}
          large
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(plants).map(([plantName, logs]) => (
        <PlantCard key={plantName} plantName={plantName} plantLogs={logs} />
      ))}
    </div>
  );
};

export default PlantCards;