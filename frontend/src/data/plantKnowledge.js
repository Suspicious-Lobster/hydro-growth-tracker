export const GROWTH_STAGES = {
  SEEDLING: 'seedling',
  EARLY_VEG: 'early_vegetative',
  VEGETATIVE: 'vegetative',
  PRE_FLOWER: 'pre_flowering',
  EARLY_FLOWER: 'early_flowering',
  MID_FLOWER: 'mid_flowering',
  LATE_FLOWER: 'late_flowering',
  HARVEST: 'harvest_ready'
};

export const PLANT_TYPES = {
  TOMATO: 'tomato',
  LETTUCE: 'lettuce',
  BASIL: 'basil',
  PEPPER: 'pepper',
  CUCUMBER: 'cucumber',
  STRAWBERRY: 'strawberry',
  SPINACH: 'spinach',
  KALE: 'kale',
  CANNABIS: 'cannabis',
  GENERIC: 'generic'
};

// Comprehensive plant profiles
export const PLANT_PROFILES = {
  [PLANT_TYPES.TOMATO]: {
    name: 'Tomato',
    category: 'fruiting',
    lifecycle: 'annual',
    harvestTime: '75-85 days',
    optimalTemp: { min: 18, max: 26, unit: 'C' },
    optimalHumidity: { min: 60, max: 70 },
    lightRequirement: '14-16 hours',
    phRange: { min: 5.8, max: 6.2 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 15 },
        duration: '10-14 days',
        ec: { min: 0.8, max: 1.2 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'every 2-3 days',
          concentration: 'quarter strength',
          details: 'Focus on root development. Use a balanced starter solution with extra calcium to prevent blossom end rot later.'
        },
        care: {
          pruning: 'None required. Allow cotyledons to remain until true leaves develop.',
          monitoring: 'Watch for damping off (stem rot at soil line). Ensure good air circulation.',
          environment: 'Maintain 70-75°F (21-24°C). Humidity 65-70%. Gentle air movement.'
        },
        problems: [
          { issue: 'Damping off', cause: 'Too much moisture, poor air circulation', solution: 'Reduce watering, increase airflow' },
          { issue: 'Leggy growth', cause: 'Insufficient light', solution: 'Move closer to light source or increase intensity' }
        ]
      },
      [GROWTH_STAGES.EARLY_VEG]: {
        heightRange: { min: 15, max: 30 },
        duration: '14-21 days',
        ec: { min: 1.2, max: 1.6 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'half strength',
          details: 'Increase feeding frequency. Continue high nitrogen for leaf development. Calcium is crucial for cell wall strength.'
        },
        care: {
          pruning: 'Remove lower leaves touching growing medium. Pinch suckers when they appear.',
          monitoring: 'Check for first flower clusters forming. Monitor for nutrient deficiencies.',
          environment: 'Maintain temperature. Reduce humidity to 60-65% to prevent fungal issues.'
        },
        problems: [
          { issue: 'Yellowing lower leaves', cause: 'Normal or nitrogen deficiency', solution: 'Increase nitrogen if progressing rapidly' },
          { issue: 'Purple stems', cause: 'Phosphorus deficiency or cold stress', solution: 'Check temperature, increase phosphorus' }
        ]
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 30, max: 60 },
        duration: '21-35 days',
        ec: { min: 1.6, max: 2.0 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium-high',
          potassium: 'high',
          calcium: 'high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Peak vegetative feeding. High N-P-K ratio (3-1-2). Add Cal-Mag supplement if using RO water.'
        },
        care: {
          pruning: 'Remove suckers weekly. Prune lower branches below first flower cluster. Top if desired height reached.',
          monitoring: 'Support main stem if needed. Watch for first flower clusters. Check for pests.',
          environment: 'Maintain optimal conditions. Ensure adequate light penetration to lower leaves.'
        },
        problems: [
          { issue: 'Blossom end rot', cause: 'Calcium deficiency, inconsistent watering', solution: 'Increase calcium, maintain consistent moisture' },
          { issue: 'Leaf curl', cause: 'Heat stress, overwatering, virus', solution: 'Check environment, reduce watering if soil wet' }
        ]
      },
      [GROWTH_STAGES.PRE_FLOWER]: {
        heightRange: { min: 60, max: 100 },
        duration: '7-14 days',
        ec: { min: 1.8, max: 2.2 },
        nutrients: {
          nitrogen: 'medium-high',
          phosphorus: 'high',
          potassium: 'high',
          calcium: 'high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Transition to bloom nutrients. Reduce nitrogen slightly, increase phosphorus for flower development.'
        },
        care: {
          pruning: 'Final sucker removal. Support fruit clusters with clips or cages. Remove excess leaves for light penetration.',
          monitoring: 'First flowers should be opening. Hand pollinate if no airflow. Watch for flower drop.',
          environment: 'Maintain temperature. Good air circulation essential for pollination.'
        },
        problems: [
          { issue: 'Flower drop', cause: 'Temperature stress, poor pollination', solution: 'Optimize temperature, improve air circulation' },
          { issue: 'Poor fruit set', cause: 'Lack of pollination, nutrient imbalance', solution: 'Hand pollinate, check feeding schedule' }
        ]
      },
      [GROWTH_STAGES.EARLY_FLOWER]: {
        heightRange: { min: 100, max: 150 },
        duration: '14-21 days',
        ec: { min: 2.0, max: 2.4 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'high',
          potassium: 'very high',
          calcium: 'high',
          magnesium: 'high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Switch to bloom formula. Higher P-K for fruit development. Maintain calcium for fruit quality.'
        },
        care: {
          pruning: 'Minimal pruning. Remove only diseased/damaged leaves. Support heavy fruit clusters.',
          monitoring: 'Fruit setting and early development. Monitor for nutrient deficiencies. Check support systems.',
          environment: 'Consistent environment crucial. Avoid temperature fluctuations during fruit set.'
        },
        problems: [
          { issue: 'Small fruit size', cause: 'Insufficient potassium, overcrowding', solution: 'Increase potassium, thin fruit clusters' },
          { issue: 'Cracking', cause: 'Irregular watering, calcium deficiency', solution: 'Consistent moisture, increase calcium' }
        ]
      },
      [GROWTH_STAGES.MID_FLOWER]: {
        heightRange: { min: 150, max: 200 },
        duration: '21-35 days',
        ec: { min: 2.2, max: 2.6 },
        nutrients: {
          nitrogen: 'low-medium',
          phosphorus: 'high',
          potassium: 'very high',
          calcium: 'high',
          magnesium: 'high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Peak fruiting nutrition. Very high potassium for fruit size and quality. Reduce nitrogen to prevent excessive vegetative growth.'
        },
        care: {
          pruning: 'Remove lower leaves yellowing naturally. Thin fruit clusters if overloaded. Support heavy branches.',
          monitoring: 'Rapid fruit development. Check daily for ripe fruit. Monitor plant health under heavy fruit load.',
          environment: 'Stable conditions. Ensure adequate light reaches developing fruit.'
        },
        problems: [
          { issue: 'Fruit not ripening', cause: 'Insufficient light, temperature issues', solution: 'Improve lighting, optimize temperature' },
          { issue: 'Splitting fruit', cause: 'Rapid water uptake after dry period', solution: 'Consistent watering schedule' }
        ]
      },
      [GROWTH_STAGES.LATE_FLOWER]: {
        heightRange: { min: 200, max: 300 },
        duration: '14-21 days',
        ec: { min: 2.0, max: 2.4 },
        nutrients: {
          nitrogen: 'low',
          phosphorus: 'medium-high',
          potassium: 'very high',
          calcium: 'medium-high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'bloom with ripening enhancer',
          details: 'Focus on fruit ripening and quality. Reduce overall feeding slightly. Add ripening enhancers if available.'
        },
        care: {
          pruning: 'Remove only necessary leaves. Allow plant to redirect energy to fruit ripening.',
          monitoring: 'Daily harvest of ripe fruit. Check for overripe fruit. Monitor overall plant health.',
          environment: 'Consistent conditions for even ripening. Good air circulation to prevent fruit rot.'
        },
        problems: [
          { issue: 'Uneven ripening', cause: 'Light distribution, temperature variation', solution: 'Improve light/heat distribution' },
          { issue: 'Fruit rot', cause: 'High humidity, poor air circulation', solution: 'Reduce humidity, increase airflow' }
        ]
      }
    }
  },

  [PLANT_TYPES.LETTUCE]: {
    name: 'Lettuce',
    category: 'leafy_green',
    lifecycle: 'annual',
    harvestTime: '30-45 days',
    optimalTemp: { min: 15, max: 22, unit: 'C' },
    optimalHumidity: { min: 50, max: 60 },
    lightRequirement: '12-14 hours',
    phRange: { min: 5.5, max: 6.5 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 5 },
        duration: '7-10 days',
        ec: { min: 0.6, max: 1.0 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'low'
        },
        feeding: {
          frequency: 'every 2 days',
          concentration: 'quarter strength',
          details: 'Gentle feeding for young roots. Balanced nutrition to establish healthy seedlings.'
        },
        care: {
          pruning: 'None required. Allow all leaves to develop.',
          monitoring: 'Watch for damping off. Ensure good air circulation around seedlings.',
          environment: 'Cool conditions preferred. 60-65°F ideal. High humidity (80-85%) for germination.'
        }
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 5, max: 15 },
        duration: '20-35 days',
        ec: { min: 1.0, max: 1.6 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'High nitrogen for rapid leaf development. Consistent feeding for continuous growth.'
        },
        care: {
          pruning: 'Harvest outer leaves when mature. Remove any flowering stalks immediately.',
          monitoring: 'Watch for bolting (going to seed). Monitor for tip burn from heat/light stress.',
          environment: 'Keep cool. Provide good air circulation. Avoid temperature fluctuations.'
        }
      }
    }
  },

  [PLANT_TYPES.BASIL]: {
    name: 'Basil',
    category: 'leafy_green',
    lifecycle: 'annual',
    harvestTime: '30-60 days',
    optimalTemp: { min: 20, max: 28, unit: 'C' },
    optimalHumidity: { min: 40, max: 60 },
    lightRequirement: '14-16 hours',
    phRange: { min: 5.5, max: 6.5 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 8 },
        duration: '7-10 days',
        ec: { min: 0.5, max: 0.8 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'low',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'low'
        },
        feeding: {
          frequency: 'every 2 days',
          concentration: 'quarter strength',
          details: 'Light feeding while roots establish. Basil is sensitive to overfeeding early on.'
        },
        care: {
          pruning: 'None required.',
          monitoring: 'Watch for damping off. Keep medium moist but not waterlogged.',
          environment: 'Warm conditions preferred, 22-26C. High humidity (60-70%) for germination.'
        },
        problems: [
          { issue: 'Damping off', cause: 'Excess moisture, poor airflow', solution: 'Reduce watering, increase ventilation' }
        ]
      },
      [GROWTH_STAGES.EARLY_VEG]: {
        heightRange: { min: 8, max: 18 },
        duration: '10-14 days',
        ec: { min: 0.8, max: 1.1 },
        nutrients: {
          nitrogen: 'medium-high',
          phosphorus: 'low',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'every 1-2 days',
          concentration: 'half strength',
          details: 'Increase feeding as roots fill out. Nitrogen supports leaf growth without pushing early flowering.'
        },
        care: {
          pruning: 'Pinch the growing tip once 3-4 leaf sets form to encourage bushing.',
          monitoring: 'Check for aphids on new growth. Watch leaf color for nitrogen deficiency.',
          environment: 'Maintain warmth. Avoid cold drafts, which stunt growth.'
        },
        problems: [
          { issue: 'Slow bushing', cause: 'No pinching done', solution: 'Pinch growing tips to force lateral branching' }
        ]
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 18, max: 35 },
        duration: '21-35 days',
        ec: { min: 1.1, max: 1.6 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'low-medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Sustained feeding for continuous leaf production. Remove flower spikes to keep leaves tender.'
        },
        care: {
          pruning: 'Pinch flower spikes as soon as they appear. Harvest from the top down to encourage branching.',
          monitoring: 'Watch for downy mildew on leaf undersides in humid conditions.',
          environment: 'Good airflow between plants to reduce fungal risk.'
        },
        problems: [
          { issue: 'Bolting/flowering', cause: 'Long days, heat stress', solution: 'Pinch flower spikes promptly' },
          { issue: 'Downy mildew', cause: 'High humidity, poor airflow', solution: 'Increase ventilation, reduce humidity' }
        ]
      },
      [GROWTH_STAGES.HARVEST]: {
        heightRange: { min: 35, max: 45 },
        duration: 'ongoing, harvest every 1-2 weeks',
        ec: { min: 1.3, max: 1.6 },
        nutrients: {
          nitrogen: 'medium-high',
          phosphorus: 'low-medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Maintain full feeding through repeated harvests. Harvest above a leaf node to keep the plant productive.'
        },
        care: {
          pruning: 'Harvest the top third of each stem regularly; never strip a plant bare.',
          monitoring: 'Continue removing any flower spikes to extend the harvest window.',
          environment: 'Stable warm conditions extend productive life.'
        },
        problems: [
          { issue: 'Leaves turning bitter', cause: 'Plant allowed to flower', solution: 'Harvest more frequently, remove flowers early' }
        ]
      }
    }
  },

  [PLANT_TYPES.PEPPER]: {
    name: 'Pepper',
    category: 'fruiting',
    lifecycle: 'annual',
    harvestTime: '70-90 days',
    optimalTemp: { min: 21, max: 29, unit: 'C' },
    optimalHumidity: { min: 50, max: 65 },
    lightRequirement: '14-16 hours',
    phRange: { min: 5.8, max: 6.3 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 10 },
        duration: '14-21 days',
        ec: { min: 0.8, max: 1.2 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'low'
        },
        feeding: {
          frequency: 'every 2-3 days',
          concentration: 'quarter strength',
          details: 'Peppers germinate and establish slowly; keep feeding light until true leaves are well formed.'
        },
        care: {
          pruning: 'None required.',
          monitoring: 'Watch for damping off. Peppers like warm root zones (24-27C).',
          environment: 'Warm and humid, 75-80% humidity during germination.'
        },
        problems: [
          { issue: 'Slow/uneven germination', cause: 'Cold root zone', solution: 'Use bottom heat to keep media above 24C' }
        ]
      },
      [GROWTH_STAGES.EARLY_VEG]: {
        heightRange: { min: 10, max: 25 },
        duration: '14-21 days',
        ec: { min: 1.2, max: 1.6 },
        nutrients: {
          nitrogen: 'medium-high',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium-high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'half strength',
          details: 'Build up root and stem strength before the plant branches.'
        },
        care: {
          pruning: 'Remove any early flower buds to build a stronger plant first.',
          monitoring: 'Watch for stretching under low light.',
          environment: 'Keep warm; peppers stall below 15C.'
        },
        problems: [
          { issue: 'Leggy stems', cause: 'Insufficient light', solution: 'Increase light intensity or move closer to source' }
        ]
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 25, max: 45 },
        duration: '21-35 days',
        ec: { min: 1.6, max: 1.8 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Peak leaf and branch development. Support calcium supply to prevent blossom end rot later.'
        },
        care: {
          pruning: 'Top the main stem once it forks to encourage multiple branches.',
          monitoring: 'Check branching pattern (main "Y" split) and support structure.',
          environment: 'Maintain consistent warmth and airflow.'
        },
        problems: [
          { issue: 'Purple stems', cause: 'Cold stress or phosphorus deficiency', solution: 'Check root zone temperature, adjust feed' }
        ]
      },
      [GROWTH_STAGES.PRE_FLOWER]: {
        heightRange: { min: 45, max: 60 },
        duration: '10-14 days',
        ec: { min: 1.8, max: 2.0 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'high',
          potassium: 'high',
          calcium: 'high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Transition toward bloom nutrients as flower buds form at branch forks.'
        },
        care: {
          pruning: 'Stake or cage the plant before it becomes top-heavy with fruit.',
          monitoring: 'Watch for first flowers opening.',
          environment: 'Stable temperature improves fruit set.'
        },
        problems: [
          { issue: 'Flower bud drop', cause: 'Temperature swings, stress', solution: 'Stabilize environment' }
        ]
      },
      [GROWTH_STAGES.EARLY_FLOWER]: {
        heightRange: { min: 60, max: 75 },
        duration: '14-21 days',
        ec: { min: 2.0, max: 2.2 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'high',
          potassium: 'high',
          calcium: 'high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Higher phosphorus and potassium to support fruit set and early sizing.'
        },
        care: {
          pruning: 'Remove weak inner growth to focus energy on developing pods.',
          monitoring: 'Hand pollinate if airflow/pollinators are limited.',
          environment: 'Avoid heat spikes above 32C, which cause flower drop.'
        },
        problems: [
          { issue: 'Poor fruit set', cause: 'Heat stress, low pollination', solution: 'Hand pollinate, improve airflow' }
        ]
      },
      [GROWTH_STAGES.MID_FLOWER]: {
        heightRange: { min: 75, max: 90 },
        duration: '21-35 days',
        ec: { min: 2.2, max: 2.4 },
        nutrients: {
          nitrogen: 'low-medium',
          phosphorus: 'high',
          potassium: 'very high',
          calcium: 'high',
          magnesium: 'high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Peak fruiting nutrition. High potassium supports wall thickness and flavor development.'
        },
        care: {
          pruning: 'Support heavy fruiting branches. Remove any diseased leaves.',
          monitoring: 'Track fruit sizing and color change toward maturity.',
          environment: 'Consistent conditions for even fruit development.'
        },
        problems: [
          { issue: 'Blossom end rot', cause: 'Calcium deficiency, inconsistent watering', solution: 'Increase calcium, even out watering' }
        ]
      },
      [GROWTH_STAGES.LATE_FLOWER]: {
        heightRange: { min: 90, max: 110 },
        duration: '14-21 days',
        ec: { min: 1.8, max: 2.2 },
        nutrients: {
          nitrogen: 'low',
          phosphorus: 'medium-high',
          potassium: 'high',
          calcium: 'medium-high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'bloom with ripening enhancer',
          details: 'Ease feeding slightly as pods ripen to full color.'
        },
        care: {
          pruning: 'Harvest ripe pods regularly to encourage further fruiting.',
          monitoring: 'Watch for sunscald on exposed fruit.',
          environment: 'Good airflow prevents fruit rot in humid conditions.'
        },
        problems: [
          { issue: 'Sunscald', cause: 'Direct intense light on exposed fruit', solution: 'Provide light shading for exposed pods' }
        ]
      }
    }
  },

  [PLANT_TYPES.CUCUMBER]: {
    name: 'Cucumber',
    category: 'fruiting',
    lifecycle: 'annual',
    harvestTime: '50-70 days',
    optimalTemp: { min: 18, max: 28, unit: 'C' },
    optimalHumidity: { min: 60, max: 70 },
    lightRequirement: '12-16 hours',
    phRange: { min: 5.8, max: 6.0 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 15 },
        duration: '7-10 days',
        ec: { min: 1.0, max: 1.3 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'low'
        },
        feeding: {
          frequency: 'every 1-2 days',
          concentration: 'quarter strength',
          details: 'Fast-germinating; move to light feeding quickly as cucumbers grow rapidly from the start.'
        },
        care: {
          pruning: 'None required.',
          monitoring: 'Watch for damping off in cool, wet media.',
          environment: 'Warm, humid conditions (75-80% humidity) for quick germination.'
        },
        problems: [
          { issue: 'Damping off', cause: 'Cold, wet media', solution: 'Keep media warm and well-drained' }
        ]
      },
      [GROWTH_STAGES.EARLY_VEG]: {
        heightRange: { min: 15, max: 40 },
        duration: '10-14 days',
        ec: { min: 1.3, max: 1.6 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium-high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'half strength',
          details: 'Rapid vine growth begins; ramp up feeding to keep pace.'
        },
        care: {
          pruning: 'Begin training the vine onto a trellis or string.',
          monitoring: 'Watch for tendrils grabbing support; guide as needed.',
          environment: 'High humidity supports rapid leaf expansion.'
        },
        problems: [
          { issue: 'Weak vine growth', cause: 'Insufficient nitrogen or light', solution: 'Increase feeding strength and light' }
        ]
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 40, max: 90 },
        duration: '14-21 days',
        ec: { min: 1.6, max: 1.9 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'high',
          calcium: 'high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Vigorous vine and leaf growth. Keep nitrogen high to build the canopy that will support fruiting.'
        },
        care: {
          pruning: 'Remove lower leaves and side shoots below the first fruit set point. Continue trellis training.',
          monitoring: 'Check for powdery mildew on leaves in dry conditions.',
          environment: 'Maintain airflow through the dense canopy.'
        },
        problems: [
          { issue: 'Powdery mildew', cause: 'Dry leaves, poor airflow', solution: 'Increase circulation, avoid leaf-dry stress' }
        ]
      },
      [GROWTH_STAGES.PRE_FLOWER]: {
        heightRange: { min: 90, max: 130 },
        duration: '7-10 days',
        ec: { min: 1.9, max: 2.1 },
        nutrients: {
          nitrogen: 'medium-high',
          phosphorus: 'high',
          potassium: 'high',
          calcium: 'high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Transition to bloom feed as female flowers begin to form.'
        },
        care: {
          pruning: 'Remove any early male flowers if a seedless variety is desired.',
          monitoring: 'Watch for first female flowers (small fruit behind the bloom).',
          environment: 'Stable warmth aids flower development.'
        },
        problems: [
          { issue: 'Few female flowers', cause: 'Heat or light stress', solution: 'Stabilize temperature and light schedule' }
        ]
      },
      [GROWTH_STAGES.EARLY_FLOWER]: {
        heightRange: { min: 130, max: 170 },
        duration: '10-14 days',
        ec: { min: 2.1, max: 2.3 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'high',
          potassium: 'very high',
          calcium: 'high',
          magnesium: 'high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'High potassium supports rapid fruit sizing, which happens quickly in cucumbers.'
        },
        care: {
          pruning: 'Continue trellis training. Remove excess side shoots to focus energy on fruit.',
          monitoring: 'Harvest fruit while young and tender; oversized fruit slows further production.',
          environment: 'Consistent watering prevents bitter fruit.'
        },
        problems: [
          { issue: 'Bitter fruit', cause: 'Inconsistent watering, stress', solution: 'Maintain even moisture and feeding' }
        ]
      },
      [GROWTH_STAGES.MID_FLOWER]: {
        heightRange: { min: 170, max: 210 },
        duration: '14-28 days',
        ec: { min: 2.2, max: 2.5 },
        nutrients: {
          nitrogen: 'low-medium',
          phosphorus: 'high',
          potassium: 'very high',
          calcium: 'high',
          magnesium: 'high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Peak, continuous fruiting. Harvest every 1-2 days to keep the vine producing.'
        },
        care: {
          pruning: 'Remove yellowing lower leaves. Keep pruning side shoots to manage vine size.',
          monitoring: 'Daily harvest checks; fruit sizes quickly at this stage.',
          environment: 'Stable humidity and airflow reduce disease pressure on the dense canopy.'
        },
        problems: [
          { issue: 'Downy mildew', cause: 'High humidity, poor airflow', solution: 'Increase ventilation, avoid leaf wetness' }
        ]
      },
      [GROWTH_STAGES.LATE_FLOWER]: {
        heightRange: { min: 210, max: 250 },
        duration: '14-21 days',
        ec: { min: 1.9, max: 2.3 },
        nutrients: {
          nitrogen: 'low',
          phosphorus: 'medium-high',
          potassium: 'high',
          calcium: 'medium-high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'bloom, reduced strength',
          details: 'Production naturally tapers; ease feeding slightly as the vine ages.'
        },
        care: {
          pruning: 'Remove spent vine sections. Continue harvesting remaining fruit promptly.',
          monitoring: 'Watch for declining vigor signaling end of productive life.',
          environment: 'Maintain airflow to limit late-season fungal issues.'
        },
        problems: [
          { issue: 'Declining yield', cause: 'Natural plant aging', solution: 'Plan succession planting if continuous harvest needed' }
        ]
      }
    }
  },

  [PLANT_TYPES.STRAWBERRY]: {
    name: 'Strawberry',
    category: 'fruiting',
    lifecycle: 'perennial',
    harvestTime: '60-90 days to first fruit',
    optimalTemp: { min: 15, max: 24, unit: 'C' },
    optimalHumidity: { min: 60, max: 70 },
    lightRequirement: '10-12 hours',
    phRange: { min: 5.5, max: 6.5 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 5 },
        duration: '14-21 days',
        ec: { min: 0.6, max: 0.8 },
        nutrients: {
          nitrogen: 'low-medium',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'low'
        },
        feeding: {
          frequency: 'every 2-3 days',
          concentration: 'quarter strength',
          details: 'Light feeding while the crown and root system establish.'
        },
        care: {
          pruning: 'None required. Remove any runners that form this early.',
          monitoring: 'Watch crown for rot; keep crown level with the medium surface, not buried.',
          environment: 'Cool and humid, 70-75% humidity.'
        },
        problems: [
          { issue: 'Crown rot', cause: 'Crown planted too deep or overwatered', solution: 'Keep crown at surface level, reduce watering' }
        ]
      },
      [GROWTH_STAGES.EARLY_VEG]: {
        heightRange: { min: 5, max: 10 },
        duration: '14-21 days',
        ec: { min: 0.8, max: 1.0 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'every 1-2 days',
          concentration: 'half strength',
          details: 'Build leaf canopy and root mass ahead of flowering.'
        },
        care: {
          pruning: 'Remove runners to direct energy into the main crown unless propagating.',
          monitoring: 'Check for spider mites on leaf undersides.',
          environment: 'Cool conditions favor strong crown development.'
        },
        problems: [
          { issue: 'Spider mites', cause: 'Low humidity, warm conditions', solution: 'Raise humidity, inspect leaf undersides regularly' }
        ]
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 10, max: 15 },
        duration: '21-35 days',
        ec: { min: 1.0, max: 1.2 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Full canopy development ahead of flower truss emergence.'
        },
        care: {
          pruning: 'Continue removing runners. Trim any damaged outer leaves.',
          monitoring: 'Watch for first flower trusses emerging from the crown center.',
          environment: 'Stable cool-to-moderate temperature promotes flowering.'
        },
        problems: [
          { issue: 'No flower trusses forming', cause: 'Insufficient chill period or day length mismatch', solution: 'Check cultivar day-length requirements' }
        ]
      },
      [GROWTH_STAGES.PRE_FLOWER]: {
        heightRange: { min: 15, max: 18 },
        duration: '7-14 days',
        ec: { min: 1.1, max: 1.3 },
        nutrients: {
          nitrogen: 'low-medium',
          phosphorus: 'high',
          potassium: 'medium-high',
          calcium: 'medium-high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Higher phosphorus supports flower truss development.'
        },
        care: {
          pruning: 'Thin weak flower buds to favor larger fruit on remaining trusses.',
          monitoring: 'Watch for first open flowers.',
          environment: 'Good airflow assists pollination.'
        },
        problems: [
          { issue: 'Weak flower trusses', cause: 'Nutrient imbalance', solution: 'Increase phosphorus and potassium' }
        ]
      },
      [GROWTH_STAGES.EARLY_FLOWER]: {
        heightRange: { min: 18, max: 20 },
        duration: '10-14 days',
        ec: { min: 1.2, max: 1.4 },
        nutrients: {
          nitrogen: 'low',
          phosphorus: 'high',
          potassium: 'high',
          calcium: 'medium-high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Hand pollination with a soft brush improves fruit set indoors.'
        },
        care: {
          pruning: 'Continue removing runners so all energy goes to fruit.',
          monitoring: 'Watch for successful pollination (fruit beginning to swell behind the flower).',
          environment: 'Gentle airflow aids pollen transfer.'
        },
        problems: [
          { issue: 'Poor fruit set', cause: 'No pollinators, still air', solution: 'Hand pollinate with a soft brush' }
        ]
      },
      [GROWTH_STAGES.MID_FLOWER]: {
        heightRange: { min: 20, max: 22 },
        duration: '14-28 days',
        ec: { min: 1.25, max: 1.4 },
        nutrients: {
          nitrogen: 'low',
          phosphorus: 'medium-high',
          potassium: 'high',
          calcium: 'medium-high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Fruit sizing stage; maintain potassium for sweetness and firmness.'
        },
        care: {
          pruning: 'Elevate developing fruit off the medium to prevent rot.',
          monitoring: 'Check fruit color progression daily as it nears ripeness.',
          environment: 'Good airflow around fruit reduces botrytis risk.'
        },
        problems: [
          { issue: 'Botrytis (gray mold)', cause: 'High humidity, fruit contact with wet surfaces', solution: 'Elevate fruit, improve airflow, reduce humidity' }
        ]
      },
      [GROWTH_STAGES.LATE_FLOWER]: {
        heightRange: { min: 22, max: 25 },
        duration: '14-21 days',
        ec: { min: 1.0, max: 1.4 },
        nutrients: {
          nitrogen: 'low',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'reduced strength',
          details: 'Ease EC slightly during ripening to favor sweetness over vegetative push.'
        },
        care: {
          pruning: 'Harvest ripe berries every 1-2 days.',
          monitoring: 'Watch for fully red color and easy detachment from the calyx.',
          environment: 'Cooler, drier air during ripening improves flavor and shelf life.'
        },
        problems: [
          { issue: 'Pale/uneven fruit color', cause: 'Insufficient light during ripening', solution: 'Increase light intensity in final ripening stage' }
        ]
      }
    }
  },

  [PLANT_TYPES.SPINACH]: {
    name: 'Spinach',
    category: 'leafy_green',
    lifecycle: 'annual',
    harvestTime: '35-45 days',
    optimalTemp: { min: 16, max: 22, unit: 'C' },
    optimalHumidity: { min: 50, max: 60 },
    lightRequirement: '10-12 hours',
    phRange: { min: 6.0, max: 7.0 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 5 },
        duration: '7-10 days',
        ec: { min: 1.0, max: 1.4 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'low'
        },
        feeding: {
          frequency: 'every 2 days',
          concentration: 'quarter strength',
          details: 'Cool-season crop; keep root zone cool to avoid premature bolting later.'
        },
        care: {
          pruning: 'None required.',
          monitoring: 'Watch for damping off. Keep temperature below 22C.',
          environment: 'Cool, 60-65% humidity for germination.'
        },
        problems: [
          { issue: 'Poor germination', cause: 'Root zone too warm', solution: 'Keep temperature below 22C during germination' }
        ]
      },
      [GROWTH_STAGES.EARLY_VEG]: {
        heightRange: { min: 5, max: 10 },
        duration: '10-14 days',
        ec: { min: 1.4, max: 1.8 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'half strength',
          details: 'High nitrogen builds leaf mass quickly in this fast-growing crop.'
        },
        care: {
          pruning: 'None required.',
          monitoring: 'Watch for early bolting if temperatures spike.',
          environment: 'Keep cool; spinach bolts readily above 24C.'
        },
        problems: [
          { issue: 'Early bolting', cause: 'Heat stress, long day length', solution: 'Keep temperature down, shorten light period if possible' }
        ]
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 10, max: 20 },
        duration: '14-28 days',
        ec: { min: 1.8, max: 2.3 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Sustained high nitrogen for continuous leaf production.'
        },
        care: {
          pruning: 'Harvest outer leaves as they reach full size to encourage new growth.',
          monitoring: 'Watch for leaf miner damage and downy mildew.',
          environment: 'Cool with good airflow.'
        },
        problems: [
          { issue: 'Leaf miner', cause: 'Adult flies laying eggs in leaves', solution: 'Remove affected leaves, use insect netting' }
        ]
      },
      [GROWTH_STAGES.HARVEST]: {
        heightRange: { min: 20, max: 25 },
        duration: 'ongoing, harvest outer leaves',
        ec: { min: 2.0, max: 2.3 },
        nutrients: {
          nitrogen: 'medium-high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Maintain feeding through repeated outer-leaf harvests until the plant begins to bolt.'
        },
        care: {
          pruning: 'Harvest outer leaves regularly, leaving the center crown intact.',
          monitoring: 'Once a center stalk starts to elongate, harvest the whole plant before it bolts.',
          environment: 'Keep as cool as practical to extend the harvest window.'
        },
        problems: [
          { issue: 'Bitter leaves', cause: 'Plant has begun bolting', solution: 'Harvest promptly once bolting starts' }
        ]
      }
    }
  },

  [PLANT_TYPES.KALE]: {
    name: 'Kale',
    category: 'leafy_green',
    lifecycle: 'biennial',
    harvestTime: '50-65 days',
    optimalTemp: { min: 15, max: 24, unit: 'C' },
    optimalHumidity: { min: 50, max: 60 },
    lightRequirement: '12-14 hours',
    phRange: { min: 6.0, max: 6.5 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 8 },
        duration: '7-10 days',
        ec: { min: 0.8, max: 1.0 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'low'
        },
        feeding: {
          frequency: 'every 2 days',
          concentration: 'quarter strength',
          details: 'Cool-season brassica; establishes steadily with light early feeding.'
        },
        care: {
          pruning: 'None required.',
          monitoring: 'Watch for damping off and flea beetle damage on cotyledons.',
          environment: 'Cool, 65-70% humidity for germination.'
        },
        problems: [
          { issue: 'Flea beetle damage', cause: 'Pest pressure on young leaves', solution: 'Use insect netting, treat if severe' }
        ]
      },
      [GROWTH_STAGES.EARLY_VEG]: {
        heightRange: { min: 8, max: 18 },
        duration: '14-21 days',
        ec: { min: 1.0, max: 1.25 },
        nutrients: {
          nitrogen: 'medium-high',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'half strength',
          details: 'Build a strong leaf base; kale is a slower-growing brassica than spinach.'
        },
        care: {
          pruning: 'None required.',
          monitoring: 'Watch for cabbage worms and aphids.',
          environment: 'Cool conditions produce sweeter, less bitter leaves.'
        },
        problems: [
          { issue: 'Aphid clusters', cause: 'Warm, still air on new growth', solution: 'Increase airflow, spot-treat affected leaves' }
        ]
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 18, max: 35 },
        duration: '21-42 days',
        ec: { min: 1.25, max: 1.5 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Sustained feeding for the large, thick leaves kale is grown for.'
        },
        care: {
          pruning: 'Harvest outer/lower leaves once hand-sized, leaving the crown to keep producing.',
          monitoring: 'Watch for cabbage worms; check leaf undersides.',
          environment: 'Good airflow to keep dense foliage dry.'
        },
        problems: [
          { issue: 'Cabbage worm holes', cause: 'Caterpillar feeding', solution: 'Hand-pick, use netting or Bt treatment' }
        ]
      },
      [GROWTH_STAGES.HARVEST]: {
        heightRange: { min: 35, max: 50 },
        duration: 'ongoing, harvest outer leaves',
        ec: { min: 1.4, max: 1.5 },
        nutrients: {
          nitrogen: 'medium-high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Maintain feeding through ongoing harvests; kale can produce for months if kept cool.'
        },
        care: {
          pruning: 'Continue harvesting outer leaves, always leaving the top crown intact.',
          monitoring: 'Flavor improves after light cold exposure; watch for bolting in warm conditions.',
          environment: 'Cooler temperatures extend the productive harvest window.'
        },
        problems: [
          { issue: 'Tough, bitter leaves', cause: 'Heat stress or leaves left too long', solution: 'Harvest more frequently, keep cool' }
        ]
      }
    }
  },

  [PLANT_TYPES.CANNABIS]: {
    name: 'Cannabis',
    category: 'fruiting',
    lifecycle: 'annual',
    harvestTime: '90-120 days',
    optimalTemp: { min: 20, max: 28, unit: 'C' },
    optimalHumidity: { min: 40, max: 60 },
    lightRequirement: '12-18 hours',
    phRange: { min: 5.8, max: 6.2 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 15 },
        duration: '7-14 days',
        ec: { min: 0.4, max: 0.8 },
        nutrients: {
          nitrogen: 'low',
          phosphorus: 'low',
          potassium: 'low',
          calcium: 'medium',
          magnesium: 'low'
        },
        feeding: {
          frequency: 'every 2-3 days',
          concentration: 'quarter strength',
          details: 'Very light feeding; young roots are easily burned by excess salts.'
        },
        care: {
          pruning: 'None required.',
          monitoring: 'Watch for damping off and nutrient burn on cotyledons.',
          environment: 'Warm and humid, 65-70% humidity, gentle airflow.'
        },
        problems: [
          { issue: 'Nutrient burn on tips', cause: 'Feeding too strong for seedling stage', solution: 'Dilute solution, feed less frequently' }
        ]
      },
      [GROWTH_STAGES.EARLY_VEG]: {
        heightRange: { min: 15, max: 35 },
        duration: '14-21 days',
        ec: { min: 0.8, max: 1.2 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'low-medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'half strength',
          details: 'Ramp up nitrogen as the plant establishes its first true node sets.'
        },
        care: {
          pruning: 'Top the main stem above the third or fourth node if training for multiple colas.',
          monitoring: 'Watch for stretching under insufficient light.',
          environment: 'Keep humidity moderate (55-65%) to encourage sturdy stem growth.'
        },
        problems: [
          { issue: 'Excessive stretch', cause: 'Light too far away or too dim', solution: 'Raise light intensity or lower fixture' }
        ]
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 35, max: 70 },
        duration: '21-42 days',
        ec: { min: 1.2, max: 1.6 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'high',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Peak vegetative growth. High nitrogen builds the canopy that will support flower yield.'
        },
        care: {
          pruning: 'Low-stress train branches and remove lower growth that will not receive light in flower.',
          monitoring: 'Check for pests (spider mites, thrips) before switching to flower.',
          environment: 'Maintain strong airflow through the canopy.'
        },
        problems: [
          { issue: 'Nitrogen toxicity (dark, clawed leaves)', cause: 'Overfeeding', solution: 'Flush with plain water, reduce feed strength' }
        ]
      },
      [GROWTH_STAGES.PRE_FLOWER]: {
        heightRange: { min: 70, max: 100 },
        duration: '7-14 days',
        ec: { min: 1.6, max: 1.8 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium-high',
          potassium: 'high',
          calcium: 'high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Transition feed toward bloom formula as the light schedule switches and pistils begin showing.'
        },
        care: {
          pruning: 'Final defoliation pass to open the canopy to light before flowers bulk up.',
          monitoring: 'Confirm plant sex; watch for the stretch that follows the light schedule switch.',
          environment: 'Stable temperature and humidity reduce stress during the transition.'
        },
        problems: [
          { issue: 'Hermaphroditism', cause: 'Stress during light transition', solution: 'Minimize light leaks and environmental stress' }
        ]
      },
      [GROWTH_STAGES.EARLY_FLOWER]: {
        heightRange: { min: 100, max: 130 },
        duration: '14-21 days',
        ec: { min: 1.8, max: 2.0 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'high',
          potassium: 'high',
          calcium: 'high',
          magnesium: 'high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Bloom nutrients with higher phosphorus and potassium as bud sites form.'
        },
        care: {
          pruning: 'Support branches as bud weight increases. Continue light defoliation for airflow.',
          monitoring: 'Track bud development at each node.',
          environment: 'Lower humidity (45-55%) reduces bud rot risk as flowers thicken.'
        },
        problems: [
          { issue: 'Slow bud development', cause: 'Light intensity too low for flower stage', solution: 'Increase light intensity for the flowering canopy' }
        ]
      },
      [GROWTH_STAGES.MID_FLOWER]: {
        heightRange: { min: 130, max: 160 },
        duration: '21-35 days',
        ec: { min: 2.0, max: 2.2 },
        nutrients: {
          nitrogen: 'low-medium',
          phosphorus: 'high',
          potassium: 'very high',
          calcium: 'high',
          magnesium: 'high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength bloom',
          details: 'Peak bud swell. High potassium supports density and resin production.'
        },
        care: {
          pruning: 'Support heavy colas. Remove any leaves shading bud sites directly above them.',
          monitoring: 'Watch trichome development for maturity cues.',
          environment: 'Keep humidity below 50% to limit bud rot in dense colas.'
        },
        problems: [
          { issue: 'Bud rot (botrytis)', cause: 'High humidity, dense un-aired colas', solution: 'Lower humidity, improve airflow, remove affected buds' }
        ]
      },
      [GROWTH_STAGES.LATE_FLOWER]: {
        heightRange: { min: 160, max: 200 },
        duration: '14-21 days',
        ec: { min: 2.0, max: 2.4 },
        nutrients: {
          nitrogen: 'low',
          phosphorus: 'medium-high',
          potassium: 'high',
          calcium: 'medium-high',
          magnesium: 'medium-high'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'bloom, then plain water flush before harvest',
          details: 'Ripen buds toward final harvest; many growers flush with plain water for the last 7-10 days.'
        },
        care: {
          pruning: 'No further pruning; let the plant finish undisturbed.',
          monitoring: 'Check trichome color (cloudy/amber ratio) to time harvest.',
          environment: 'Cooler temperatures in the final days can enhance color and aroma.'
        },
        problems: [
          { issue: 'Nutrient locked leaves at harvest', cause: 'No flush before harvest', solution: 'Flush with plain water for the final 7-10 days' }
        ]
      }
    }
  },

  // Add more plant types...
  [PLANT_TYPES.GENERIC]: {
    name: 'Generic Plant',
    category: 'general',
    lifecycle: 'varies',
    harvestTime: 'varies',
    optimalTemp: { min: 18, max: 24, unit: 'C' },
    optimalHumidity: { min: 50, max: 70 },
    lightRequirement: '12-16 hours',
    phRange: { min: 5.5, max: 6.5 },
    stages: {
      [GROWTH_STAGES.SEEDLING]: {
        heightRange: { min: 0, max: 10 },
        duration: '7-14 days',
        ec: { min: 0.6, max: 1.0 },
        nutrients: {
          nitrogen: 'medium',
          phosphorus: 'medium',
          potassium: 'medium',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'every 2-3 days',
          concentration: 'quarter to half strength',
          details: 'Gentle introduction to nutrients. Focus on establishing healthy root system.'
        },
        care: {
          pruning: 'Minimal pruning. Remove only damaged or dead material.',
          monitoring: 'Monitor for healthy growth patterns. Watch for stress signs.',
          environment: 'Stable, moderate conditions. Avoid extremes in temperature and humidity.'
        }
      },
      [GROWTH_STAGES.VEGETATIVE]: {
        heightRange: { min: 10, max: 50 },
        duration: '14-42 days',
        ec: { min: 1.0, max: 1.8 },
        nutrients: {
          nitrogen: 'high',
          phosphorus: 'medium',
          potassium: 'medium-high',
          calcium: 'medium',
          magnesium: 'medium'
        },
        feeding: {
          frequency: 'daily',
          concentration: 'full strength',
          details: 'Regular feeding schedule. Higher nitrogen for vegetative growth.'
        },
        care: {
          pruning: 'Remove lower yellowing leaves. Shape plant as needed.',
          monitoring: 'Monitor growth rate and overall health. Check for nutrient deficiencies.',
          environment: 'Maintain optimal conditions for the specific plant type.'
        }
      }
    }
  }
};

// Advanced problem diagnosis
export const PROBLEM_DIAGNOSIS = {
  nutrientDeficiencies: {
    nitrogen: {
      symptoms: ['Yellowing older leaves', 'Slow growth', 'Light green color'],
      progression: 'Starts with older leaves, moves upward',
      solution: 'Increase nitrogen in nutrient solution',
      prevention: 'Regular feeding schedule with adequate nitrogen'
    },
    phosphorus: {
      symptoms: ['Purple/red stems and leaves', 'Dark green leaves', 'Slow growth'],
      progression: 'Often starts with purple coloring on stems',
      solution: 'Increase phosphorus, check pH for proper uptake',
      prevention: 'Balanced nutrition with adequate phosphorus'
    },
    potassium: {
      symptoms: ['Brown leaf edges', 'Yellowing between veins', 'Weak stems'],
      progression: 'Leaf margins burn first, spreads inward',
      solution: 'Increase potassium, ensure proper pH',
      prevention: 'Higher potassium during flowering/fruiting'
    }
  }
};

// Environmental recommendations
export const ENVIRONMENTAL_GUIDELINES = {
  lighting: {
    seedling: { hours: '16-18', intensity: 'low', distance: 'close' },
    vegetative: { hours: '18-24', intensity: 'medium-high', distance: 'medium' },
    flowering: { hours: '12', intensity: 'high', distance: 'optimal' }
  },
  temperature: {
    day: { min: 20, max: 26, unit: 'C' },
    night: { min: 16, max: 20, unit: 'C' },
    variance: 'max 4°C difference between day/night'
  },
  humidity: {
    seedling: { min: 70, max: 80 },
    vegetative: { min: 60, max: 70 },
    flowering: { min: 50, max: 60 }
  },
  airflow: {
    gentle: 'Light breeze that barely moves leaves',
    moderate: 'Steady airflow causing gentle leaf movement',
    strong: 'Only during high humidity situations'
  }
};

// Nutrient calculation system
export const NUTRIENT_CALCULATIONS = {
  // Base EC targets for different growth stages
  ecTargets: {
    seedling: { min: 0.6, max: 1.0, optimal: 0.8 },
    early_vegetative: { min: 1.0, max: 1.4, optimal: 1.2 },
    vegetative: { min: 1.4, max: 1.8, optimal: 1.6 },
    pre_flowering: { min: 1.6, max: 2.0, optimal: 1.8 },
    flowering: { min: 1.8, max: 2.4, optimal: 2.1 },
    late_flowering: { min: 1.6, max: 2.2, optimal: 1.9 }
  },

  // PPM targets (EC × 500 for 500 scale, × 700 for 700 scale)
  ppmTargets: {
    seedling: { min: 300, max: 500, optimal: 400 },
    early_vegetative: { min: 500, max: 700, optimal: 600 },
    vegetative: { min: 700, max: 900, optimal: 800 },
    pre_flowering: { min: 800, max: 1000, optimal: 900 },
    flowering: { min: 900, max: 1200, optimal: 1050 },
    late_flowering: { min: 800, max: 1100, optimal: 950 }
  },

  // Nutrient ratios (N-P-K) for different stages
  ratios: {
    seedling: { n: 1, p: 1, k: 1 }, // Balanced
    early_vegetative: { n: 3, p: 1, k: 2 }, // High nitrogen
    vegetative: { n: 3, p: 1, k: 2 }, // High nitrogen
    pre_flowering: { n: 2, p: 2, k: 3 }, // Transition
    flowering: { n: 1, p: 3, k: 4 }, // High P-K
    late_flowering: { n: 1, p: 2, k: 4 } // Very high K
  },

  // Common nutrient solutions (grams per gallon for target EC)
  solutions: {
    masterblend: {
      name: "Masterblend 4-18-38",
      npk: { n: 4, p: 18, k: 38 },
      baseAmount: 2.4, // grams per gallon for EC 1.0
      supplements: {
        calciumNitrate: 2.4, // grams per gallon
        epsom: 1.2 // grams per gallon (magnesium sulfate)
      }
    },
    generalHydroponics: {
      name: "General Hydroponics Flora Series",
      npk: { n: 7, p: 4, k: 10 },
      baseAmount: 1.5, // ml per liter for EC 1.0
      supplements: {
        floraMicro: 1.0,
        floraGro: 1.5,
        floraBloom: 1.0
      }
    },
    hydroponic: {
      name: "Generic Hydroponic Solution",
      npk: { n: 10, p: 10, k: 10 },
      baseAmount: 1.0, // grams per liter for EC 1.0
      supplements: {}
    }
  }
};

// Nutrient calculator class
export class NutrientCalculator {
  constructor(reservoirSize, units = 'liters') {
    this.reservoirSize = parseFloat(reservoirSize);
    this.units = units; // 'liters' or 'gallons'
    this.conversionFactor = units === 'gallons' ? 1 : 0.264172; // liters to gallons
  }

  // Calculate precise nutrient amounts for a growth stage
  calculateNutrients(stage, solution = 'masterblend', targetEC = null) {
    const stageKey = stage.toLowerCase().replace(/[^a-z_]/g, '_');
    const ecTarget = targetEC || NUTRIENT_CALCULATIONS.ecTargets[stageKey]?.optimal || 1.2;
    const ppmTarget = Math.round(ecTarget * 500);
    
    const solutionData = NUTRIENT_CALCULATIONS.solutions[solution];
    if (!solutionData) {
      throw new Error(`Unknown solution type: ${solution}`);
    }

    // Convert reservoir size to gallons if needed
    const gallons = this.units === 'gallons' ? this.reservoirSize : this.reservoirSize * 0.264172;
    const liters = this.units === 'liters' ? this.reservoirSize : this.reservoirSize * 3.78541;

    // Calculate base amounts
    const ecMultiplier = ecTarget / 1.0; // Scale from base EC 1.0
    
    let nutrients = {};

    if (solution === 'masterblend') {
      nutrients = {
        masterblend: {
          amount: Math.round((solutionData.baseAmount * ecMultiplier * gallons) * 10) / 10,
          unit: 'grams'
        },
        calciumNitrate: {
          amount: Math.round((solutionData.supplements.calciumNitrate * ecMultiplier * gallons) * 10) / 10,
          unit: 'grams'
        },
        epsom: {
          amount: Math.round((solutionData.supplements.epsom * ecMultiplier * gallons) * 10) / 10,
          unit: 'grams'
        }
      };
    } else if (solution === 'generalHydroponics') {
      nutrients = {
        floraMicro: {
          amount: Math.round((solutionData.supplements.floraMicro * ecMultiplier * liters) * 10) / 10,
          unit: 'ml'
        },
        floraGro: {
          amount: Math.round((solutionData.supplements.floraGro * ecMultiplier * liters) * 10) / 10,
          unit: 'ml'
        },
        floraBloom: {
          amount: Math.round((solutionData.supplements.floraBloom * ecMultiplier * liters) * 10) / 10,
          unit: 'ml'
        }
      };
    } else {
      nutrients = {
        hydroponicSolution: {
          amount: Math.round((solutionData.baseAmount * ecMultiplier * liters) * 10) / 10,
          unit: 'grams'
        }
      };
    }

    return {
      stage: stage,
      reservoirSize: `${this.reservoirSize} ${this.units}`,
      targetEC: ecTarget,
      targetPPM: ppmTarget,
      solution: solutionData.name,
      nutrients: nutrients,
      instructions: this.generateInstructions(nutrients),
      tips: this.generateTips(stage, ecTarget)
    };
  }

  generateInstructions(nutrients) {
    const instructions = [
      "🧪 **Mixing Instructions:**",
      "1. Fill reservoir with clean water",
      "2. Add nutrients in the following order:"
    ];

    Object.entries(nutrients).forEach(([name, data], index) => {
      const displayName = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      instructions.push(`   ${index + 3}. Add ${data.amount} ${data.unit} of ${displayName}`);
    });

    instructions.push(
      "3. Mix thoroughly and let sit for 30 minutes",
      "4. Test and adjust pH to 5.5-6.5",
      "5. Test EC/PPM to confirm target levels",
      "6. Add water if EC is too high, add nutrients if too low"
    );

    return instructions;
  }

  generateTips(stage, targetEC) {
    const tips = [
      `💡 **${stage} Stage Tips:**`,
      `• Target EC: ${targetEC} (±0.1)`,
      "• Always add nutrients to water, never water to nutrients",
      "• Mix each nutrient completely before adding the next",
      "• Check pH after adding all nutrients",
      "• Monitor EC daily and top off with plain water as needed"
    ];

    if (stage.toLowerCase().includes('seedling')) {
      tips.push("• Start with lower concentrations and increase gradually");
      tips.push("• Young roots are sensitive to high nutrient levels");
    } else if (stage.toLowerCase().includes('vegetative')) {
      tips.push("• Higher nitrogen supports rapid leaf growth");
      tips.push("• Ensure adequate calcium to prevent deficiencies later");
    } else if (stage.toLowerCase().includes('flowering')) {
      tips.push("• Reduce nitrogen to prevent excess vegetative growth");
      tips.push("• High potassium improves fruit size and quality");
    }

    return tips;
  }

  // Calculate nutrient changes for reservoir top-offs
  calculateTopOff(currentVolume, targetVolume, currentEC, targetEC) {
    const volumeToAdd = targetVolume - currentVolume;
    const ecDeficit = targetEC - currentEC;
    
    if (ecDeficit <= 0) {
      return {
        action: 'Add plain water only',
        volume: volumeToAdd,
        nutrients: null,
        reason: 'EC is at or above target'
      };
    }

    // Calculate nutrient concentration needed
    const concentrationMultiplier = (ecDeficit * targetVolume) / volumeToAdd;
    
    return {
      action: 'Add nutrient solution',
      volume: volumeToAdd,
      concentration: `EC ${concentrationMultiplier.toFixed(1)}`,
      reason: `To bring ${currentVolume}L at EC ${currentEC} up to ${targetVolume}L at EC ${targetEC}`
    };
  }
}

// Reservoir size presets
export const RESERVOIR_PRESETS = {
  small: { size: 20, unit: 'liters', description: 'Single plant DWC bucket' },
  medium: { size: 50, unit: 'liters', description: 'Multi-plant system' },
  large: { size: 100, unit: 'liters', description: 'Commercial setup' },
  custom: { size: 0, unit: 'liters', description: 'Enter custom size' }
};

// Popular nutrient brands with mixing ratios
export const NUTRIENT_BRANDS = {
  masterblend: {
    name: "Masterblend 4-18-38 + CalNit + Epsom",
    description: "Popular 3-part dry nutrient system",
    type: "dry",
    ratio: "2.4g : 2.4g : 1.2g per gallon"
  },
  florasSeries: {
    name: "General Hydroponics Flora Series",
    description: "3-part liquid system (Micro, Gro, Bloom)",
    type: "liquid",
    ratio: "Variable based on growth stage"
  },
  maxiBloom: {
    name: "General Hydroponics MaxiBloom",
    description: "One-part powder formula",
    type: "dry",
    ratio: "1-2 tsp per gallon"
  },
  dynagro: {
    name: "Dyna-Gro Grow/Bloom",
    description: "Simple 2-part liquid system",
    type: "liquid",
    ratio: "1-3 ml per liter"
  }
};