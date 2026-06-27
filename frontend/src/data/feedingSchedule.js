// Single source of truth for the professional 16-week feeding program.
// Previously this array was duplicated verbatim in NutrientCalculator.jsx and
// FeedingScheduleCalendarExport.jsx; both now import it from here.

export const FEEDING_SCHEDULE = [
  { week: 1, part_a_ml: 1, part_b_ml: 1, mkp_ml: null, ec: 0.2, stage: 'Established Seedlings', notes: 'These values are good for advanced seedling stage and also for early clones' },
  { week: 2, part_a_ml: 2, part_b_ml: 2, mkp_ml: null, ec: 0.4, stage: 'Established Seedlings', notes: 'These values are good for advanced seedling stage and also for early clones' },
  { week: 3, part_a_ml: 3, part_b_ml: 3, mkp_ml: null, ec: 0.6, stage: 'Established Seedlings', notes: 'These values are good for advanced seedling stage and also for early clones' },
  { week: 4, part_a_ml: 4, part_b_ml: 4, mkp_ml: null, ec: 0.7, stage: 'Established Seedlings', notes: 'These values are good for advanced seedling stage and also for early clones' },
  { week: 5, part_a_ml: 5, part_b_ml: 5, mkp_ml: null, ec: 0.8, stage: 'Established Seedlings', notes: 'These values are good for advanced seedling stage and also for early clones' },
  { week: 6, part_a_ml: 6, part_b_ml: 6, mkp_ml: null, ec: 1.0, stage: 'Full Growing and Early Flowering', notes: 'Good values for full growing and early flowering' },
  { week: 7, part_a_ml: 7, part_b_ml: 7, mkp_ml: null, ec: 1.1, stage: 'Full Growing and Early Flowering', notes: 'Good values for full growing and early flowering' },
  { week: 8, part_a_ml: 6, part_b_ml: 8, mkp_ml: 2, ec: 1.2, stage: 'Full Growing and Early Flowering', notes: 'Good values for full growing and early flowering' },
  { week: 9, part_a_ml: 7, part_b_ml: 9, mkp_ml: 2, ec: 1.3, stage: 'Mid Flowering', notes: 'These values are for mid flowering stages' },
  { week: 10, part_a_ml: 7, part_b_ml: 10, mkp_ml: 3, ec: 1.4, stage: 'Mid Flowering', notes: 'These values are for mid flowering stages' },
  { week: 11, part_a_ml: 8, part_b_ml: 11, mkp_ml: 3, ec: 1.5, stage: 'Mid Flowering', notes: 'These values are for mid flowering stages' },
  { week: 12, part_a_ml: 8, part_b_ml: 12, mkp_ml: 4, ec: 1.6, stage: 'Mid Flowering', notes: 'These values are for mid flowering stages' },
  { week: 13, part_a_ml: 9, part_b_ml: 13, mkp_ml: 4, ec: 1.7, stage: 'Full Flowering', notes: 'Full flowering will require even greater nutrition but always monitor carefully' },
  { week: 14, part_a_ml: 9, part_b_ml: 14, mkp_ml: 5, ec: 1.8, stage: 'Full Flowering', notes: 'Full flowering will require even greater nutrition but always monitor carefully' },
  { week: 15, part_a_ml: 10, part_b_ml: 15, mkp_ml: 5, ec: 1.9, stage: 'Full Flowering', notes: 'Full flowering will require even greater nutrition but always monitor carefully' },
  { week: 16, part_a_ml: 11, part_b_ml: 16, mkp_ml: 5, ec: 2.0, stage: 'Full Flowering', notes: 'Full flowering will require even greater nutrition but always monitor carefully' },
];

// Map an internal growth-stage key (GROWTH_STAGES values) to a representative
// week in the program, so the calculator can preselect a sensible default.
export function stageToWeek(stage) {
  switch (stage) {
    case 'seedling':
    case 'early_vegetative':
      return 3;
    case 'vegetative':
      return 6;
    case 'pre_flowering':
    case 'early_flowering':
      return 8;
    case 'mid_flowering':
      return 11;
    case 'late_flowering':
    case 'harvest_ready':
      return 15;
    default:
      return 6;
  }
}
