import { PLANT_PROFILES, GROWTH_STAGES, PLANT_TYPES } from '../data/plantKnowledge.js';

export class GrowthAnalyzer {
  constructor(plantLogs, plantName) {
    this.logs = plantLogs || [];
    this.plantName = plantName;
    this.plantType = this.detectPlantType(plantName);
    this.profile = PLANT_PROFILES[this.plantType] || PLANT_PROFILES[PLANT_TYPES.GENERIC];
  }

  detectPlantType(plantName) {
    const name = plantName.toLowerCase();
    if (name.includes('tomato')) return PLANT_TYPES.TOMATO;
    if (name.includes('lettuce')) return PLANT_TYPES.LETTUCE;
    if (name.includes('basil')) return PLANT_TYPES.BASIL;
    if (name.includes('pepper')) return PLANT_TYPES.PEPPER;
    if (name.includes('cucumber')) return PLANT_TYPES.CUCUMBER;
    return PLANT_TYPES.GENERIC;
  }

  getCurrentStage() {
    if (!this.logs || this.logs.length === 0) return null;

    const sortedLogs = [...this.logs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const latestLog = sortedLogs[sortedLogs.length - 1];
    const currentHeight = parseFloat(latestLog.height) || 0;
    
    const stages = Object.keys(this.profile.stages);
    
    for (const stageKey of stages) {
      const stage = this.profile.stages[stageKey];
      if (currentHeight >= stage.heightRange.min && currentHeight <= stage.heightRange.max) {
        return {
          stage: stageKey,
          data: stage,
          height: currentHeight,
          progress: this.calculateStageProgress(stage, currentHeight)
        };
      }
    }

    // If height exceeds all ranges, return the last stage
    const lastStageKey = stages[stages.length - 1];
    return {
      stage: lastStageKey,
      data: this.profile.stages[lastStageKey],
      height: currentHeight,
      progress: 100
    };
  }

  calculateStageProgress(stage, currentHeight) {
    const range = stage.heightRange.max - stage.heightRange.min;
    const progress = ((currentHeight - stage.heightRange.min) / range) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  // Return data in the EXACT format your UI expects
  getDetailedRecommendations() {
    const currentStage = this.getCurrentStage();
    if (!currentStage) return null;

    const stageData = currentStage.data;
    const growthMetrics = this.calculateGrowthMetrics();

    // Return in the EXACT format that FeedingSchedule.jsx expects
    return {
      stage: this.formatStageName(currentStage.stage),
      stageColor: this.getStageColor(currentStage.stage),
      currentHeight: currentStage.height,
      daysTracked: growthMetrics.daysTracked,
      growthRate: growthMetrics.growthRate,
      
      // These must be STRINGS, not objects
      feeding: stageData.feeding.details || 'Follow general feeding guidelines',
      pruning: stageData.care.pruning || 'Remove dead or yellowing leaves as needed',
      monitoring: stageData.care.monitoring || 'Monitor daily for healthy growth'
    };
  }

  calculateGrowthMetrics() {
    if (this.logs.length < 2) return { daysTracked: 0, growthRate: 0, totalGrowth: 0 };

    const sortedLogs = [...this.logs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const firstLog = sortedLogs[0];
    const latestLog = sortedLogs[sortedLogs.length - 1];
    
    const daysTracked = Math.ceil((new Date(latestLog.created_at) - new Date(firstLog.created_at)) / (1000 * 60 * 60 * 24));
    const totalGrowth = parseFloat(latestLog.height) - parseFloat(firstLog.height);
    const growthRate = daysTracked > 0 ? totalGrowth / daysTracked : 0;

    return {
      daysTracked: Math.max(daysTracked, 1),
      growthRate: parseFloat(growthRate.toFixed(2)),
      totalGrowth: parseFloat(totalGrowth.toFixed(1))
    };
  }

  formatStageName(stage) {
    switch(stage) {
      case 'seedling': return 'Seedling';
      case 'early_vegetative': return 'Early Vegetative';
      case 'vegetative': return 'Vegetative';
      case 'pre_flowering': return 'Pre-Flowering';
      case 'early_flowering': return 'Early Flowering';
      case 'mid_flowering': return 'Mid Flowering';
      case 'late_flowering': return 'Late Flowering';
      case 'harvest_ready': return 'Harvest Ready';
      default: return 'Unknown';
    }
  }

  getStageColor(stage) {
    switch(stage) {
      case 'seedling': return 'text-green-400';
      case 'early_vegetative': return 'text-blue-400';
      case 'vegetative': return 'text-blue-500';
      case 'pre_flowering': return 'text-yellow-400';
      case 'early_flowering': return 'text-orange-400';
      case 'mid_flowering': return 'text-red-400';
      case 'late_flowering': return 'text-purple-400';
      case 'harvest_ready': return 'text-green-500';
      default: return 'text-gray-400';
    }
  }
}

export default GrowthAnalyzer;