const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
/** Invalid imported entries are excluded from runners rather than crashing the workspace. */
export function readDeckData(content?: string): Record<string, any[]> {
  let value: any;
  try { value = JSON.parse(content || '{}'); } catch { return {}; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, any[]> = {};
  const validators: Record<string, (entry: any) => boolean> = {
    cards: entry => text(entry.q) && text(entry.a),
    questions: entry => text(entry.q) && texts(entry.options) && entry.options.length >= 2 && Number.isInteger(entry.correct) && entry.correct >= 0 && entry.correct < entry.options.length,
    pairs: entry => text(entry.a) && text(entry.b),
    seqs: entry => texts(entry.steps) && entry.steps.length >= 2,
    concepts: entry => text(entry.concept) && texts(entry.points),
    items: entry => (text(entry.text) && (typeof entry.answer === 'boolean' || (texts(entry.answers) && entry.answers.length > 0))) || (text(entry.item) && text(entry.cat)),
  };
  for (const [key, valid] of Object.entries(validators)) {
    if (Array.isArray(value[key])) result[key] = value[key].filter((entry: any) => entry && typeof entry === 'object' && valid(entry));
  }
  return result;
}
