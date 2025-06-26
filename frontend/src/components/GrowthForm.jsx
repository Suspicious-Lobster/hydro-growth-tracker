import React, { useState } from 'react';
import api from '../api/api';

function GrowthForm({ refreshLogs }) {
  const [plant_name, setPlantName] = useState('');
  const [height, setHeight] = useState('');
  const [nutrients, setNutrients] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Upload image first
    let imageUrl = '';
    if (image) {
      const formData = new FormData();
      formData.append('image', image);

      const imgRes = await api.post('/logs/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      imageUrl = imgRes.data.imageUrl;
    }

    // Send log data with image URL
    await api.post('/logs', {
      plant_name,
      height,
      nutrients,
      notes,
      image_url: imageUrl,
    });

    refreshLogs();

    // Reset form
    setPlantName('');
    setHeight('');
    setNutrients('');
    setNotes('');
    setImage(null);
  };

  return (
    <form className="space-y-4 bg-brandGray-light p-4 rounded-xl shadow-xl" onSubmit={handleSubmit}>
      <input className="w-full p-2 rounded" placeholder="Plant Name" value={plant_name} onChange={(e) => setPlantName(e.target.value)} required />
      <input className="w-full p-2 rounded" placeholder="Height (cm)" type="number" value={height} onChange={(e) => setHeight(e.target.value)} required />
      <input className="w-full p-2 rounded" placeholder="Nutrients" value={nutrients} onChange={(e) => setNutrients(e.target.value)} required />
      <textarea className="w-full p-2 rounded" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <input type="file" onChange={(e) => setImage(e.target.files[0])} />

      <button type="submit" className="bg-hydro px-4 py-2 rounded text-brandGray">
        Log Growth 🌿
      </button>
    </form>
  );
}

export default GrowthForm;
