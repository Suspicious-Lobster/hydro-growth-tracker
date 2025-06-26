// src/App.jsx
import React, { useState, useEffect } from 'react';
import api from './api/api';
import GrowthForm from './components/AddLogForm';
import FeedingSchedule from './components/FeedingSchedule';
import ExportCSVButton from './components/ExportCSVButton';
import ThemeToggle from './components/ThemeToggle';
import PlantSidebar from './components/PlantSidebar';
import PlantCards from './components/PlantCards';

function groupLogsByPlant(logs) {
  const grouped = {};
  logs.forEach((log) => {
    if (!grouped[log.plant_name]) grouped[log.plant_name] = [];
    grouped[log.plant_name].push(log);
  });
  return grouped;
}

function App() {
  const [logs, setLogs] = useState([]);
  const [plants, setPlants] = useState({});
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const fetchLogs = async () => {
    try {
      const res = await api.get('/logs');
      setLogs(res.data);
      setPlants(groupLogsByPlant(res.data));
    } catch (err) {
      console.error('API fetch error:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handlePlantSelect = (plantName) => {
    setSelectedPlant(plantName);
    setActiveTab('dashboard');
  };

  const handleShowAll = () => {
    setSelectedPlant(null);
    setActiveTab('dashboard');
  };

  const refreshLogs = () => {
    fetchLogs();
  };

  /* -----------------------------  JSX  ---------------------------- */

  return (
    <div className="min-h-screen bg-brandGray text-hydro-light flex">
      {/* Sidebar */}
      <PlantSidebar
        plants={plants}
        selectedPlant={selectedPlant}
        onPlantSelect={handlePlantSelect}
        onShowAll={handleShowAll}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-brandGray-light border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-hydro">
                {selectedPlant ? `${selectedPlant} Dashboard` : 'Hydro Growth Tracker'}
              </h1>
              <p className="text-hydro-light">
                {selectedPlant 
                  ? `Viewing ${plants[selectedPlant]?.length || 0} logs for ${selectedPlant}`
                  : `Managing ${Object.keys(plants).length} plants with ${logs.length} total logs`
                }
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ExportCSVButton />
              <ThemeToggle />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {['dashboard', 'add-log', 'feeding'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-hydro text-brandGray'
                    : 'text-hydro-light hover:bg-gray-800'
                }`}
              >
                {tab === 'add-log' ? 'Add Log' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <PlantCards plants={plants} selectedPlant={selectedPlant} />
          )}
          
          {activeTab === 'add-log' && (
            <div className="max-w-2xl mx-auto">
              <GrowthForm refreshLogs={refreshLogs} />
            </div>
          )}
          
          {activeTab === 'feeding' && (
            <div className="max-w-4xl mx-auto">
              <FeedingSchedule />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
