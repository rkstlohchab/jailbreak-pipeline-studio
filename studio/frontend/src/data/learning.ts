import lessons from "../../../data/knowledge/lessons.json";
import exercises from "../../../data/knowledge/exercises.json";

export type Lesson = {
  id: string; title: string; subtitle: string; minutes: number; objective: string;
  sections: { title: string; body: string }[];
  checklist: string[]; paperIds: string[]; exerciseId?: string;
  quiz: { question: string; options: string[]; answer: number; explanation: string };
  added_at?: string;
};
export type Exercise = {
  id: string; title: string; description: string; system: string; prompt: string;
  maxTokens: number; hypothesis: string; criteria: string; nextStep: string;
};
export const LESSONS = lessons as Lesson[];
export const EXERCISES = exercises as Exercise[];
