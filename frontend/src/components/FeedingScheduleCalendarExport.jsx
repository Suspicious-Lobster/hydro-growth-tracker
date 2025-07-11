import { Calendar, Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const FeedingScheduleCalendarExport = () => {
  const { colors } = useTheme();

  // Professional 16-week feeding schedule
  const feedingSchedule = [
    { week: 1, part_a_ml: 1, part_b_ml: 1, mkp_ml: null, ec: 0.2, stage: "Established Seedlings", notes: "These values are good for advanced seedling stage and also for early clones" },
    { week: 2, part_a_ml: 2, part_b_ml: 2, mkp_ml: null, ec: 0.4, stage: "Established Seedlings", notes: "These values are good for advanced seedling stage and also for early clones" },
    { week: 3, part_a_ml: 3, part_b_ml: 3, mkp_ml: null, ec: 0.6, stage: "Established Seedlings", notes: "These values are good for advanced seedling stage and also for early clones" },
    { week: 4, part_a_ml: 4, part_b_ml: 4, mkp_ml: null, ec: 0.7, stage: "Established Seedlings", notes: "These values are good for advanced seedling stage and also for early clones" },
    { week: 5, part_a_ml: 5, part_b_ml: 5, mkp_ml: null, ec: 0.8, stage: "Established Seedlings", notes: "These values are good for advanced seedling stage and also for early clones" },
    { week: 6, part_a_ml: 6, part_b_ml: 6, mkp_ml: null, ec: 1.0, stage: "Full Growing and Early Flowering", notes: "Good values for full growing and early flowering" },
    { week: 7, part_a_ml: 7, part_b_ml: 7, mkp_ml: null, ec: 1.1, stage: "Full Growing and Early Flowering", notes: "Good values for full growing and early flowering" },
    { week: 8, part_a_ml: 6, part_b_ml: 8, mkp_ml: 2, ec: 1.2, stage: "Full Growing and Early Flowering", notes: "Good values for full growing and early flowering" },
    { week: 9, part_a_ml: 7, part_b_ml: 9, mkp_ml: 2, ec: 1.3, stage: "Mid Flowering", notes: "These values are for mid flowering stages" },
    { week: 10, part_a_ml: 7, part_b_ml: 10, mkp_ml: 3, ec: 1.4, stage: "Mid Flowering", notes: "These values are for mid flowering stages" },
    { week: 11, part_a_ml: 8, part_b_ml: 11, mkp_ml: 3, ec: 1.5, stage: "Mid Flowering", notes: "These values are for mid flowering stages" },
    { week: 12, part_a_ml: 8, part_b_ml: 12, mkp_ml: 4, ec: 1.6, stage: "Mid Flowering", notes: "These values are for mid flowering stages" },
    { week: 13, part_a_ml: 9, part_b_ml: 13, mkp_ml: 4, ec: 1.7, stage: "Full Flowering", notes: "Full flowering will require even greater nutrition but always monitor carefully" },
    { week: 14, part_a_ml: 9, part_b_ml: 14, mkp_ml: 5, ec: 1.8, stage: "Full Flowering", notes: "Full flowering will require even greater nutrition but always monitor carefully" },
    { week: 15, part_a_ml: 10, part_b_ml: 15, mkp_ml: 5, ec: 1.9, stage: "Full Flowering", notes: "Full flowering will require even greater nutrition but always monitor carefully" },
    { week: 16, part_a_ml: 11, part_b_ml: 16, mkp_ml: 5, ec: 2.0, stage: "Full Flowering", notes: "Full flowering will require even greater nutrition but always monitor carefully" }
  ];

  const generateCalendarCSV = (startDate) => {
    const csvHeaders = [
      'Subject',
      'Start Date',
      'Start Time',
      'End Date', 
      'End Time',
      'All Day Event',
      'Description',
      'Location',
      'Private'
    ];

    const csvRows = [];
    csvRows.push(csvHeaders.join(','));

    feedingSchedule.forEach((week) => {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (week.week - 1) * 7);
      
      const startDateStr = weekStart.toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      });

      const endDateStr = startDateStr; // Same day event

      const nutrients = week.mkp_ml 
        ? `Part A: ${week.part_a_ml}ml/L, Part B: ${week.part_b_ml}ml/L, MKP: ${week.mkp_ml}ml/L`
        : `Part A: ${week.part_a_ml}ml/L, Part B: ${week.part_b_ml}ml/L`;

      const description = `Week ${week.week} Feeding Schedule\\n` +
        `Stage: ${week.stage}\\n` +
        `Target EC: ${week.ec}\\n` +
        `Nutrients per Liter: ${nutrients}\\n\\n` +
        `Mixing Order:\\n` +
        `1. Add Part A first\\n` +
        `2. Add Part B second\\n` +
        `${week.mkp_ml ? '3. Add MKP last\\n' : ''}\\n` +
        `Notes: ${week.notes}\\n\\n` +
        `Remember to:\\n` +
        `- Check pH (target 5.5-6.5)\\n` +
        `- Monitor plant response\\n` +
        `- Adjust based on plant needs`;

      const row = [
        `"Week ${week.week} - ${week.stage} Feeding"`,
        startDateStr,
        '09:00 AM',
        endDateStr,
        '10:00 AM',
        'FALSE',
        `"${description}"`,
        '"Hydroponic Garden"',
        'FALSE'
      ];

      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  };

  const downloadCalendarCSV = () => {
    // Get start date from user input or default to next Monday
    const today = new Date();
    const nextMonday = new Date(today);
    const daysUntilMonday = (8 - today.getDay()) % 7;
    nextMonday.setDate(today.getDate() + daysUntilMonday);

    const startDateInput = document.getElementById('start-date-input');
    const startDate = startDateInput ? new Date(startDateInput.value) : nextMonday;

    const csvContent = generateCalendarCSV(startDate);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `hydroponic_feeding_schedule_${startDate.toISOString().split('T')[0]}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const getDefaultStartDate = () => {
    const today = new Date();
    const nextMonday = new Date(today);
    const daysUntilMonday = (8 - today.getDay()) % 7;
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  };

  return (
    <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-6 border ${colors.border}`}>
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="text-blue-400" size={24} />
        <h3 className={`text-xl font-bold ${colors.text}`}>Export to Calendar</h3>
      </div>
      
      <p className={`${colors.textMuted} mb-6`}>
        Download your complete 16-week feeding schedule as a calendar file. This will create calendar events 
        for each week with detailed feeding instructions, mixing ratios, and professional notes.
      </p>

      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>
            Start Date (Week 1)
          </label>
          <input
            type="date"
            id="start-date-input"
            defaultValue={getDefaultStartDate()}
            className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`}
          />
          <p className={`text-xs ${colors.textMuted} mt-1`}>
            Choose when you want to start your 16-week feeding program
          </p>
        </div>

        <button
          onClick={downloadCalendarCSV}
          className={`w-full ${colors.primaryBg} text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
        >
          <Download size={20} />
          Download Feeding Schedule CSV
        </button>

        <div className={`${colors.bgAccent} rounded-lg p-4 mt-4`}>
          <h4 className={`font-semibold ${colors.text} mb-2`}>Import Instructions:</h4>
          <div className={`text-sm ${colors.textMuted} space-y-2`}>
            <div><strong>Google Calendar:</strong></div>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Go to calendar.google.com</li>
              <li>Click the gear icon → Settings</li>
              <li>Select "Import & export" from the left menu</li>
              <li>Click "Select file from your computer"</li>
              <li>Choose your downloaded CSV file</li>
              <li>Select which calendar to import to</li>
              <li>Click "Import"</li>
            </ul>
            
            <div className="mt-3"><strong>Outlook:</strong></div>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Open Outlook and go to Calendar</li>
              <li>Click File → Open & Export → Import/Export</li>
              <li>Select "Import from another program or file"</li>
              <li>Choose "Comma Separated Values"</li>
              <li>Browse to your CSV file</li>
              <li>Choose your calendar and click "Finish"</li>
            </ul>

            <div className="mt-3"><strong>Apple Calendar:</strong></div>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Open Calendar app</li>
              <li>Go to File → Import</li>
              <li>Select your CSV file</li>
              <li>Choose which calendar to import to</li>
              <li>Click "Import"</li>
            </ul>
          </div>
        </div>

        <div className={`${colors.bgAccent} rounded-lg p-4`}>
          <h4 className={`font-semibold ${colors.text} mb-2`}>What's Included:</h4>
          <div className={`text-sm ${colors.textMuted} space-y-1`}>
            <li>16 weekly feeding events with exact nutrient ratios</li>
            <li>Growth stage information for each week</li>
            <li>Target EC values and mixing instructions</li>
            <li>Professional growing notes and tips</li>
            <li>pH monitoring reminders</li>
            <li>Safety guidelines and best practices</li>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedingScheduleCalendarExport;
