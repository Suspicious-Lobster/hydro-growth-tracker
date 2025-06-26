import { useState } from 'react';
import api from '../api/api';

const ImageUpload = ({ refreshLogs }) => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notes, setNotes] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!image) return;

    const formData = new FormData();
    formData.append('image', image);
    formData.append('notes', notes);

    try {
      await api.post('/logs/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      refreshLogs(); // refresh logs to show new image
      setImage(null);
      setPreview(null);
      setNotes('');
    } catch (error) {
      console.error('Image upload error:', error);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
      <form onSubmit={handleUpload}>
        <input
          type="file"
          onChange={handleImageChange}
          className="block w-full text-sm text-gray-400"
          required
        />
        {preview && (
          <img src={preview} alt="Preview" className="mt-4 rounded-lg shadow-lg" />
        )}
        <textarea
          className="bg-gray-700 p-2 rounded text-white w-full mt-4"
          placeholder="Notes about this week's growth..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          required
        />
        <button
          className="mt-4 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-xl"
        >
          Upload Image 📷
        </button>
      </form>
    </div>
  );
};

export default ImageUpload;
