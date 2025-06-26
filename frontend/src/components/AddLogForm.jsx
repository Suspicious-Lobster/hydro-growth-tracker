// src/components/AddLogForm.jsx
import React, { useState } from 'react';
import api from '../api/api';

/**
 * Add a new growth‑log entry and refresh the list + chart when finished.
 */
const AddLogForm = ({ refreshLogs }) => {
  const [form, setForm] = useState({
    plant_name: '',
    date: '',
    height: '',
    nutrients: '',
    notes: '',
    image: null,
  });

  /* -------------------------- local state updates ------------------------- */
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      setForm({ ...form, image: files[0] });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  /* --------------------------- form submission ---------------------------- */
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
      refreshLogs(); // update parent list / chart
    } catch (error) {
      alert('Failed to add log: ' + (error.response?.data?.error || error.message));
      console.error(error);
    }
  };

  /* ---------------------------------- UI --------------------------------- */
  return (
    <form
      onSubmit={handleSubmit} // <-- THIS was the missing link
      className="space-y-4 bg-brandGray-light p-4 rounded-xl shadow-xl"
    >
      <input
        name="plant_name"
        value={form.plant_name}
        onChange={handleChange}
        placeholder="Plant name"
        className="w-full px-4 py-2 rounded"
        required
      />
      <input
        name="height"
        type="number"
        value={form.height}
        onChange={handleChange}
        placeholder="Height (cm)"
        className="w-full px-4 py-2 rounded bg-gray-700 text-white"
        required
      />
      <input
        name="nutrients"
        value={form.nutrients}
        onChange={handleChange}
        placeholder="Nutrients used"
        className="w-full px-4 py-2 rounded bg-gray-700 text-white"
        required
      />
      <textarea
        name="notes"
        value={form.notes}
        onChange={handleChange}
        placeholder="Notes"
        className="w-full px-4 py-2 rounded bg-gray-700 text-white"
      />
      <input
        type="file"
        name="image"
        accept="image/*"
        onChange={handleChange}
        className="w-full px-4 py-2 rounded"
      />
      <button
        type="submit"
        className="bg-hydro hover:bg-hydro-dark px-4 py-2 rounded-xl text-brandGray font-semibold"
      >
        Add Growth Log 🌱
      </button>
    </form>
  );
};

export default AddLogForm;
