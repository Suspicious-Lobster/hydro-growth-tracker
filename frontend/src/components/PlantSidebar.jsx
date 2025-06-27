import React from 'react';
import { TreePine, BarChart3, Plus } from 'lucide-react';

const PlantSidebar = ({ plants, selectedPlant, onPlantSelect, onShowAll }) => {
  const plantNames = Object.keys(plants);

  return (
    <div className="w-64 bg-light-bg-secondary dark:bg-dark-bg-secondary border-r border-light-border dark:border-dark-border h-full flex flex-col transition-colors duration-300">
      {/* Header */}
      <div className="p-4 border-b border-light-border dark:border-dark-border">
        <h2 className="text-xl font-bold text-light-primary dark:text-dark-primary flex items-center gap-2">
          <TreePine size={24} />
          My Plants
        </h2>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* All Plants Option */}
        <button
          onClick={onShowAll}
          className={`w-full text-left p-3 rounded-lg mb-2 flex items-center gap-2 transition-colors duration-200 ${
            selectedPlant === null
              ? 'bg-light-primary dark:bg-dark-primary text-white font-semibold'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-accent dark:hover:bg-dark-bg-accent'
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
                className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${
                  isSelected
                    ? 'bg-light-primary dark:bg-dark-primary text-white font-semibold'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-accent dark:hover:bg-dark-bg-accent'
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
          <div className="text-center text-light-text-muted dark:text-dark-text-muted mt-8">
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