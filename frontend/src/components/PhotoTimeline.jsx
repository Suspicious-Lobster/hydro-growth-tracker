import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveImageUrl } from '../api/api';
import { formatDate, formatLength } from '../utils/format';
import { sortLogsByDate } from '../utils/stats';

// A scrubbable timeline of a plant's logged photos (MR-51). Takes everything
// via props so it never needs app data or toast context — PlantDetail hands
// it the plant's logs and the active length unit.
const PhotoTimeline = ({ logs, lengthUnit }) => {
  const photos = sortLogsByDate(logs).filter((l) => l.image_url);
  const [index, setIndex] = useState(photos.length - 1);

  if (photos.length < 2) return null;

  // Clamp in case the log list shrank since the last render (e.g. a photo
  // was deleted) rather than pointing past the end of the array.
  const clamped = Math.min(index, photos.length - 1);
  const photo = photos[clamped];

  const go = (delta) => setIndex(Math.min(photos.length - 1, Math.max(0, clamped + delta)));

  return (
    <div>
      <img
        src={resolveImageUrl(photo.image_url)}
        alt={`${photo.plant_name} on ${formatDate(photo.date)}`}
        className="max-h-96 rounded-lg mx-auto"
      />
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => go(-1)}
          disabled={clamped === 0}
          className="p-2 rounded-lg border disabled:opacity-40"
        >
          <ChevronLeft size={18} />
        </button>
        <input
          type="range"
          aria-label="Photo timeline"
          min={0}
          max={photos.length - 1}
          value={clamped}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="flex-1"
        />
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => go(1)}
          disabled={clamped === photos.length - 1}
          className="p-2 rounded-lg border disabled:opacity-40"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <p data-testid="photo-caption" className="text-center text-sm mt-2">
        {formatDate(photo.date)} · {formatLength(photo.height, lengthUnit)}
      </p>
      <p className="text-center text-xs">{clamped + 1} of {photos.length}</p>
    </div>
  );
};

export default PhotoTimeline;
