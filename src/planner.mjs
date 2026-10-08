import { readFile } from 'node:fs/promises';

export async function loadActivities() {
  const data = JSON.parse(await readFile(new URL('../data/activities.json', import.meta.url), 'utf8'));
  if (!Array.isArray(data) || data.length === 0) throw new Error('Curated dataset is unavailable.');
  return data;
}

export class InputError extends Error {}

const options = {
  movement: ['any', 'gentle', 'seated'], setting: ['any', 'urban', 'green'], company: ['solo', 'together'],
};

export function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('Send a planner request as an object.');
  if (typeof input.query !== 'string') throw new InputError('Describe what you feel like doing.');
  const query = input.query.trim();
  if (query.length < 3 || query.length > 600) throw new InputError('Use between 3 and 600 characters for your idea.');
  if (!Number.isInteger(input.minutes) || input.minutes < 5 || input.minutes > 60) throw new InputError('Choose a whole number from 5 to 60 minutes.');
  for (const [key, values] of Object.entries(options)) {
    if (!values.includes(input[key])) throw new InputError(`Choose a valid ${key} option.`);
  }
  if (typeof input.daylight !== 'boolean') throw new InputError('Choose whether you have daylight.');
  return { query, minutes: input.minutes, movement: input.movement, setting: input.setting, company: input.company, daylight: input.daylight };
}

// These explicit phrases supplement the form. Embedding similarity is not a
// reliable interpreter of negation; unsupported prose is a preference, not a guarantee.
export function inferRestrictions(query) {
  const q = query.toLowerCase().replace(/[’]/g, "'");
  const seated = /\b(no walking|without walking|can't walk|cannot walk|unable to walk|do not want to walk|don't want to walk|stay seated|remain seated|sitting only|seated only)\b/.test(q);
  const solo = /\b(alone|by myself|on my own|no company|no group|no groups|no companion|no companions|without company|without a companion)\b/.test(q);
  const dark = /\b(at night|after dark|no daylight|without daylight|not daylight|nighttime)\b/.test(q);
  const noGreen = /\b(no parks|no park|without a park|no green space|no green spaces|avoid parks|no garden|no gardens)\b/.test(q);
  const quiet = /\b(quiet|silence|silent|no talking|no socializing|avoid people|no crowds)\b/.test(q);
  return { seated, solo, dark, noGreen, quiet };
}

export function eligibleActivities(activities, input) {
  const restrictions = inferRestrictions(input.query);
  const applied = [];
  if (restrictions.seated) applied.push('Seated only (from your words)');
  if (restrictions.solo) applied.push('Solo (from your words)');
  if (restrictions.dark) applied.push('No daylight required (from your words)');
  if (restrictions.noGreen) applied.push('No green space required (from your words)');
  if (restrictions.quiet) applied.push('Quiet activities (from your words)');
  const eligible = activities.filter(a => {
    if (a.minMinutes > input.minutes) return false;
    if ((input.movement === 'seated' || restrictions.seated) && a.movement !== 'seated') return false;
    if (input.movement === 'gentle' && a.movement === 'active') return false;
    if ((!input.daylight || restrictions.dark) && a.requirements.includes('daylight')) return false;
    if ((input.company === 'solo' || restrictions.solo) && a.requirements.includes('companion')) return false;
    if ((input.setting === 'urban' || restrictions.noGreen) && (a.requirements.includes('green-space') || a.terrain === 'natural')) return false;
    if (input.setting === 'green' && !a.tags.includes('nature') && !a.requirements.includes('green-space')) return false;
    if (restrictions.quiet && a.tags.includes('social')) return false;
    return true;
  });
  return { eligible, restrictions, applied };
}

// A deliberately non-AI mode for interface review and dependency-free testing.
export function fixtureRank(query, candidates) {
  const words = new Set(query.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  return candidates.map((a, index) => {
    const terms = new Set(a.semanticText.toLowerCase().match(/[a-z]{3,}/g) ?? []);
    const overlap = [...words].filter(w => terms.has(w)).length;
    return { id: a.id, score: overlap / Math.max(words.size, 1), index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(({ id, score }) => ({ id, score }));
}

function makePlan(activity, score, input) {
  // Full budget includes selecting a nearby spot and returning; no routing assumptions.
  const outbound = Math.max(1, Math.floor(input.minutes * 0.2));
  const back = Math.max(1, Math.floor(input.minutes * 0.2));
  const observing = input.minutes - outbound - back;
  const durations = [outbound, observing, back];
  const steps = activity.steps.map((step, index) => ({
    title: step.title,
    detail: index === 0
      ? `${step.detail} Use a familiar spot within ${outbound} minute${outbound === 1 ? '' : 's'} of where you start, or stay just outside your door.`
      : index === 2
        ? `${step.detail} Keep these last ${back} minute${back === 1 ? '' : 's'} for wrapping up and returning.`
        : step.detail,
    minutes: durations[index],
  }));
  return {
    id: activity.id, title: activity.title, description: activity.description,
    totalMinutes: input.minutes, steps, takeaway: activity.takeaway,
    tags: activity.tags, equipment: activity.equipment, score: Math.round(score * 1000) / 1000,
    reason: `Fits your ${input.minutes}-minute budget${activity.movement === 'seated' ? ' and can be done seated' : ''}. ${activity.requirements.length ? 'Check the listed conditions before you go.' : 'No special setting is required.'}`,
    requirements: activity.requirements, movement: activity.movement,
  };
}

export async function createPlan(raw, { activities, rank, mode, model }) {
  const input = validateInput(raw);
  const { eligible, restrictions, applied } = eligibleActivities(activities, input);
  if (!eligible.length) throw new InputError('No curated activity fits these options. Try a little more time or change one option.');
  const started = performance.now();
  const ranked = await rank(input.query, eligible);
  const byId = new Map(eligible.map(a => [a.id, a]));
  const valid = ranked.filter(r => byId.has(r.id) && Number.isFinite(r.score));
  if (!valid.length) throw new Error('The ranker did not produce a usable result.');
  const plans = valid.slice(0, 3).map(r => makePlan(byId.get(r.id), r.score, input));
  return {
    mode, model, elapsedMs: Math.round(performance.now() - started),
    plan: plans[0], alternatives: plans.slice(1),
    constraints: { ...input, query: undefined, restrictions, applied, eligibleCount: eligible.length },
    note: mode === 'fixture'
      ? 'Fixture demo: deterministic word matching, no AI inference. Plans come from curated templates.'
      : 'A local embedding model ranks curated activity types. Plans use editorial templates, not generated venue facts. Similarity is not a confidence or safety score.',
  };
}
