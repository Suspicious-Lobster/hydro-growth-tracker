// Water and nutrient consumption for one plant, and what it cost (MR-53).
//
// Everything here is pure and unit-canonical: volumes in liters, doses in
// ml per liter, prices per liter of product. The UI converts for display.
//
// Model: every reservoir event (a full change or a top-off) is water that
// went into the system. A log's doses are mixed at ml/L into the reservoir
// volume "in force" on that day: the most recent full change on or before
// the log's date, else the plant's configured reservoir_volume, else 0
// (a dose with no known volume cannot be costed, and is reported as such).

// Total liters put into the reservoir over the grow.
export function waterUsed(events) {
  return round2((events || []).reduce((sum, e) => sum + (Number(e.volume) || 0), 0));
}

// The reservoir volume (liters) to mix a dose into on `date`.
export function volumeInForce(date, events, plant) {
  const changes = (events || [])
    .filter((e) => e.kind === 'change' && typeof e.date === 'string' && e.date <= date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (Number(b.id) || 0) - (Number(a.id) || 0)));
  if (changes.length > 0) return Number(changes[0].volume) || 0;
  const configured = Number(plant?.reservoir_volume);
  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}

// Per product: total ml used across every log, keyed by dose name.
// { [name]: ml }. A dose on a day with no known volume adds 0 ml and is
// listed in `unknownVolume` (log ids) so the card can say so.
export function nutrientUsed(logs, events, plant) {
  const ml = {};
  const unknownVolume = [];
  for (const log of logs || []) {
    const doses = Array.isArray(log.doses) ? log.doses : [];
    if (doses.length === 0) continue;
    const liters = volumeInForce(log.date, events, plant);
    if (liters <= 0) { unknownVolume.push(log.id); continue; }
    for (const d of doses) {
      const perL = Number(d.ml_per_l) || 0;
      ml[d.name] = round2((ml[d.name] || 0) + perL * liters);
    }
  }
  return { ml, unknownVolume };
}

// Price a usage map with the settings' nutrient_prices ([{name, price_per_liter}]).
// Product names match case-insensitively after trimming. Returns
// { total, lines: [{name, ml, cost|null}], unpriced: [names] }.
export function grandCost(usage, prices) {
  const priceByName = new Map((prices || []).map((p) => [String(p.name).trim().toLowerCase(), Number(p.price_per_liter)]));
  const lines = [];
  const unpriced = [];
  let total = 0;
  for (const [name, ml] of Object.entries(usage?.ml || {})) {
    const perLiter = priceByName.get(name.trim().toLowerCase());
    if (perLiter === undefined || Number.isNaN(perLiter)) {
      unpriced.push(name);
      lines.push({ name, ml, cost: null });
      continue;
    }
    const cost = round2((ml / 1000) * perLiter);
    total = round2(total + cost);
    lines.push({ name, ml, cost });
  }
  return { total, lines, unpriced };
}

// Everything the cost card needs, in one call.
export function costSummary({ logs, events, plant, prices }) {
  const water = waterUsed(events);
  const usage = nutrientUsed(logs, events, plant);
  const priced = grandCost(usage, prices);
  return { water, usage, ...priced };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
