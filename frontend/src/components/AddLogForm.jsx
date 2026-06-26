import React, { useState, useEffect } from 'react';
import { Plus, Minus, Save, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/api';

const AddLogForm = ({ refreshLogs }) => {
  const { colors } = useTheme();
  const [form, setForm] = useState({
    plant_name: '',
    date: new Date().toISOString().split('T')[0], // Set to today's date
    height: '0', // Set default height to 0
    nutrients: '',
    notes: '',
    image: null,
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [existingPlants, setExistingPlants] = useState([]);
  const [isNewPlant, setIsNewPlant] = useState(false);
  const [lastUsedPlant, setLastUsedPlant] = useState('');

  // Form validation
  const validateForm = () => {
    const newErrors = {};

    if (!form.plant_name.trim()) {
      newErrors.plant_name = 'Plant name is required';
    } else if (form.plant_name.length > 100) {
      newErrors.plant_name = 'Plant name must be less than 100 characters';
    }

    if (!form.date) {
      newErrors.date = 'Date is required';
    } else if (isNaN(Date.parse(form.date))) {
      newErrors.date = 'Please enter a valid date';
    }

    const heightNum = parseFloat(form.height);
    if (form.height === '' || isNaN(heightNum)) {
      newErrors.height = 'Height is required';
    } else if (heightNum < 0 || heightNum > 1000) {
      newErrors.height = 'Height must be between 0 and 1000 cm';
    }

    if (!form.nutrients.trim()) {
      newErrors.nutrients = 'Nutrients information is required';
    } else if (form.nutrients.length > 500) {
      newErrors.nutrients = 'Nutrients description must be less than 500 characters';
    }

    if (form.notes.length > 1000) {
      newErrors.notes = 'Notes must be less than 1000 characters';
    }

    if (form.image && form.image.size > 5 * 1024 * 1024) {
      newErrors.image = 'Image must be smaller than 5MB';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('logFormDraft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setForm(prev => ({ ...prev, ...draft, image: null })); // Don't restore image for security
        setIsDirty(true);
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
    
    // Load last used plant from localStorage
    const savedLastPlant = localStorage.getItem('lastUsedPlant');
    if (savedLastPlant) {
      setLastUsedPlant(savedLastPlant);
      // Auto-select the last used plant if no draft exists
      if (!savedDraft) {
        setForm(prev => ({ ...prev, plant_name: savedLastPlant }));
      }
    }
  }, []);

  // Fetch existing plants on mount
  useEffect(() => {
    const fetchPlants = async () => {
      try {
        const res = await api.get('/logs');
        const logs = res.data;
        
        // Extract unique plant names
        const plantNames = [...new Set(logs.map(log => log.plant_name))].sort();
        setExistingPlants(plantNames);
        
        // If no last used plant is set and there are plants, use the first one
        if (!lastUsedPlant && plantNames.length > 0) {
          setLastUsedPlant(plantNames[0]);
        }
      } catch (error) {
        console.error('Error fetching plants:', error);
      }
    };
    
    fetchPlants();
  }, [lastUsedPlant]);

  // Save draft to localStorage when form changes
  useEffect(() => {
    if (isDirty) {
      const draftData = {
        plant_name: form.plant_name,
        date: form.date,
        height: form.height,
        nutrients: form.nutrients,
        notes: form.notes,
      };
      localStorage.setItem('logFormDraft', JSON.stringify(draftData));
    }
  }, [form, isDirty]);

  // Clear draft when form is successfully submitted
  const clearDraft = () => {
    localStorage.removeItem('logFormDraft');
    setIsDirty(false);
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      setForm({ ...form, image: files[0] });
    } else {
      setForm({ ...form, [name]: value });
    }
    setIsDirty(true);
  };

  // Handle plant selection from dropdown
  const handlePlantSelect = (plantName) => {
    setForm({ ...form, plant_name: plantName });
    setIsNewPlant(false);
    setIsDirty(true);
  };

  // Handle creating new plant
  const handleNewPlant = () => {
    setForm({ ...form, plant_name: '' });
    setIsNewPlant(true);
    setIsDirty(true);
  };

  // Quick add for last used plant
  const handleQuickAdd = () => {
    if (lastUsedPlant) {
      setForm({ ...form, plant_name: lastUsedPlant });
      setIsNewPlant(false);
      setIsDirty(true);
    }
  };

  const handleHeightChange = (delta) => {
    const currentHeight = parseFloat(form.height) || 0;
    const newHeight = Math.max(0, currentHeight + delta);
    setForm({ ...form, height: newHeight.toString() });
    setIsDirty(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (form.image) {
        // If there's an image, use FormData
        const formData = new FormData();
        // Always include required fields, even if empty
        formData.append('plant_name', form.plant_name || '');
        formData.append('date', form.date || '');
        formData.append('height', form.height || '0');
        formData.append('nutrients', form.nutrients || '');
        formData.append('notes', form.notes || '');
        if (form.image) {
          formData.append('image', form.image);
        }

        await api.post('/logs', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        // If no image, send JSON
        const jsonData = {
          plant_name: form.plant_name,
          date: form.date,
          height: form.height,
          nutrients: form.nutrients,
          notes: form.notes,
        };

        await api.post('/logs', jsonData, {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Save the last used plant
      localStorage.setItem('lastUsedPlant', form.plant_name);
      setLastUsedPlant(form.plant_name);
      
      setForm({
        plant_name: form.plant_name, // Keep the same plant for next entry
        date: new Date().toISOString().split('T')[0], // Reset to today's date
        height: '0', // Reset height to 0
        nutrients: '',
        notes: '',
        image: null,
      });
      setErrors({});
      clearDraft();
      refreshLogs();
    } catch (error) {
      console.error('Error submitting log:', error.response?.data || error.message);

      // Handle validation errors from backend
      if (error.response?.status === 400 && error.response?.data?.details) {
        const backendErrors = {};
        error.response.data.details.forEach(detail => {
          if (detail.includes('Plant name')) backendErrors.plant_name = detail;
          else if (detail.includes('Date')) backendErrors.date = detail;
          else if (detail.includes('Height')) backendErrors.height = detail;
          else if (detail.includes('Nutrients')) backendErrors.nutrients = detail;
          else if (detail.includes('Notes')) backendErrors.notes = detail;
        });
        setErrors(backendErrors);
      } else {
        // More detailed error message
        const errorMsg = error.response?.data?.error || error.message || 'Unknown error occurred';
        const errorDetails = error.response?.data?.details ? ` Details: ${error.response.data.details}` : '';
        alert(`Failed to add log: ${errorMsg}${errorDetails}\n\nCheck console for more details.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearDraft = () => {
    setForm({
      plant_name: '',
      date: new Date().toISOString().split('T')[0], // Reset to today's date
      height: '0', // Reset height to 0
      nutrients: '',
      notes: '',
      image: null,
    });
    clearDraft();
  };

  // Show draft warning when user leaves page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <div className={`${colors.bgSecondary} rounded-xl p-6 shadow-lg ${colors.border} border transition-colors duration-300`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${colors.primary}`}>📝 Add Growth Log</h2>
        {isDirty && (
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-500" />
            <span className={`text-sm ${colors.textMuted}`}>Draft saved</span>
          </div>
        )}
      </div>

      {isDirty && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-500" />
            <span className={`text-sm ${colors.text}`}>
              You have unsaved changes. They're automatically saved as a draft.
            </span>
            <button
              onClick={handleClearDraft}
              className="ml-auto text-sm text-yellow-600 hover:text-yellow-700 underline"
            >
              Clear Draft
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>
            Plant Name
          </label>
          
          {/* Quick Actions */}
          <div className="flex gap-2 mb-3">
            {lastUsedPlant && (
              <button
                type="button"
                onClick={handleQuickAdd}
                className={`px-3 py-2 text-sm ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} hover:bg-opacity-80 transition-colors duration-200`}
              >
                Quick Add to "{lastUsedPlant}"
              </button>
            )}
            <button
              type="button"
              onClick={handleNewPlant}
              className={`px-3 py-2 text-sm ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} hover:bg-opacity-80 transition-colors duration-200`}
            >
              + New Plant
            </button>
          </div>

          {/* Plant Selection */}
          {!isNewPlant && existingPlants.length > 0 && (
            <div className="mb-3">
              <select
                value={form.plant_name}
                onChange={(e) => handlePlantSelect(e.target.value)}
                className={`w-full px-4 py-3 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
              >
                <option value="">Select existing plant...</option>
                {existingPlants.map((plantName) => (
                  <option key={plantName} value={plantName}>
                    {plantName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Manual Input */}
          {(isNewPlant || existingPlants.length === 0 || !form.plant_name) && (
            <input
              name="plant_name"
              value={form.plant_name}
              onChange={handleChange}
              placeholder="e.g., Tomato Plant #1, Basil, Lettuce"
              className={`w-full px-4 py-3 ${colors.bgAccent} border ${errors.plant_name ? 'border-red-500' : colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 ${errors.plant_name ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'} transition-colors duration-200`}
              required
            />
          )}
          
          {errors.plant_name && (
            <p className="text-red-500 text-sm mt-1">{errors.plant_name}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>
            Date (optional)
          </label>
          <input
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${errors.date ? 'border-red-500' : colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 ${errors.date ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'} transition-colors duration-200`}
          />
          {errors.date && (
            <p className="text-red-500 text-sm mt-1">{errors.date}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>
            Height (cm)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleHeightChange(-0.5)}
              className={`${colors.bgAccent} hover:${colors.bgSecondary} border ${colors.border} rounded-lg p-2 transition-colors duration-200`}
            >
              <Minus size={16} className={colors.text} />
            </button>
            <input
              name="height"
              type="number"
              step="0.1"
              min="0"
              max="1000"
              value={form.height}
              onChange={handleChange}
              placeholder="0.0"
              className={`flex-1 px-4 py-3 ${colors.bgAccent} border ${errors.height ? 'border-red-500' : colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 ${errors.height ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'} transition-colors duration-200 text-center font-mono`}
              required
            />
            <button
              type="button"
              onClick={() => handleHeightChange(0.5)}
              className={`${colors.bgAccent} hover:${colors.bgSecondary} border ${colors.border} rounded-lg p-2 transition-colors duration-200`}
            >
              <Plus size={16} className={colors.text} />
            </button>
          </div>
          {errors.height ? (
            <p className="text-red-500 text-sm mt-1">{errors.height}</p>
          ) : (
            <p className={`text-xs ${colors.textMuted} mt-1`}>
              Use +/- buttons for precise adjustments (±0.5 cm)
            </p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>
            Nutrients Used
          </label>
          <input
            name="nutrients"
            value={form.nutrients}
            onChange={handleChange}
            placeholder="e.g., General Hydroponics Flora Series, 5ml/L"
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${errors.nutrients ? 'border-red-500' : colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 ${errors.nutrients ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'} transition-colors duration-200`}
            required
          />
          {errors.nutrients && (
            <p className="text-red-500 text-sm mt-1">{errors.nutrients}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>
            Notes (optional)
          </label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Additional observations, changes, or notes..."
            rows="4"
            maxLength="1000"
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${errors.notes ? 'border-red-500' : colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 ${errors.notes ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'} transition-colors duration-200 resize-none`}
          />
          <div className="flex justify-between items-center mt-1">
            {errors.notes ? (
              <p className="text-red-500 text-sm">{errors.notes}</p>
            ) : (
              <span></span>
            )}
            <span className={`text-xs ${colors.textMuted}`}>
              {form.notes.length}/1000
            </span>
          </div>
        </div>

        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>
            Image (optional)
          </label>
          <input
            type="file"
            name="image"
            accept="image/*"
            onChange={handleChange}
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${errors.image ? 'border-red-500' : colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 ${errors.image ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-blue-500 focus:border-blue-500'} transition-colors duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`}
          />
          {errors.image ? (
            <p className="text-red-500 text-sm mt-1">{errors.image}</p>
          ) : form.image ? (
            <p className={`text-xs ${colors.textMuted} mt-1`}>
              Selected: {form.image.name} ({(form.image.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          ) : (
            <p className={`text-xs ${colors.textMuted} mt-1`}>
              Maximum file size: 5MB. Supported formats: JPEG, PNG, GIF
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex-1 ${colors.primaryBg} text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Save size={16} />
            {isSubmitting ? 'Adding Log...' : 'Add Growth Log'}
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={handleClearDraft}
              className={`px-6 py-3 ${colors.bgAccent} ${colors.text} rounded-lg font-medium hover:${colors.bgSecondary} transition-colors duration-200 border ${colors.border}`}
            >
              Clear Draft
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default AddLogForm;
