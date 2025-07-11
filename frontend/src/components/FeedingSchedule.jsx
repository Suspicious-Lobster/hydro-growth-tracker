import React, { useState, useEffect } from 'react';
import { Calendar, Droplets, Scissors, Eye, AlertTriangle, CheckCircle, Clock, Calculator } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/api';
import NutrientCalculator from './NutrientCalculator';
import FeedingScheduleCalendarExport from './FeedingScheduleCalendarExport';

const FeedingSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [plants, setPlants] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorStage, setCalculatorStage] = useState('vegetative');
  const [showCalendarExport, setShowCalendarExport] = useState(false);
  const { colors } = useTheme();

  // Fetch data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchSchedules(), fetchPlants()]);
      } catch (err) {
        setError('Failed to load data. Please try again.');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchSchedules(), fetchPlants()]);
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await api.get('/feeding');
      const feedingData = Array.isArray(res.data) ? res.data : [];
      setSchedules(feedingData);
    } catch (err) {
      console.error('Feeding API error:', err);
      setSchedules([]);
    }
  };

  const fetchPlants = async () => {
    try {
      const res = await api.get('/logs');
      const logsData = Array.isArray(res.data) ? res.data : [];
      
      const grouped = {};
      logsData.forEach((log) => {
        if (log && log.plant_name) {
          if (!grouped[log.plant_name]) grouped[log.plant_name] = [];
          grouped[log.plant_name].push(log);
        }
      });
      setPlants(grouped);
    } catch (err) {
      console.error('Plants API error:', err);
      setPlants({});
    }
  };

  // SIMPLIFIED VERSION - Only use simple recommendations
  const getPlantRecommendations = (plantName) => {
    const plantLogs = plants[plantName] || [];
    if (!Array.isArray(plantLogs) || plantLogs.length === 0) return null;

    const sortedLogs = [...plantLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const latestLog = sortedLogs[sortedLogs.length - 1];
    const firstLog = sortedLogs[0];
    
    if (!latestLog || !firstLog) return null;

    const currentHeight = parseFloat(latestLog.height) || 0;
    const daysTracked = Math.ceil((new Date(latestLog.created_at) - new Date(firstLog.created_at)) / (1000 * 60 * 60 * 24));
    const growthRate = sortedLogs.length > 1 ? (currentHeight - parseFloat(firstLog.height)) / Math.max(daysTracked, 1) : 0;

    // Determine growth stage and recommendations
    let stage, stageColor, recommendations;
    
    if (currentHeight < 10) {
      stage = 'Seedling';
      stageColor = 'text-green-400';
      recommendations = {
        feeding: 'Light nutrient solution (EC 0.6-0.8). Feed every 2-3 days.',
        pruning: 'No pruning needed. Focus on healthy root development.',
        monitoring: 'Watch for damping off. Ensure proper humidity (60-70%).'
      };
    } else if (currentHeight < 30) {
      stage = 'Vegetative';
      stageColor = 'text-blue-400';
      recommendations = {
        feeding: 'Moderate nutrient solution (EC 1.0-1.4). Feed daily.',
        pruning: 'Start light pruning of lower leaves. Remove yellowing leaves.',
        monitoring: 'Check for pests. Monitor leaf color and growth rate.'
      };
    } else if (currentHeight < 60) {
      stage = 'Pre-Flowering';
      stageColor = 'text-yellow-400';
      recommendations = {
        feeding: 'Balanced nutrient solution (EC 1.4-1.8). Reduce nitrogen slightly.',
        pruning: 'Top pruning to encourage bushiness. Remove lower branches.',
        monitoring: 'Watch for flowering signs. Adjust light cycle if needed.'
      };
    } else {
      stage = 'Mature/Flowering';
      stageColor = 'text-purple-400';
      recommendations = {
        feeding: 'Strong nutrient solution (EC 1.6-2.0). Focus on P-K nutrients.',
        pruning: 'Minimal pruning. Remove only dead/yellowing leaves.',
        monitoring: 'Check for nutrient deficiencies. Monitor pH closely.'
      };
    }

    return {
      stage,
      stageColor,
      currentHeight,
      daysTracked: Math.max(daysTracked, 0),
      growthRate: growthRate.toFixed(2),
      feeding: recommendations.feeding,
      pruning: recommendations.pruning,
      monitoring: recommendations.monitoring
    };
  };

  const getUpcomingTasks = () => {
    const today = new Date();
    const tasks = [];

    // Add scheduled feedings
    if (Array.isArray(schedules)) {
      schedules.forEach(schedule => {
        if (!schedule) return;
        
        const lastFed = new Date(schedule.last_fed || schedule.created_at);
        const daysSinceLastFed = Math.floor((today - lastFed) / (1000 * 60 * 60 * 24));
        
        let feedingInterval;
        switch(schedule.frequency) {
          case 'daily': feedingInterval = 1; break;
          case 'every-2-days': feedingInterval = 2; break;
          case 'weekly': feedingInterval = 7; break;
          default: feedingInterval = 1;
        }

        if (daysSinceLastFed >= feedingInterval) {
          tasks.push({
            type: 'feeding',
            plant: schedule.plant_name,
            task: `Feed ${schedule.plant_name}`,
            priority: daysSinceLastFed > feedingInterval ? 'high' : 'medium',
            overdue: daysSinceLastFed > feedingInterval,
            details: `${schedule.nutrient_type} - EC ${schedule.ec_level}`
          });
        }
      });
    }

    // Add plant-specific recommendations
    Object.keys(plants).forEach(plantName => {
      const recs = getPlantRecommendations(plantName);
      if (recs) {
        if (recs.stage === 'Vegetative' || recs.stage === 'Pre-Flowering') {
          tasks.push({
            type: 'pruning',
            plant: plantName,
            task: `Check pruning for ${plantName}`,
            priority: 'low',
            details: recs.pruning
          });
        }

        tasks.push({
          type: 'monitoring',
          plant: plantName,
          task: `Monitor ${plantName}`,
          priority: 'medium',
          details: recs.monitoring
        });
      }
    });

    return tasks.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const openCalculator = (plantName) => {
    const recommendations = getPlantRecommendations(plantName);
    setCalculatorStage(recommendations?.stage || 'vegetative');
    setShowCalculator(true);
  };

  const AddScheduleForm = () => {
    const [form, setForm] = useState({
      plant_name: '',
      nutrient_type: '',
      ec_level: '',
      frequency: 'daily',
      notes: ''
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        await api.post('/feeding', form);
        setForm({ plant_name: '', nutrient_type: '', ec_level: '', frequency: 'daily', notes: '' });
        setShowAddForm(false);
        fetchSchedules();
      } catch (err) {
        console.error('Error adding schedule:', err);
        alert('Failed to add schedule. Please try again.');
      }
    };

    return (
      <div className={`${colors.bgSecondary} rounded-lg p-6 mb-6 border ${colors.border}`}>
        <h3 className={`text-xl font-semibold ${colors.text} mb-4`}>Add Feeding Schedule</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={form.plant_name}
              onChange={(e) => setForm({...form, plant_name: e.target.value})}
              className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            >
              <option value="">Select Plant</option>
              {Object.keys(plants).map(plant => (
                <option key={plant} value={plant}>{plant}</option>
              ))}
            </select>
            
            <input
              type="text"
              placeholder="Nutrient Type (e.g., General Hydroponics)"
              value={form.nutrient_type}
              onChange={(e) => setForm({...form, nutrient_type: e.target.value})}
              className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="number"
              step="0.1"
              placeholder="EC Level (e.g., 1.2)"
              value={form.ec_level}
              onChange={(e) => setForm({...form, ec_level: e.target.value})}
              className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              required
            />
            
            <select
              value={form.frequency}
              onChange={(e) => setForm({...form, frequency: e.target.value})}
              className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="daily">Daily</option>
              <option value="every-2-days">Every 2 Days</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>

          <textarea
            placeholder="Additional notes..."
            value={form.notes}
            onChange={(e) => setForm({...form, notes: e.target.value})}
            className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            rows="3"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className={`${colors.primaryBg} text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity`}
            >
              Add Schedule
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className={`${colors.bgAccent} ${colors.text} px-6 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity border ${colors.border}`}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto`}></div>
          <p className={`${colors.textMuted} mt-4`}>Loading feeding schedule...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-red-400" size={24} />
          <div>
            <h3 className="text-red-400 font-semibold">Error Loading Data</h3>
            <p className="text-red-300">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-3xl font-bold ${colors.primary}`}>🌿 Feeding & Care Schedule</h2>
          <p className={`${colors.textMuted}`}>Intelligent recommendations based on plant growth stages</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCalendarExport(!showCalendarExport)}
            className={`${colors.bgAccent} ${colors.text} px-4 py-2 rounded-lg font-medium hover:opacity-80 transition-opacity border ${colors.border} flex items-center gap-2`}
          >
            <Calendar size={16} />
            Export Calendar
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`${colors.primaryBg} text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity`}
          >
            {showAddForm ? 'Cancel' : 'Add Schedule'}
          </button>
        </div>
      </div>

      {/* Add Schedule Form */}
      {showAddForm && <AddScheduleForm />}

      {/* Upcoming Tasks */}
      <div className={`${colors.bgSecondary} rounded-lg p-6 border ${colors.border} transition-colors duration-300`}>
        <h3 className={`text-xl font-semibold ${colors.text} mb-4 flex items-center gap-2`}>
          <Clock size={20} />
          Today's Tasks
        </h3>
        <div className="space-y-3">
          {getUpcomingTasks().slice(0, 6).map((task, index) => (
            <div key={index} className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-300 ${
              task.priority === 'high' ? 'bg-red-900/10 border border-red-500/30' :
              task.priority === 'medium' ? 'bg-yellow-900/10 border border-yellow-500/30' :
              `${colors.bgAccent}`
            }`}>
              <div className="flex-shrink-0">
                {task.type === 'feeding' && <Droplets size={18} className="text-blue-500" />}
                {task.type === 'pruning' && <Scissors size={18} className="text-green-500" />}
                {task.type === 'monitoring' && <Eye size={18} className="text-purple-500" />}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${colors.text}`}>{task.task}</div>
                <div className={`text-sm ${colors.textMuted}`}>{task.details}</div>
              </div>
              {task.overdue && (
                <AlertTriangle size={16} className="text-red-500" />
              )}
            </div>
          ))}
          
          {getUpcomingTasks().length === 0 && (
            <div className={`text-center ${colors.textMuted} py-8`}>
              <CheckCircle size={48} className="mx-auto mb-2 text-green-500" />
              <p>All caught up! No urgent tasks today.</p>
            </div>
          )}
        </div>
      </div>

      {/* Plant Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(plants).map(([plantName]) => {
          const recommendations = getPlantRecommendations(plantName);
          
          if (!recommendations) {
            return (
              <div key={plantName} className={`${colors.bgSecondary} rounded-xl shadow-lg p-6`}>
                <h3 className={`text-xl font-semibold ${colors.text}`}>{plantName}</h3>
                <p className={`${colors.textMuted} mt-2`}>No data available for recommendations</p>
              </div>
            );
          }

          return (
            <div key={plantName} className={`${colors.bgSecondary} rounded-xl shadow-lg p-6 border ${colors.border}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-xl font-semibold ${colors.text}`}>{plantName}</h3>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${recommendations.stageColor}`}>{recommendations.stage}</span>
                  <span className={`text-sm ${colors.textMuted}`}>({recommendations.currentHeight} cm)</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className={`${colors.bgAccent} rounded p-2`}>
                    <div className={`text-sm ${colors.textMuted}`}>Days Tracked</div>
                    <div className={`font-semibold ${colors.text}`}>{recommendations.daysTracked}</div>
                  </div>
                  <div className={`${colors.bgAccent} rounded p-2`}>
                    <div className={`text-sm ${colors.textMuted}`}>Growth Rate</div>
                    <div className={`font-semibold ${colors.text}`}>{recommendations.growthRate} cm/day</div>
                  </div>
                  <div className={`${colors.bgAccent} rounded p-2`}>
                    <div className={`text-sm ${colors.textMuted}`}>Height</div>
                    <div className={`font-semibold ${colors.text}`}>{recommendations.currentHeight} cm</div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Droplets size={16} className="text-blue-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className={`font-medium ${colors.text} text-sm`}>Feeding</div>
                      <div className={`text-sm ${colors.textMuted}`}>{recommendations.feeding}</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Scissors size={16} className="text-green-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className={`font-medium ${colors.text} text-sm`}>Pruning</div>
                      <div className={`text-sm ${colors.textMuted}`}>{recommendations.pruning}</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Eye size={16} className="text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className={`font-medium ${colors.text} text-sm`}>Monitor</div>
                      <div className={`text-sm ${colors.textMuted}`}>{recommendations.monitoring}</div>
                    </div>
                  </div>
                </div>

                {/* Calculator Button */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openCalculator(plantName)}
                    className={`${colors.primaryBg} text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2`}
                  >
                    <Calculator size={16} />
                    Calculate Precise Nutrients
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Schedules */}
      <div className={`${colors.bgSecondary} rounded-lg p-6 border ${colors.border}`}>
        <h3 className={`text-xl font-semibold ${colors.text} mb-4`}>Active Feeding Schedules</h3>
        {!Array.isArray(schedules) || schedules.length === 0 ? (
          <div className={`text-center ${colors.textMuted} py-8`}>
            <Calendar size={48} className="mx-auto mb-2 opacity-50" />
            <p>No feeding schedules yet. Add one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map(schedule => (
              <div key={schedule.id} className={`${colors.bgAccent} rounded-lg p-4 flex items-center justify-between`}>
                <div>
                  <div className={`font-medium ${colors.text}`}>{schedule.plant_name}</div>
                  <div className={`text-sm ${colors.textMuted}`}>
                    {schedule.nutrient_type} • EC {schedule.ec_level} • {schedule.frequency}
                  </div>
                  {schedule.notes && (
                    <div className={`text-sm ${colors.textMuted} italic mt-1`}>{schedule.notes}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-sm ${colors.textMuted}`}>Last Fed</div>
                  <div className={`text-sm ${colors.text}`}>
                    {schedule.last_fed ? new Date(schedule.last_fed).toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar Export Modal */}
      {showCalendarExport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.bgSecondary} rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${colors.text}`}>Export Feeding Schedule to Calendar</h3>
              <button
                onClick={() => setShowCalendarExport(false)}
                className={`${colors.textMuted} hover:${colors.text} transition-colors`}
              >
                ✕
              </button>
            </div>
            <FeedingScheduleCalendarExport />
          </div>
        </div>
      )}

      {/* Nutrient Calculator Modal */}
      {showCalculator && (
        <NutrientCalculator
          plantStage={calculatorStage}
          onClose={() => setShowCalculator(false)}
        />
      )}
    </div>
  );
};

export default FeedingSchedule;
