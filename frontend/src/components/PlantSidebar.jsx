import React from 'react';
import { TreePine, BarChart3, Plus } from 'lucide-react';

const PlantSidebar = ({ plants, selectedPlant, onPlantSelect, onShowAll }) => {
  const plantNames = Object.keys(plants);

  return (
    <div className="w-64 bg-brandGray-light border-r border-gray-700 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-hydro flex items-center gap-2">
          <TreePine size={24} />
          My Plants
        </h2>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* All Plants Option */}
        <button
          onClick={onShowAll}
          className={`w-full text-left p-3 rounded-lg mb-2 flex items-center gap-2 transition-colors ${
            selectedPlant === null
              ? 'bg-hydro text-brandGray font-semibold'
              : 'text-hydro-light hover:bg-gray-800'
          }`}
        >
          <BarChart3 size={18} />
          All Plants ({plantNames.length})
        </button>

        {/* Individual Plants */}
        <div className="space-y-1">
          {plantNames.map((plantName) => {
            const plantLogs = plants[plantName];
            const latestLog = plantLogs[plantLogs.length - 1];
            const isSelected = selectedPlant === plantName;

            return (
              <button
                key={plantName}
                onClick={() => onPlantSelect(plantName)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-hydro text-brandGray font-semibold'
                    : 'text-hydro-light hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{plantName}</div>
                    <div className="text-sm opacity-70">
                      {plantLogs.length} logs • {latestLog?.height || 0} cm
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Add Plant Hint */}
        {plantNames.length === 0 && (
          <div className="text-center text-hydro-light/60 mt-8">
            <Plus size={48} className="mx-auto mb-2 opacity-50" />
            <p>No plants yet</p>
            <p className="text-sm">Add your first log to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlantSidebar;