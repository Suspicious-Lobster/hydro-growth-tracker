import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api/api'; // same axios instance you already use

/* -----------------------------------------------------------
   Slide‑over panel + floating button
----------------------------------------------------------- */

const Panel = ({ open, onClose, children }) => (
  <div
    className={`fixed top-0 right-0 h-full w-96 max-w-full bg-brandGray-light text-hydro-light shadow-2xl transform transition-transform duration-300 z-50 ${
      open ? 'translate-x-0' : 'translate-x-full'
    }`}
  >
    <div className="flex justify-between items-center p-4 border-b border-gray-700">
      <h3 className="text-lg font-semibold text-green-400">
        🧪 Weekly Feeding Schedule
      </h3>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
        <X size={20} />
      </button>
    </div>
    <div className="p-4 overflow-y-auto h-[calc(100%-64px)]">{children}</div>
  </div>
);

const FloatingButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-xl z-40"
    title="Show Feeding Schedule"
  >
    🧪
  </button>
);

/* -----------------------------------------------------------
   Main component
----------------------------------------------------------- */

const FeedingSchedule = () => {
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState([]);

  // fetch schedule once the panel opens
  useEffect(() => {
    if (open) {
      api
        .get('/feeding')
        .then((res) => setSchedule(res.data.schedule))
        .catch((err) => console.error('Feeding API error', err));
    }
  }, [open]);

  return (
    <>
      <FloatingButton onClick={() => setOpen(true)} />
      <Panel open={open} onClose={() => setOpen(false)}>
        {schedule.length === 0 ? (
          <p>No schedule data.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-green-400 border-b border-gray-600">
                <th className="py-1">Week</th>
                <th className="py-1">Part A</th>
                <th className="py-1">Part B</th>
                <th className="py-1">MKP</th>
                <th className="py-1">EC</th>
                <th className="py-1 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((w) => (
                <tr key={w.week} className="border-b border-gray-700">
                  <td className="py-1 text-center">{w.week}</td>
                  <td className="py-1 text-center">{w.partA} ml</td>
                  <td className="py-1 text-center">{w.partB} ml</td>
                  <td className="py-1 text-center">
                    {w.mkp ? `${w.mkp} ml` : '-'}
                  </td>
                  <td className="py-1 text-center">{w.ec.toFixed(1)}</td>
                  <td className="py-1">{w.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
};

export default FeedingSchedule;
