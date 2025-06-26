import React from 'react';
import GrowthChart from './GrowthChart';

function groupLogsByPlant(logs) {
  const grouped = {};
  logs.forEach((log) => {
    if (!grouped[log.plant_name]) grouped[log.plant_name] = [];
    grouped[log.plant_name].push(log);
  });
  return grouped;
}

const Dashboard = ({ logs }) => {
  const plants = groupLogsByPlant(logs);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-hydro mb-4">🌿 Plant Dashboard</h2>
      {Object.keys(plants).length === 0 && <p>No logs yet.</p>}
      {Object.entries(plants).map(([plant, plantLogs]) => {
        // Sort logs by date for charting
        const sortedLogs = [...plantLogs].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        const chartData = sortedLogs.map((log) => ({
          date: new Date(log.created_at).toLocaleDateString(),
          height: parseFloat(log.height),
          nutrients: log.nutrients,
        }));

        // Summary stats
        const last = sortedLogs[sortedLogs.length - 1];
        const first = sortedLogs[0];
        const growth =
          last && first ? (last.height - first.height).toFixed(1) : '0';

        return (
          <div key={plant} className="bg-brandGray-light rounded-xl shadow-xl p-6 mb-8">
            <h3 className="text-xl font-semibold text-hydro mb-2">{plant}</h3>
            <div className="mb-4 text-sm text-hydro-light">
              <span>
                <strong>Total logs:</strong> {plantLogs.length}
              </span>
              <span className="ml-6">
                <strong>Growth:</strong> {growth} cm
              </span>
              <span className="ml-6">
                <strong>Last entry:</strong>{' '}
                {last ? new Date(last.created_at).toLocaleDateString() : '-'}
              </span>
            </div>
            <GrowthChart data={chartData} />
            <ul className="mt-4 space-y-2">
              {sortedLogs.map((log) => (
                <li key={log.id} className="bg-gray-800 p-3 rounded flex items-center">
                  <span className="font-semibold">
                    {log.date || new Date(log.created_at).toLocaleDateString()}:
                  </span>
                  <span className="ml-2">Height: {log.height} cm</span>
                  <span className="ml-2">Nutrients: {log.nutrients}</span>
                  {log.notes && (
                    <span className="ml-2 italic text-gray-400">({log.notes})</span>
                  )}
                  {log.image_url && (
                    <img
                      src={`http://localhost:5000${log.image_url}`}
                      alt="Plant"
                      style={{ maxWidth: 80, maxHeight: 80, marginLeft: 12, borderRadius: 8 }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default Dashboard;