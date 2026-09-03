// MR-51: a scrubbable timeline of a plant's logged photos.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import PhotoTimeline from '../../components/PhotoTimeline';
import { formatDate } from '../../utils/format';

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

const threePhotoLogs = [
  { id: 1, plant_name: 'Tomato', date: '2026-01-01', height: 5, image_url: '/uploads/a.jpg' },
  { id: 2, plant_name: 'Tomato', date: '2026-01-11', height: 12, image_url: '/uploads/b.jpg' },
  { id: 3, plant_name: 'Tomato', date: '2026-01-21', height: 20, image_url: '/uploads/c.jpg' },
];

const onePhotoLog = [
  { id: 1, plant_name: 'Tomato', date: '2026-01-01', height: 5, image_url: '/uploads/a.jpg' },
];

function renderTimeline(logs) {
  return render(
    <ThemeProvider>
      <PhotoTimeline logs={logs} lengthUnit="cm" />
    </ThemeProvider>
  );
}

describe('PhotoTimeline (MR-51)', () => {
  it('with three photo logs, the range max is 2 and moving it to 1 shows the middle log date', () => {
    const { container } = renderTimeline(threePhotoLogs);

    const range = screen.getByLabelText('Photo timeline');
    expect(range).toHaveAttribute('max', '2');

    fireEvent.change(range, { target: { value: '1' } });

    const caption = screen.getByTestId('photo-caption');
    expect(caption.textContent).toContain(formatDate('2026-01-11'));
    void container;
  });

  it('returns null with only one photo', () => {
    const { container } = renderTimeline(onePhotoLog);
    expect(container.firstChild).toBeNull();
  });
});
