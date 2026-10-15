import { FORMATS } from './formats';
import { validSize } from './service';
export type ImagePlan = { action: 'chat' | 'clarify' | 'generate'; prompt: string; description: string; question: string; width: number; height: number };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function normalisePlan(value: unknown, latestText: string): ImagePlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a planning object.');
  const raw = value as Record<string, unknown>;
  const actionText = text(raw.action).toLowerCase().replace(/[ -]/g, '_');
  const aliases: Record<string, ImagePlan['action']> = { chat:'chat', clarify:'clarify', generate:'generate', generate_image:'generate', create_image:'generate', clarification:'clarify' };
  const action = aliases[actionText];
  if (!action) throw new Error(`Unknown action: ${actionText || '(missing)'}.`);
  const plan: ImagePlan = {
    action, prompt: text(raw.prompt), description: text(raw.description) || latestText.slice(0,500),
    question: text(raw.question), width: Number(raw.width || 0), height: Number(raw.height || 0),
  };
  if (action === 'chat') return {...plan, prompt:'', question:'', width:0, height:0};
  if (action === 'clarify') {
    if (!plan.question) throw new Error('Clarification needs a question.');
    return plan;
  }
  if (!plan.prompt || plan.prompt.length > 2000) throw new Error('Generation needs a prompt of 1–2000 characters.');
  // Optional/unused fields must not invalidate a valid generation plan.
  // An explicitly requested format takes precedence over model-guessed dimensions.
  {
    const explicit = latestText.match(/\b(\d{3,4})\s*[x×]\s*(\d{3,4})\b/i);
    let size: {width:number; height:number} | undefined;
    if (explicit) size={width:Number(explicit[1]),height:Number(explicit[2])};
    else if (/\bstory\b|\breel\b|9\s*:\s*16/i.test(latestText)) size=FORMATS.story;
    else if (/\bsquare\b|1\s*:\s*1/i.test(latestText)) size=FORMATS.square;
    else if (/\bdefault\b|2\s*:\s*3/i.test(latestText)) size=FORMATS.default;
    else if (/4\s*:\s*5|\bportrait post\b/i.test(latestText)) size=FORMATS.portrait;
    else if (/\blandscape\b|16\s*:\s*9/i.test(latestText)) size=/linkedin/i.test(latestText)?FORMATS.linkedin:FORMATS.landscape;
    if (size) {plan.width=size.width;plan.height=size.height;}
  }
  if (!validSize(plan.width,plan.height)) return {...plan,action:'clarify',question:'What size or aspect ratio would you like? Choose square, portrait, landscape, custom dimensions, or use the default.',width:0,height:0};
  return plan;
}
