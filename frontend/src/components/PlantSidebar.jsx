import React from 'react';
import { TreePine, BarChart3, Plus, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const PlantSidebar = ({ plants, selectedPlant, onPlantSelect, onShowAll, onManagePlants }) => {
  const { colors } = useTheme();
  const plantNames = Object.keys(plants);

  return (
    <div className={`w-64 ${colors.bgSecondary} ${colors.border} border-r h-full flex flex-col transition-colors duration-300`}>
      {/* Header */}
      <div className={`p-4 border-b ${colors.border}`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-xl font-bold ${colors.primary} flex items-center gap-2`}>
            <TreePine size={24} />
            My Plants
          </h2>
          <button
            onClick={onManagePlants}
            className={`${colors.textMuted} hover:${colors.primary} transition-colors`}
            title="Manage Plants"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* All Plants Option */}
        <button
          onClick={onShowAll}
          className={`w-full text-left p-3 rounded-lg mb-2 flex items-center gap-2 transition-colors duration-200 ${
            selectedPlant === null
              ? `${colors.primaryBg} text-white font-semibold`
              : `${colors.textSecondary} hover:${colors.bgAccent}`
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
                    ? `${colors.primaryBg} text-white font-semibold`
                    : `${colors.textSecondary} hover:${colors.bgAccent}`
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
          <div className={`text-center ${colors.textMuted} mt-8`}>
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