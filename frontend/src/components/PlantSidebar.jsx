import React, { useState } from 'react';
import { TreePine, BarChart3, Plus, Settings, Droplets } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { currentHeight } from '../utils/stats';
import { formatLength } from '../utils/format';
import { dueCount } from '../utils/feeding';

const PlantSidebar = ({ selectedPlantId, onPlantSelect, onShowAll, onManagePlants }) => {
  const { colors } = useTheme();
  const { plants, schedules, settings, getPlantLogs } = useAppData();
  const [query, setQuery] = useState('');

  const lengthUnit = settings.units.length;
  const due = dueCount(schedules);
  const filtered = plants.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className={`w-64 flex-shrink-0 ${colors.bgSecondary} ${colors.border} border-r h-screen sticky top-0 flex flex-col transition-colors duration-300`}>
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
            title="Manage plants"
            aria-label="Manage plants"
          >
            <Settings size={18} />
          </button>
        </div>
        {due > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-500">
            <Droplets size={16} />
            {due} feeding{due === 1 ? '' : 's'} due
          </div>
        )}
      </div>

      {/* Search */}
      {plants.length > 5 && (
        <div className="px-4 pt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plants…"
            className={`w-full px-3 py-2 text-sm ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <button
          onClick={onShowAll}
          className={`w-full text-left p-3 rounded-lg mb-2 flex items-center gap-2 transition-colors duration-200 ${
            selectedPlantId === null
              ? `${colors.primaryBg} text-white font-semibold`
              : `${colors.textSecondary} hover:${colors.bgAccent}`
          }`}
        >
          <BarChart3 size={18} />
          All Plants ({plants.length})
        </button>

        <div className="space-y-1">
          {filtered.map((plant) => {
            const logs = getPlantLogs(plant);
            const isSelected = selectedPlantId === plant.id;
            return (
              <button
                key={plant.id}
                onClick={() => onPlantSelect(plant.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${
                  isSelected
                    ? `${colors.primaryBg} text-white font-semibold`
                    : `${colors.textSecondary} hover:${colors.bgAccent}`
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{plant.name}</div>
                    {/* No opacity here: 70 percent of the secondary colour fell under
                        axe's contrast floor on the CI runner's theme (MR-74). */}
                    <div className={`text-sm truncate ${isSelected ? '' : colors.textMuted}`}>
                      {logs.length} log{logs.length === 1 ? '' : 's'}
                      {logs.length > 0 && ` • ${formatLength(currentHeight(logs), lengthUnit)}`}
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>

        {plants.length === 0 && (
          <div className={`text-center ${colors.textMuted} mt-8`}>
            <Plus size={48} className="mx-auto mb-2 opacity-50" />
            <p>No plants yet</p>
            <button onClick={onManagePlants} className={`text-sm ${colors.primary} underline mt-1`}>
              Add your first plant
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlantSidebar;
