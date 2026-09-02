// src/App.jsx
import React, { useState, useEffect } from 'react';
import { fetchBackendStatus } from './api/api';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppDataProvider, useAppData } from './contexts/AppDataContext';
import { AssistantProvider, useAssistant } from './contexts/AssistantContext';
import { TOUR_STEPS } from './data/onboarding';
import ErrorBoundary from './components/ErrorBoundary';
import BudMascot from './components/Assistant/BudMascot';
import AmbientLeaves from './components/Ambient/AmbientLeaves';
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
  const { plants, logs, loading, refreshing, error, refresh } = useAppData();
  const { tourStep, tourDone } = useAssistant();
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const selectedPlant = plants.find((p) => p.id === selectedPlantId) || null;

  // Damaged-store banner: the backend keeps serving but refuses writes when
  // the data file cannot be read. Re-checked after every load/refresh so a
  // successful restore clears it.
  const [damaged, setDamaged] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchBackendStatus()
      .then((s) => { if (!cancelled) setDamaged(s.damaged); })
      .catch(() => { /* the data-load error banner already covers an unreachable backend */ });
    return () => { cancelled = true; };
  }, [loading, error]);

  // While the welcome tour is running, gently highlight the tab its current step
  // wants the user to visit.
  const tourActive = !tourDone && tourStep != null && tourStep < TOUR_STEPS.length;
  const tourTab = tourActive ? TOUR_STEPS[tourStep].tab : null;

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
      <AmbientLeaves />
      <BudMascot activeTab={activeTab} selectedPlant={selectedPlant} onNavigate={setActiveTab} />
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
                } ${tourTab === tab.key ? 'ring-2 ring-light-primary dark:ring-dark-primary animate-pulse' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Refresh indicator: a subtle top bar shown while a background refresh
            (post-mutation refetch) is in flight, instead of the full spinner. */}
        {refreshing && (
          <div
            data-testid="refresh-bar"
            className="h-0.5 w-full bg-light-primary dark:bg-dark-primary animate-pulse"
          />
        )}

        {/* Content Area */}
        <div
          className="flex-1 overflow-y-auto p-6 bg-light-bg dark:bg-dark-bg transition-colors duration-300"
          aria-busy={refreshing}
        >
          {damaged && (
            <div role="alert" data-testid="damaged-banner" className="mb-4 bg-red-900/20 border border-red-500/40 rounded-lg p-4 text-sm space-y-1">
              <div className="text-red-400 font-semibold">
                {damaged.tooNew
                  ? 'Your plant data was saved by a newer version of this app. Nothing will be changed until you update the app.'
                  : 'Your plant data could not be read. Nothing will be saved until it is repaired.'}
              </div>
              {damaged.salvagePath && (
                <div className="text-red-300">A copy of the unreadable file was kept at <span className="font-mono break-all">{damaged.salvagePath}</span>.</div>
              )}
              <div className="text-red-300">
                {damaged.tooNew
                  ? `Data file: ${damaged.dataFile}. Install the newer version, or restore an older backup from Settings after updating.`
                  : 'Restore a backup from the Settings tab, or replace the data file and restart the app.'}
              </div>
            </div>
          )}
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
            <AssistantProvider>
              <AppContent />
            </AssistantProvider>
          </AppDataProvider>
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
