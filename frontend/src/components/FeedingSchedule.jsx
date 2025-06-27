import React, { useState, useEffect } from 'react';
import { Calendar, Droplets, Scissors, Eye, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../api/api';

const FeedingSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [plants, setPlants] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
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
      // Ensure we have an array
      const feedingData = Array.isArray(res.data) ? res.data : [];
      setSchedules(feedingData);
    } catch (err) {
      console.error('Feeding API error:', err);
      setSchedules([]); // Set empty array on error
    }
  };

  const fetchPlants = async () => {
    try {
      const res = await api.get('/logs');
      // Ensure we have an array
      const logsData = Array.isArray(res.data) ? res.data : [];
      
      const grouped = {};
      logsData.forEach((log) => {
        if (log && log.plant_name) { // Add null check
          if (!grouped[log.plant_name]) grouped[log.plant_name] = [];
          grouped[log.plant_name].push(log);
        }
      });
      setPlants(grouped);
    } catch (err) {
      console.error('Plants API error:', err);
      setPlants({}); // Set empty object on error
    }
  };

  // Get plant growth stage and recommendations
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

    // Determine growth stage
    let stage, stageColor, recommendations;
    
    if (currentHeight < 10) {
      stage = 'Seedling';
      stageColor = 'text-green-400';
      recommendations = {
        feeding: 'Light nutrient solution (EC 0.6-0.8). Feed every 2-3 days.',
        pruning: 'No pruning needed. Focus on healthy root development.',
        monitoring: 'Watch for damping off. Ensure proper humidity (60-70%).',
        nutrients: 'High nitrogen, moderate phosphorus and potassium.',
        schedule: 'every-2-days'
      };
    } else if (currentHeight < 30) {
      stage = 'Vegetative';
      stageColor = 'text-blue-400';
      recommendations = {
        feeding: 'Moderate nutrient solution (EC 1.0-1.4). Feed daily.',
        pruning: 'Start light pruning of lower leaves. Remove yellowing leaves.',
        monitoring: 'Check for pests. Monitor leaf color and growth rate.',
        nutrients: 'High nitrogen for leaf growth, balanced P-K ratio.',
        schedule: 'daily'
      };
    } else if (currentHeight < 60) {
      stage = 'Pre-Flowering';
      stageColor = 'text-yellow-400';
      recommendations = {
        feeding: 'Balanced nutrient solution (EC 1.4-1.8). Reduce nitrogen slightly.',
        pruning: 'Top pruning to encourage bushiness. Remove lower branches.',
        monitoring: 'Watch for flowering signs. Adjust light cycle if needed.',
        nutrients: 'Reduce nitrogen, increase phosphorus for flowering.',
        schedule: 'daily'
      };
    } else {
      stage = 'Mature/Flowering';
      stageColor = 'text-purple-400';
      recommendations = {
        feeding: 'Strong nutrient solution (EC 1.6-2.0). Focus on P-K nutrients.',
        pruning: 'Minimal pruning. Remove only dead/yellowing leaves.',
        monitoring: 'Check for nutrient deficiencies. Monitor pH closely.',
        nutrients: 'Low nitrogen, high phosphorus and potassium.',
        schedule: 'daily'
      };
    }

    return {
      stage,
      stageColor,
      currentHeight,
      daysTracked: Math.max(daysTracked, 0),
      growthRate: growthRate.toFixed(2),
      ...recommendations
    };
  };

  const getUpcomingTasks = () => {
    const today = new Date();
    const tasks = [];

    // Add scheduled feedings - ensure schedules is an array
    if (Array.isArray(schedules)) {
      schedules.forEach(schedule => {
        if (!schedule) return; // Skip null/undefined schedules
        
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
        // Add pruning reminders based on stage
        if (recs.stage === 'Vegetative' || recs.stage === 'Pre-Flowering') {
          tasks.push({
            type: 'pruning',
            plant: plantName,
            task: `Check pruning for ${plantName}`,
            priority: 'low',
            details: recs.pruning
          });
        }

        // Add monitoring tasks
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
      <div className="bg-brandGray-light rounded-lg p-6 mb-6">
        <h3 className="text-xl font-semibold text-hydro mb-4">Add Feeding Schedule</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <select
              value={form.plant_name}
              onChange={(e) => setForm({...form, plant_name: e.target.value})}
              className="bg-gray-800 text-hydro rounded-lg p-3 border border-gray-600"
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
              className="bg-gray-800 text-hydro rounded-lg p-3 border border-gray-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              step="0.1"
              placeholder="EC Level (e.g., 1.2)"
              value={form.ec_level}
              onChange={(e) => setForm({...form, ec_level: e.target.value})}
              className="bg-gray-800 text-hydro rounded-lg p-3 border border-gray-600"
              required
            />
            
            <select
              value={form.frequency}
              onChange={(e) => setForm({...form, frequency: e.target.value})}
              className="bg-gray-800 text-hydro rounded-lg p-3 border border-gray-600"
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
            className="w-full bg-gray-800 text-hydro rounded-lg p-3 border border-gray-600"
            rows="3"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-hydro text-brandGray px-6 py-2 rounded-lg font-medium hover:bg-hydro/90"
            >
              Add Schedule
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="bg-gray-700 text-hydro-light px-6 py-2 rounded-lg font-medium hover:bg-gray-600"
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hydro mx-auto"></div>
          <p className="text-hydro-light mt-4">Loading feeding schedule...</p>
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
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
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
          <h2 className="text-3xl font-bold text-light-primary dark:text-dark-primary">🌿 Feeding & Care Schedule</h2>
          <p className="text-light-text-muted dark:text-dark-text-muted">Intelligent recommendations based on plant growth stages</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-light-primary dark:bg-dark-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-light-primary-hover dark:hover:bg-dark-primary-hover transition-colors duration-200"
        >
          {showAddForm ? 'Cancel' : 'Add Schedule'}
        </button>
      </div>

      {/* Add Schedule Form */}
      {showAddForm && <AddScheduleForm />}

      {/* Upcoming Tasks */}
      <div className="bg-light-bg-secondary dark:bg-dark-bg-secondary rounded-lg p-6 border border-light-border dark:border-dark-border transition-colors duration-300">
        <h3 className="text-xl font-semibold text-light-text dark:text-dark-text mb-4 flex items-center gap-2">
          <Clock size={20} />
          Today's Tasks
        </h3>
        <div className="space-y-3">
          {getUpcomingTasks().slice(0, 6).map((task, index) => (
            <div key={index} className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-300 ${
              task.priority === 'high' ? 'bg-red-900/10 dark:bg-red-900/20 border border-red-500/30' :
              task.priority === 'medium' ? 'bg-yellow-900/10 dark:bg-yellow-900/20 border border-yellow-500/30' :
              'bg-light-bg-accent dark:bg-dark-bg-accent'
            }`}>
              <div className="flex-shrink-0">
                {task.type === 'feeding' && <Droplets size={18} className="text-blue-500" />}
                {task.type === 'pruning' && <Scissors size={18} className="text-green-500" />}
                {task.type === 'monitoring' && <Eye size={18} className="text-purple-500" />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-light-text dark:text-dark-text">{task.task}</div>
                <div className="text-sm text-light-text-muted dark:text-dark-text-muted">{task.details}</div>
              </div>
              {task.overdue && (
                <AlertTriangle size={16} className="text-red-500" />
              )}
            </div>
          ))}
          
          {getUpcomingTasks().length === 0 && (
            <div className="text-center text-light-text-muted dark:text-dark-text-muted py-8">
              <CheckCircle size={48} className="mx-auto mb-2 text-green-500" />
              <p>All caught up! No urgent tasks today.</p>
            </div>
          )}
        </div>
      </div>

      {/* Plant Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.keys(plants).map(plantName => {
          const recs = getPlantRecommendations(plantName);
          if (!recs) return null;

          return (
            <div key={plantName} className="bg-brandGray-light rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-hydro">{plantName}</h3>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${recs.stageColor}`}>{recs.stage}</span>
                  <span className="text-sm text-hydro-light">({recs.currentHeight} cm)</span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-sm text-hydro-light">Days Tracked</div>
                    <div className="font-semibold text-hydro">{recs.daysTracked}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-sm text-hydro-light">Growth Rate</div>
                    <div className="font-semibold text-hydro">{recs.growthRate} cm/day</div>
                  </div>
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-sm text-hydro-light">Height</div>
                    <div className="font-semibold text-hydro">{recs.currentHeight} cm</div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Droplets size={16} className="text-blue-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-hydro text-sm">Feeding</div>
                      <div className="text-sm text-hydro-light">{recs.feeding}</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Scissors size={16} className="text-green-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-hydro text-sm">Pruning</div>
                      <div className="text-sm text-hydro-light">{recs.pruning}</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Eye size={16} className="text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-hydro text-sm">Monitor</div>
                      <div className="text-sm text-hydro-light">{recs.monitoring}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current Schedules */}
      <div className="bg-brandGray-light rounded-lg p-6">
        <h3 className="text-xl font-semibold text-hydro mb-4">Active Feeding Schedules</h3>
        {!Array.isArray(schedules) || schedules.length === 0 ? (
          <div className="text-center text-hydro-light py-8">
            <Calendar size={48} className="mx-auto mb-2 opacity-50" />
            <p>No feeding schedules yet. Add one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map(schedule => (
              <div key={schedule.id} className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-hydro">{schedule.plant_name}</div>
                  <div className="text-sm text-hydro-light">
                    {schedule.nutrient_type} • EC {schedule.ec_level} • {schedule.frequency}
                  </div>
                  {schedule.notes && (
                    <div className="text-sm text-hydro-light italic mt-1">{schedule.notes}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-hydro-light">Last Fed</div>
                  <div className="text-sm text-hydro">
                    {schedule.last_fed ? new Date(schedule.last_fed).toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedingSchedule;
