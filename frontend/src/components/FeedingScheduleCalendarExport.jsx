import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { FEEDING_SCHEDULE } from '../data/feedingSchedule';
import { downloadBlob } from '../utils/download';
import { parseLocalDate, toLocalISO } from '../utils/dates';

const defaultStartDate = () => {
  const today = new Date();
  const next = new Date(today);
  next.setDate(today.getDate() + ((8 - today.getDay()) % 7)); // next Monday
  return toLocalISO(next);
};

const FeedingScheduleCalendarExport = () => {
  const { colors } = useTheme();
  const toast = useToast();
  const [startDate, setStartDate] = useState(defaultStartDate());

  const generateCalendarCSV = (start) => {
    const headers = ['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time', 'All Day Event', 'Description', 'Location', 'Private'];
    const rows = [headers.join(',')];

    FEEDING_SCHEDULE.forEach((week) => {
      const day = new Date(start);
      day.setDate(day.getDate() + (week.week - 1) * 7);
      // en-US is deliberate here: this is the MM/DD/YYYY the calendar CSV
      // import format expects, not a display string.
      const dateStr = day.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

      const nutrients = week.mkp_ml
        ? `Part A: ${week.part_a_ml}ml/L, Part B: ${week.part_b_ml}ml/L, MKP: ${week.mkp_ml}ml/L`
        : `Part A: ${week.part_a_ml}ml/L, Part B: ${week.part_b_ml}ml/L`;

      const description = [
        `Week ${week.week} Feeding Schedule`,
        `Stage: ${week.stage}`,
        `Target EC: ${week.ec}`,
        `Nutrients per Liter: ${nutrients}`,
        `Mixing: Part A first, then Part B${week.mkp_ml ? ', then MKP' : ''}`,
        `Notes: ${week.notes}`,
        'Remember: check pH (5.5-6.5), monitor plant response.',
      ].join('\n');

      rows.push([
        `"Week ${week.week} - ${week.stage} Feeding"`,
        dateStr, '09:00 AM', dateStr, '10:00 AM', 'FALSE',
        `"${description}"`, '"Hydroponic Garden"', 'FALSE',
      ].join(','));
    });

    return rows.join('\n');
  };

  const download = () => {
    // The picker gives 'YYYY-MM-DD'; parse it as a local day so week 1 is the
    // Monday the user chose, not the day before it in western timezones.
    const csv = generateCalendarCSV(parseLocalDate(startDate) || new Date());
    downloadBlob(`hydroponic_feeding_schedule_${startDate}.csv`, csv);
    toast.success('Calendar CSV downloaded');
  };

  return (
    <div>
      <p className={`${colors.textMuted} mb-6`}>
        Download the complete 16-week feeding schedule as a calendar file (CSV), with detailed
        instructions for each week.
      </p>

      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>Start Date (Week 1)</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`}
          />
        </div>

        <button onClick={download} className={`w-full ${colors.primaryBg} text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}>
          <Download size={20} /> Download Feeding Schedule CSV
        </button>

        <div className={`${colors.bgAccent} rounded-lg p-4 text-sm ${colors.textMuted} space-y-2`}>
          <div className={colors.text}><strong>Import:</strong></div>
          <div><strong>Google Calendar:</strong> Settings → Import &amp; export → select the CSV → choose a calendar → Import.</div>
          <div><strong>Outlook:</strong> File → Open &amp; Export → Import/Export → Comma Separated Values → pick the file.</div>
          <div><strong>Apple Calendar:</strong> File → Import → select the CSV → choose a calendar.</div>
        </div>
      </div>
    </div>
  );
};

export default FeedingScheduleCalendarExport;
