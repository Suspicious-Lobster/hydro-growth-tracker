import React, { useState } from 'react';
import { Calculator, Beaker, Droplets, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const NutrientCalculator = ({ onClose }) => {
  const { colors } = useTheme();
  const [reservoirSize, setReservoirSize] = useState(20);
  const [selectedWeek, setSelectedWeek] = useState(6);
  const [calculation, setCalculation] = useState(null);
  const [reservoirError, setReservoirError] = useState('');

  // Professional feeding schedule with week-by-week nutrient amounts
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

  const handleCalculate = () => {
    const size = parseFloat(reservoirSize);
    if (isNaN(size) || size <= 0 || size > 100000) {
      setReservoirError('Enter a reservoir size greater than 0 (liters).');
      setCalculation(null);
      return;
    }
    setReservoirError('');

    const weekData = feedingSchedule.find(week => week.week === selectedWeek) || feedingSchedule[5]; // Default to week 6

    // Calculate total amounts for reservoir
    const totalA = Math.round((weekData.part_a_ml * size) * 10) / 10;
    const totalB = Math.round((weekData.part_b_ml * size) * 10) / 10;
    const totalMKP = weekData.mkp_ml ? Math.round((weekData.mkp_ml * size) * 10) / 10 : 0;

    setCalculation({
      week: weekData.week,
      stage: weekData.stage,
      notes: weekData.notes,
      reservoirSize: size,
      targetEC: weekData.ec,
      perLiter: {
        a: weekData.part_a_ml,
        b: weekData.part_b_ml,
        mkp: weekData.mkp_ml || 0
      },
      totalAmounts: {
        a: totalA,
        b: totalB,
        mkp: totalMKP
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${colors.bgPrimary} rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`${colors.bgSecondary} p-6 rounded-t-xl border-b ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calculator className="text-blue-400" size={24} />
              <h2 className={`text-2xl font-bold ${colors.text}`}>Professional Feeding Calculator</h2>
            </div>
            <button
              onClick={onClose}
              className={`${colors.textMuted} hover:${colors.text} transition-colors`}
            >
              <X size={24} />
            </button>
          </div>
          <p className={`${colors.textMuted} mt-2`}>
            Professional feeding schedule - get exact nutrient amounts for each growth week
          </p>
        </div>

        <div className="p-6">
          {/* Input Section */}
          <div className={`${colors.bgSecondary} rounded-lg p-4 mb-6`}>
            <h3 className={`text-lg font-semibold ${colors.text} mb-4 flex items-center gap-2`}>
              <Beaker size={20} />
              Reservoir Setup
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                  Reservoir Size (Liters)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={reservoirSize}
                  onChange={(e) => setReservoirSize(e.target.value)}
                  className={`w-full px-3 py-2 ${colors.bgAccent} border ${reservoirError ? 'border-red-500' : colors.border} rounded-lg ${colors.text}`}
                  placeholder="20"
                />
                {reservoirError && (
                  <p className="text-red-500 text-sm mt-1">{reservoirError}</p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium ${colors.text} mb-2`}>
                  Growth Week
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                  className={`w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`}
                >
                  {feedingSchedule.map((week) => (
                    <option key={week.week} value={week.week}>
                      Week {week.week} - {week.stage} (EC {week.ec})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleCalculate}
              className={`w-full ${colors.primaryBg} text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity`}
            >
              Calculate Nutrients
            </button>
          </div>

          {/* Results Section */}
          {calculation && (
            <div className={`${colors.bgSecondary} rounded-lg p-4`}>
              <h3 className={`text-lg font-semibold ${colors.text} mb-4 flex items-center gap-2`}>
                <Droplets size={20} />
                Your Nutrient Recipe
              </h3>
              
              {/* Summary */}
              <div className={`${colors.bgAccent} rounded-lg p-3 mb-4`}>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <span className={`${colors.textMuted} text-sm`}>Reservoir</span>
                    <div className={`font-bold ${colors.text}`}>{calculation.reservoirSize}L</div>
                  </div>
                  <div>
                    <span className={`${colors.textMuted} text-sm`}>Week</span>
                    <div className={`font-bold ${colors.text}`}>{calculation.week}</div>
                  </div>
                  <div>
                    <span className={`${colors.textMuted} text-sm`}>Target EC</span>
                    <div className={`font-bold ${colors.text}`}>{calculation.targetEC}</div>
                  </div>
                  <div>
                    <span className={`${colors.textMuted} text-sm`}>Stage</span>
                    <div className={`font-bold ${colors.text} text-xs`}>{calculation.stage}</div>
                  </div>
                </div>
              </div>

              {/* Per Liter Amounts */}
              <div className="mb-4">
                <h4 className={`font-semibold ${colors.text} mb-3`}>📏 Per Liter Recipe:</h4>
                <div className="space-y-2">
                  <div className={`flex justify-between items-center ${colors.bgAccent} rounded p-3`}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className={`${colors.text} font-medium`}>Part A</span>
                    </div>
                    <span className={`font-bold ${colors.primary} text-lg`}>
                      {calculation.perLiter.a} ml/L
                    </span>
                  </div>
                  
                  <div className={`flex justify-between items-center ${colors.bgAccent} rounded p-3`}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className={`${colors.text} font-medium`}>Part B</span>
                    </div>
                    <span className={`font-bold ${colors.primary} text-lg`}>
                      {calculation.perLiter.b} ml/L
                    </span>
                  </div>
                  
                  {calculation.perLiter.mkp > 0 && (
                    <div className={`flex justify-between items-center ${colors.bgAccent} rounded p-3`}>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className={`${colors.text} font-medium`}>MKP</span>
                      </div>
                      <span className={`font-bold ${colors.primary} text-lg`}>
                        {calculation.perLiter.mkp} ml/L
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Amounts for Full Reservoir */}
              <div className="mb-4">
                <h4 className={`font-semibold ${colors.text} mb-3`}>🧪 Total for {calculation.reservoirSize}L Reservoir:</h4>
                <div className={`${colors.bgAccent} rounded-lg p-3`}>
                  <div className={`grid ${calculation.totalAmounts.mkp > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-4 text-center`}>
                    <div>
                      <div className={`text-2xl font-bold ${colors.primary}`}>{calculation.totalAmounts.a} ml</div>
                      <div className={`text-sm ${colors.textMuted}`}>Part A Total</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${colors.primary}`}>{calculation.totalAmounts.b} ml</div>
                      <div className={`text-sm ${colors.textMuted}`}>Part B Total</div>
                    </div>
                    {calculation.totalAmounts.mkp > 0 && (
                      <div>
                        <div className={`text-2xl font-bold ${colors.primary}`}>{calculation.totalAmounts.mkp} ml</div>
                        <div className={`text-sm ${colors.textMuted}`}>MKP Total</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mixing Instructions */}
              <div className="mb-4">
                <h4 className={`font-semibold ${colors.text} mb-2`}>📋 Mixing Order:</h4>
                <div className={`${colors.bgAccent} rounded-lg p-3 space-y-2`}>
                  <div className={`${colors.text} flex items-center gap-2`}>
                    <span className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">1</span>
                    Add {calculation.totalAmounts.a} ml of <strong>Part A</strong> first
                  </div>
                  <div className={`${colors.text} flex items-center gap-2`}>
                    <span className="bg-green-500 text-white px-2 py-1 rounded text-sm font-bold">2</span>
                    Add {calculation.totalAmounts.b} ml of <strong>Part B</strong> second
                  </div>
                  {calculation.totalAmounts.mkp > 0 && (
                    <div className={`${colors.text} flex items-center gap-2`}>
                      <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm font-bold">3</span>
                      Add {calculation.totalAmounts.mkp} ml of <strong>MKP</strong> last
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Notes */}
              <div className="mb-4">
                <h4 className={`font-semibold ${colors.text} mb-2`}>📚 Professional Notes:</h4>
                <div className={`${colors.bgAccent} rounded-lg p-3`}>
                  <div className={`${colors.textMuted} text-sm italic`}>
                    {calculation.notes}
                  </div>
                </div>
              </div>

              {/* Simple Tips */}
              <div>
                <h4 className={`font-semibold ${colors.text} mb-2`}>💡 Quick Tips:</h4>
                <div className={`${colors.bgAccent} rounded-lg p-3 text-sm space-y-1`}>
                  <div className={`${colors.textMuted}`}>• Always mix Part A first, then Part B{calculation.totalAmounts.mkp > 0 ? ', then MKP' : ''}</div>
                  <div className={`${colors.textMuted}`}>• Stir well between each addition</div>
                  <div className={`${colors.textMuted}`}>• Check pH after mixing (target: 5.5-6.5)</div>
                  <div className={`${colors.textMuted}`}>• Test EC to confirm: {calculation.targetEC} ±0.1</div>
                  <div className={`${colors.textMuted}`}>• Week {calculation.week} feeding schedule for {calculation.stage.toLowerCase()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NutrientCalculator;