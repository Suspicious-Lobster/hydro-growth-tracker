import React from 'react';
import { TrendingUp, Calendar, Camera, FileText } from 'lucide-react';
import GrowthChart from './GrowthChart';

const PlantCard = ({ plantName, plantLogs }) => {
  // Sort logs by date for charting
  const sortedLogs = [...plantLogs].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  
  const chartData = sortedLogs.map((log) => ({
    date: new Date(log.created_at).toLocaleDateString(),
    height: parseFloat(log.height),
  }));

  // Summary stats
  const latest = sortedLogs[sortedLogs.length - 1];
  const first = sortedLogs[0];
  const totalGrowth = latest && first ? (latest.height - first.height).toFixed(1) : '0';
  const daysTracked = sortedLogs.length > 1 
    ? Math.ceil((new Date(latest.created_at) - new Date(first.created_at)) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="bg-brandGray-light rounded-xl shadow-xl p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold text-hydro">{plantName}</h3>
        <div className="flex items-center gap-2 text-hydro-light">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm">Active</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp size={16} className="text-green-400" />
          </div>
          <div className="text-xl font-bold text-hydro">{latest?.height || 0}</div>
          <div className="text-xs text-hydro-light">Current Height (cm)</div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp size={16} className="text-blue-400" />
          </div>
          <div className="text-xl font-bold text-hydro">+{totalGrowth}</div>
          <div className="text-xs text-hydro-light">Total Growth (cm)</div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <Calendar size={16} className="text-purple-400" />
          </div>
          <div className="text-xl font-bold text-hydro">{daysTracked}</div>
          <div className="text-xs text-hydro-light">Days Tracked</div>
        </div>
        
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <FileText size={16} className="text-orange-400" />
          </div>
          <div className="text-xl font-bold text-hydro">{plantLogs.length}</div>
          <div className="text-xs text-hydro-light">Total Logs</div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-hydro mb-3">Growth Chart</h4>
        <div className="h-64">
          <GrowthChart data={chartData} />
        </div>
      </div>

      {/* Recent Logs */}
      <div>
        <h4 className="text-lg font-semibold text-hydro mb-3">Recent Logs</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedLogs.slice(-5).reverse().map((log) => (
            <div key={log.id} className="bg-gray-800/30 rounded-lg p-3 flex items-center gap-3">
              {log.image_url && (
                <img
                  src={`http://localhost:5000${log.image_url}`}
                  alt="Plant"
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-hydro-light">
                  <Calendar size={14} />
                  {new Date(log.created_at).toLocaleDateString()}
                </div>
                <div className="text-hydro font-medium">
                  Height: {log.height} cm
                </div>
                {log.notes && (
                  <div className="text-sm text-hydro-light italic">
                    "{log.notes}"
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-hydro-light">Nutrients</div>
                <div className="text-sm text-hydro">{log.nutrients}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PlantCards = ({ plants, selectedPlant }) => {
  const plantsToShow = selectedPlant 
    ? { [selectedPlant]: plants[selectedPlant] }
    : plants;

  return (
    <div className="space-y-6">
      {Object.entries(plantsToShow).map(([plantName, plantLogs]) => (
        <PlantCard key={plantName} plantName={plantName} plantLogs={plantLogs} />
      ))}
      
      {Object.keys(plantsToShow).length === 0 && (
        <div className="text-center text-hydro-light py-12">
          <div className="text-6xl mb-4">🌱</div>
          <h3 className="text-xl font-semibold mb-2">No plants to display</h3>
          <p>Add your first plant log to get started!</p>
        </div>
      )}
    </div>
  );
};

export default PlantCards;