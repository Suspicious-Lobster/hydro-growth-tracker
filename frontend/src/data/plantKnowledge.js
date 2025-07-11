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