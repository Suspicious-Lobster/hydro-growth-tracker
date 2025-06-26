import express from 'express';
const router = express.Router();

/**
 * Feeding schedule taken directly from the image:
 *   ‑ Parts are ml per 1 L reservoir
 *   ‑ MKP = Mono‑potassium phosphate (only weeks 8–16)
 */
const staticSchedule = [
  { week: 1,  partA: 1,  partB: 1,  mkp: 0, ec: 0.2, note: 'Established seedlings' },
  { week: 2,  partA: 2,  partB: 2,  mkp: 0, ec: 0.4, note: 'Advanced seedling stage' },
  { week: 3,  partA: 3,  partB: 3,  mkp: 0, ec: 0.6, note: 'Early clones / seedlings' },
  { week: 4,  partA: 4,  partB: 4,  mkp: 0, ec: 0.7, note: 'Early vegetative' },
  { week: 5,  partA: 5,  partB: 5,  mkp: 0, ec: 0.8, note: 'Vegetative' },
  { week: 6,  partA: 6,  partB: 6,  mkp: 0, ec: 1.0, note: 'Full veg – strong growth' },
  { week: 7,  partA: 7,  partB: 7,  mkp: 0, ec: 1.1, note: 'Late veg / pre‑flower' },
  { week: 8,  partA: 6,  partB: 8,  mkp: 2, ec: 1.2, note: 'Early flowering' },
  { week: 9,  partA: 7,  partB: 9,  mkp: 2, ec: 1.3, note: 'Mid flowering' },
  { week: 10, partA: 7,  partB:10, mkp: 3, ec: 1.4, note: 'Mid flowering' },
  { week: 11, partA: 8,  partB:11, mkp: 3, ec: 1.5, note: 'Late flowering' },
  { week: 12, partA: 8,  partB:12, mkp: 4, ec: 1.6, note: 'Late flowering' },
  { week: 13, partA: 9,  partB:13, mkp: 4, ec: 1.7, note: 'Full flowering' },
  { week: 14, partA: 9,  partB:14, mkp: 5, ec: 1.8, note: 'Full flowering+' },
  { week: 15, partA:10,  partB:15, mkp: 5, ec: 1.9, note: 'Ripening – monitor EC' },
  { week: 16, partA:11,  partB:16, mkp: 5, ec: 2.0, note: 'Ripening – monitor carefully' },
];

router.get('/', (_req, res) => {
  res.json({ schedule: staticSchedule });
});

export default router;
