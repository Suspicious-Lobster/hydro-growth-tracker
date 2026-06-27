// src/App.jsx
import React, { useState } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppDataProvider, useAppData } from './contexts/AppDataContext';
import ErrorBoundary from './components/ErrorBoundary';
import AddLogForm from './components/AddLogForm';
import FeedingSchedule from './components/FeedingSchedule';
import ExportCSVButton from './components/ExportCSVButton';
import ThemeToggle from './components/ThemeToggle';
import PlantSidebar from './components/PlantSidebar';
import Dashboard from './components/PlantCards';
import PlantManager from './components/PlantManager';
import LogViewer from './components/LogViewer';
import PlantDetail from './components/PlantDetail';
import SettingsPanel from './components/SettingsPanel';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'add-log', label: 'Add Log' },
  { key: 'view-logs', label: 'View Logs' },
  { key: 'feeding', label: 'Feeding' },
  { key: 'plants', label: 'Plants' },
  { key: 'settings', label: 'Settings' },
];

function AppContent() {
  const { plants, logs, loading, error, refresh } = useAppData();
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const selectedPlant = plants.find((p) => p.id === selectedPlantId) || null;

  const handlePlantSelect = (id) => {
    setSelectedPlantId(id);
    setActiveTab('dashboard');
  };

  const handleShowAll = () => {
    setSelectedPlantId(null);
    setActiveTab('dashboard');
  };

  const headerSubtitle = selectedPlant
    ? `${selectedPlant.species || 'Plant'}${selectedPlant.variety ? ` · ${selectedPlant.variety}` : ''}`
    : `Managing ${plants.length} plant${plants.length === 1 ? '' : 's'} · ${logs.length} total logs`;

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text flex transition-colors duration-300">
      <PlantSidebar
        selectedPlantId={selectedPlantId}
        onPlantSelect={handlePlantSelect}
        onShowAll={handleShowAll}
        onManagePlants={() => setActiveTab('plants')}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary border-b border-light-border dark:border-dark-border p-4 transition-colors duration-300">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-light-primary dark:text-dark-primary truncate">
                {selectedPlant ? selectedPlant.name : 'Hydro Growth Tracker'}
              </h1>
              <p className="text-light-text-muted dark:text-dark-text-muted truncate">{headerSubtitle}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <ExportCSVButton />
              <ThemeToggle />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-light-primary dark:bg-dark-primary text-white shadow-md'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-accent dark:hover:bg-dark-bg-accent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-light-bg dark:bg-dark-bg transition-colors duration-300">
          {error && (
            <div className="mb-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
              <span className="text-red-400 text-sm">{error}</span>
              <button onClick={refresh} className="text-sm text-red-300 underline">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-light-primary dark:border-dark-primary" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                selectedPlant
                  ? <PlantDetail plant={selectedPlant} onBack={handleShowAll} />
                  : <Dashboard onSelectPlant={handlePlantSelect} />
              )}
              {activeTab === 'add-log' && (
                <div className="max-w-2xl mx-auto">
                  <AddLogForm defaultPlantId={selectedPlantId} />
                </div>
              )}
              {activeTab === 'view-logs' && (
                <div className="max-w-6xl mx-auto"><LogViewer /></div>
              )}
              {activeTab === 'feeding' && (
                <div className="max-w-5xl mx-auto"><FeedingSchedule /></div>
              )}
              {activeTab === 'plants' && (
                <div className="max-w-4xl mx-auto"><PlantManager onSelectPlant={handlePlantSelect} /></div>
              )}
              {activeTab === 'settings' && (
                <div className="max-w-2xl mx-auto"><SettingsPanel /></div>
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
      <ErrorBoundary>
        <ToastProvider>
          <AppDataProvider>
            <AppContent />
          </AppDataProvider>
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
