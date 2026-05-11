export type Language = 'en' | 'ja' | 'zh';

export type Page = 'landing' | 'upload' | 'report' | 'dashboard';

export type PhotoKey = 'front' | 'side' | 'back';

export type Photos = Record<PhotoKey, string>;

export type PhysiqueImageResult = {
  isPhysiquePhoto: boolean;
  confidence: number;
  photoType: 'front' | 'side' | 'back' | 'unclear' | 'not_human';
  reason: string;
  safeMessage: string;
  imageType: 'physique_photo' | 'text_screenshot' | 'random_object' | 'unclear' | 'non_physique';
  praise: string;
  message: string;
  physiqueSummary: string;
  strongPoints: string[];
  weakPoints: string[];
  trainingCommand: string;
  nextPhotoSuggestion: string;
  canGenerateReport: boolean;
  overall?: AiOverallReport;
  frontReport?: PhotoReport;
  sideReport?: PhotoReport;
  backReport?: PhotoReport;
  trainingRecommendation?: TrainingFocus[];
  nutritionAdvice?: NutritionAdvice;
  prediction?: ProgressPrediction;
  safetyNote?: string;
};

export type AnnotationPosition =
  | 'top-left'
  | 'top-right'
  | 'upper-center'
  | 'middle-left'
  | 'middle-right'
  | 'center'
  | 'lower-center';

export type PhotoAnnotation = {
  label: string;
  comment: string;
  position: AnnotationPosition;
  tone: 'improve' | 'strong' | 'warning';
};

export type PhotoReport = {
  good: string[];
  needsImprovement: string[];
  improveMore: string[];
  coachCommand: string;
  annotations?: PhotoAnnotation[];
};

export type AiOverallReport = {
  physiqueScore: number;
  muscleMassScore: number;
  symmetryScore: number;
  conditioningScore: number;
  aestheticScore: number;
  summary: string;
  bestBodyParts: string[];
  weakestBodyParts: string[];
  topPriorities: string[];
};

export type TrainingFocus = {
  focus: string;
  reason: string;
  exercises: string[];
  weeklyTarget: string;
  sets: string;
  reps: string;
};

export type ProgressPrediction = {
  fourWeeks: string;
  eightWeeks: string;
  twelveWeeks: string;
};

export type NutritionAdvice = {
  calories: string;
  macros: string;
  foodSuggestions: string[];
  notes: string[];
};

export type FormData = {
  age: string;
  gender: string;
  height: string;
  weight: string;
  experience: string;
  goal: string;
  division: string;
  country: string;
  budget: string;
  diet: string;
};

export type Scores = {
  overall: number;
  symmetry: number;
  muscularity: number;
  conditioning: number;
  taper: number;
  posing: number;
  stage: number;
};

export type Report = {
  id: string;
  createdAt: string;
  form: FormData;
  photos: Photos;
  scores: Scores;
  strongParts: string[];
  weakParts: string[];
  priorities: string[];
  feedback: string;
  weeksToGoal: number;
  training: string[];
  cardio: string;
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  meals: string[];
  convenienceFoods: string[];
  checkins: string[];
  aiOverall?: AiOverallReport;
  frontReport?: PhotoReport;
  sideReport?: PhotoReport;
  backReport?: PhotoReport;
  trainingRecommendation?: TrainingFocus[];
  nutritionAdvice?: NutritionAdvice;
  prediction?: ProgressPrediction;
  mainWeakPoint?: string;
  mainImprovementCommand?: string;
};
