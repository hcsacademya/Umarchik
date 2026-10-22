// Butun o'yin uchun umumiy holat (saqlangan ma'lumot)
import { newSave } from '../campaign.ts';
import type { Save } from '../campaign.ts';

export const state: { save: Save } = { save: newSave() };
