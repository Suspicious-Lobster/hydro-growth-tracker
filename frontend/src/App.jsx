// src/App.jsx
import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import api from './api/api';
import GrowthForm from './components/AddLogForm';
import FeedingSchedule from './components/FeedingSchedule';
import ExportCSVButton from './components/ExportCSVButton';
import ThemeToggle from './components/ThemeToggle';
import PlantSidebar from './components/PlantSidebar';
import PlantCards from './components/PlantCards';
import PlantManager from './components/PlantManager';
import LogViewer from './components/LogViewer';

function groupLogsByPlant(logs) {
  const grouped = {};
  logs.forEach((log) => {
    if (!grouped[log.plant_name]) grouped[log.plant_name] = [];
    grouped[log.plant_name].push(log);
  });
  return grouped;
}

function AppContent() {
  const [logs, setLogs] = useState([]);
  const [plants, setPlants] = useState({});
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchLogs = async () => {
    setLoadError(null);
    try {
      const res = await api.get('/logs');
      const data = Array.isArray(res.data) ? res.data : [];
      setLogs(data);
      setPlants(groupLogsByPlant(data));
    } catch (err) {
      console.error('API fetch error:', err);
      setLoadError('Could not reach the backend. Make sure the app is running, then retry.');
    } finally {
      setLoading(false);
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

  const handleManagePlants = () => {
    setActiveTab('manage-plants');
  };

  const tabs = ['dashboard', 'add-log', 'view-logs', 'feeding', 'manage-plants'];

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text flex transition-colors duration-300">
      {/* Sidebar */}
      <PlantSidebar
        plants={plants}
        selectedPlant={selectedPlant}
        onPlantSelect={handlePlantSelect}
        onShowAll={handleShowAll}
        onManagePlants={handleManagePlants}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary border-b border-light-border dark:border-dark-border p-4 transition-colors duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-light-primary dark:text-dark-primary">
                {selectedPlant ? `${selectedPlant} Dashboard` : 'Hydro Growth Tracker'}
              </h1>
              <p className="text-light-text-muted dark:text-dark-text-muted">
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
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-light-primary dark:bg-dark-primary text-white shadow-md'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-accent dark:hover:bg-dark-bg-accent'
                }`}
              >
                {tab === 'add-log' ? 'Add Log' : 
                 tab === 'view-logs' ? 'View Logs' :
                 tab === 'manage-plants' ? 'Manage Plants' :
                 tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-light-bg dark:bg-dark-bg transition-colors duration-300">
          {loadError && (
            <div className="max-w-4xl mx-auto mb-6 bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center justify-between gap-4">
              <p className="text-red-400 text-sm">{loadError}</p>
              <button
                onClick={fetchLogs}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-light-text-muted dark:text-dark-text-muted mt-4">Loading your plants…</p>
              </div>
            </div>
          ) : (
          <>
          {activeTab === 'dashboard' && (
            <PlantCards plants={plants} selectedPlant={selectedPlant} />
          )}
          
          {activeTab === 'add-log' && (
            <div className="max-w-2xl mx-auto">
              <GrowthForm refreshLogs={refreshLogs} />
            </div>
          )}
          
          {activeTab === 'view-logs' && (
            <div className="max-w-6xl mx-auto">
              <LogViewer onRefresh={refreshLogs} />
            </div>
          )}
          
          {activeTab === 'feeding' && (
            <div className="max-w-4xl mx-auto">
              <FeedingSchedule />
            </div>
          )}

          {activeTab === 'manage-plants' && (
            <div className="max-w-4xl mx-auto">
              <PlantManager plants={plants} onRefresh={refreshLogs} />
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
