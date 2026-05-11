import type { FormData, Language, PhotoKey, Photos, PhysiqueImageResult, Report } from './types';
import { translations } from './i18n';

const clamp = (value: number) => Math.max(45, Math.min(96, Math.round(value)));

export function createMockReport(form: FormData, photos: Photos, language: Language): Report {
  const t = translations[language];
  const height = Number(form.height) || 172;
  const weight = Number(form.weight) || 72;
  const experience = experienceScore(form.experience);
  const bmi = weight / Math.pow(height / 100, 2);
  const goalText = form.goal.toLowerCase();
  const isCutting = goalText.includes('cut') || goalText.includes('fat') || form.goal.includes('脂肪') || form.goal.includes('减脂');
  const isPrep = goalText.includes('prep') || form.goal.includes('大会') || form.goal.includes('备赛');
  const base = 68 + Math.min(experience, 8) * 2 - Math.max(0, Math.abs(bmi - 24) * 1.4) + (isPrep ? 3 : 0);

  const scores = {
    overall: clamp(base),
    symmetry: clamp(base + 4),
    muscularity: clamp(base + experience * 1.5),
    conditioning: clamp(base - (bmi > 25 ? 5 : 0) + (isCutting || isPrep ? 3 : 0)),
    taper: clamp(base + 2),
    posing: clamp(base - 7 + (isPrep ? 3 : 0)),
    stage: clamp(base - 10 + (isPrep ? 6 : 0)),
  };

  const calories = Math.round((weight * (isCutting || isPrep ? 28 : 34)) / 10) * 10;

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    form,
    photos,
    scores,
    strongParts: t.mock.strong.slice(0, 3),
    weakParts: t.mock.weak.slice(0, 3),
    priorities: [...t.mock.priorities],
    feedback: t.mock.feedback,
    weeksToGoal: Math.max(6, Math.min(24, Math.round(18 - Math.min(experience, 8) + Math.max(0, bmi - 24)))),
    training: [...t.mock.training],
    cardio: t.mock.cardio,
    calories,
    macros: {
      protein: Math.round(weight * 2.1),
      carbs: Math.round((calories * 0.42) / 4),
      fat: Math.round((calories * 0.24) / 9),
    },
    meals: [...t.mock.meals],
    convenienceFoods: [...t.mock.convenience],
    checkins: [...t.mock.checkins],
  };
}

export function createAiReport(form: FormData, photos: Photos, language: Language, imageResults: Partial<Record<PhotoKey, PhysiqueImageResult>>): Report {
  const baseReport = createMockReport(form, photos, language);
  const front = imageResults.front;
  const side = imageResults.side;
  const back = imageResults.back;
  const source = front ?? side ?? back;
  const aiOverall = source?.overall;
  const trainingRecommendation = source?.trainingRecommendation ?? [];
  const prediction = source?.prediction;
  const mainWeakPoint = aiOverall?.weakestBodyParts?.[0] ?? source?.weakPoints?.[0] ?? baseReport.weakParts[0];
  const mainImprovementCommand =
    aiOverall?.topPriorities?.[0] ?? trainingRecommendation[0]?.focus ?? source?.trainingCommand ?? baseReport.priorities[0];

  if (!aiOverall) {
    return {
      ...baseReport,
      mainWeakPoint,
      mainImprovementCommand,
    };
  }

  return {
    ...baseReport,
    scores: {
      overall: aiOverall.physiqueScore || baseReport.scores.overall,
      symmetry: aiOverall.symmetryScore || baseReport.scores.symmetry,
      muscularity: aiOverall.muscleMassScore || baseReport.scores.muscularity,
      conditioning: aiOverall.conditioningScore || baseReport.scores.conditioning,
      taper: aiOverall.aestheticScore || baseReport.scores.taper,
      posing: baseReport.scores.posing,
      stage: baseReport.scores.stage,
    },
    strongParts: aiOverall.bestBodyParts.length ? aiOverall.bestBodyParts : baseReport.strongParts,
    weakParts: aiOverall.weakestBodyParts.length ? aiOverall.weakestBodyParts : baseReport.weakParts,
    priorities: aiOverall.topPriorities.length ? aiOverall.topPriorities : baseReport.priorities,
    feedback: aiOverall.summary || source?.message || baseReport.feedback,
    aiOverall,
    frontReport: front?.frontReport ?? source?.frontReport,
    sideReport: side?.sideReport ?? source?.sideReport,
    backReport: back?.backReport ?? source?.backReport,
    trainingRecommendation,
    nutritionAdvice: source?.nutritionAdvice,
    prediction,
    mainWeakPoint,
    mainImprovementCommand,
  };
}

function experienceScore(experience: string) {
  const text = experience.toLowerCase();
  if (text.includes('competitor') || experience.includes('競技') || experience.includes('参赛')) return 7;
  if (text.includes('experienced') || text.includes('5+') || experience.includes('5年')) return 6;
  if (text.includes('advanced') || experience.includes('上級') || experience.includes('高级')) return 4;
  if (text.includes('intermediate') || experience.includes('中級') || experience.includes('中级')) return 3;
  if (text.includes('novice') || experience.includes('初級') || experience.includes('新手')) return 2;
  return 1;
}
