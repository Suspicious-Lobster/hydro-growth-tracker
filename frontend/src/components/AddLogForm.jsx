import React, { useState, useEffect } from 'react';
import { Plus, Minus, Save, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/api';

const AddLogForm = ({ refreshLogs }) => {
  const { colors } = useTheme();
  const [form, setForm] = useState({
    plant_name: '',
    date: '',
    height: '',
    nutrients: '',
    notes: '',
    image: null,
  });
  const [isDirty, setIsDirty] = useState(false);

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
  }, []);

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

  const handleHeightChange = (delta) => {
    const currentHeight = parseFloat(form.height) || 0;
    const newHeight = Math.max(0, currentHeight + delta);
    setForm({ ...form, height: newHeight.toString() });
    setIsDirty(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      await api.post('/logs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      setForm({
        plant_name: '',
        date: '',
        height: '',
        nutrients: '',
        notes: '',
        image: null,
      });
      clearDraft();
      refreshLogs();
    } catch (error) {
      alert('Failed to add log: ' + (error.response?.data?.error || error.message));
      console.error(error);
    }
  };

  const handleClearDraft = () => {
    setForm({
      plant_name: '',
      date: '',
      height: '',
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
          <input
            name="plant_name"
            value={form.plant_name}
            onChange={handleChange}
            placeholder="e.g., Tomato Plant #1, Basil, Lettuce"
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
            required
          />
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
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
          />
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
              value={form.height}
              onChange={handleChange}
              placeholder="0.0"
              className={`flex-1 px-4 py-3 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-center font-mono`}
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
          <p className={`text-xs ${colors.textMuted} mt-1`}>
            Use +/- buttons for precise adjustments (±0.5 cm)
          </p>
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
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
            required
          />
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
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-none`}
          />
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
            className={`w-full px-4 py-3 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`}
          />
          {form.image && (
            <p className={`text-xs ${colors.textMuted} mt-1`}>
              Selected: {form.image.name}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className={`flex-1 ${colors.primaryBg} text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
          >
            <Save size={16} />
            Add Growth Log
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
