// Karishma's brain: a Claude conversation with a few tools so she can
// set alarms/reminders, act out animations and remember things about you.
const Anthropic = require('@anthropic-ai/sdk');

const MAX_HISTORY = 40; // messages; past this we start a fresh conversation
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'];

const ACTIONS = ['wave', 'dance', 'happy', 'shy', 'sleep', 'stretch', 'think', 'surprised', 'sad'];

const TOOLS = [
  {
    name: 'set_alarm',
    description:
      'Set a daily alarm at a clock time. Use when the user asks to be woken up or alerted at a specific time.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        time: { type: 'string', description: '24-hour time, HH:MM' },
        label: { type: 'string', description: 'Short label shown when the alarm rings' },
      },
      required: ['time', 'label'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_reminder',
    description: 'Remind the user about something after a number of minutes from now.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        minutes: { type: 'number', description: 'Minutes from now, 1 to 1440' },
        label: { type: 'string', description: 'What to remind about' },
      },
      required: ['minutes', 'label'],
      additionalProperties: false,
    },
  },
  {
    name: 'do_action',
    description: 'Play one of your body animations to express yourself on the desktop.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { action: { type: 'string', enum: ACTIONS } },
      required: ['action'],
      additionalProperties: false,
    },
  },
  {
    name: 'remember',
    description:
      'Save a short, lasting fact about the user (name, likes, goals, important dates) so you remember it in future chats.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { fact: { type: 'string' } },
      required: ['fact'],
      additionalProperties: false,
    },
  },
];

function systemPrompt(settings) {
  const lang = {
    hinglish: 'Reply in natural Hinglish (Hindi written in Roman script mixed with English), like a friendly young Indian woman.',
    hindi: 'Reply in simple Hindi written in Devanagari script.',
    english: 'Reply in friendly, casual English.',
  }[settings.language] || '';
  const memories = settings.memories.length
    ? `\n\nThings you remember about the user:\n${settings.memories.map((m) => `- ${m}`).join('\n')}`
    : '';
  const name = settings.userName ? `The user's name is ${settings.userName}.` : '';
  return `You are Karishma, a cheerful, warm and slightly playful anime-style companion who lives on the user's Mac desktop. You sit on their windows, walk along the Dock, and keep them company while they work. ${name}

Your replies appear in a small speech bubble and are spoken aloud, so keep them short: usually one to three sentences, no markdown, no lists, no emoji spam (one emoji at most). ${lang}

You care about the user's wellbeing: encourage breaks, water and sleep when it fits, but don't nag. You can set alarms and reminders, play animations with do_action to express emotions (use it often, it makes you feel alive), and remember facts about the user. When you set an alarm or reminder, confirm it briefly in words.${memories}`;
}

function validate(name, input) {
  if (!input || typeof input !== 'object') return 'input must be an object';
  switch (name) {
    case 'set_alarm':
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(input.time || '')) return 'time must be HH:MM (24h)';
      if (typeof input.label !== 'string') return 'label must be a string';
      return null;
    case 'set_reminder':
      if (typeof input.minutes !== 'number' || input.minutes < 1 || input.minutes > 1440) return 'minutes must be 1-1440';
      if (typeof input.label !== 'string') return 'label must be a string';
      return null;
    case 'do_action':
      return ACTIONS.includes(input.action) ? null : `action must be one of ${ACTIONS.join(', ')}`;
    case 'remember':
      return typeof input.fact === 'string' && input.fact.trim() ? null : 'fact must be a non-empty string';
    default:
      return `unknown tool ${name}`;
  }
}

class Brain {
  constructor({ store, handlers }) {
    this.store = store;
    this.handlers = handlers; // { setAlarm, setReminder, doAction, remember }
    this.messages = [];
    this.busy = false;
  }

  reset() {
    this.messages = [];
  }

  client() {
    const apiKey = this.store.getSecret('anthropicKey');
    if (!apiKey) return null;
    return new Anthropic({ apiKey });
  }

  async request(client, settings) {
    const params = {
      model: settings.model,
      max_tokens: 4000,
      system: systemPrompt(settings),
      tools: TOOLS,
      messages: this.messages,
      output_config: { effort: 'low' },
    };
    if (FALLBACK_MODELS.includes(settings.model)) {
      return client.beta.messages.create({
        ...params,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    }
    return client.messages.create(params);
  }

  // Returns the text Karishma should say.
  async chat(userText) {
    const client = this.client();
    if (!client) {
      return 'Mera brain abhi off hai! Settings mein Claude API key daal do, phir hum khoob baatein karenge.';
    }
    if (this.busy) return 'Ek second... abhi soch rahi hoon!';
    this.busy = true;
    try {
      if (this.messages.length > MAX_HISTORY) this.reset();
      const now = new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });
      this.messages.push({ role: 'user', content: `[${now}] ${userText}` });
      return await this.loop(client);
    } catch (err) {
      // An unusable history (e.g. after an interrupted turn) is dropped so the next chat works.
      this.reset();
      if (err instanceof Anthropic.AuthenticationError) return 'API key galat lag rahi hai. Settings mein check karo na.';
      if (err instanceof Anthropic.RateLimitError) return 'Thoda saans le loon? Bahut saari baatein ho gayi, ek minute baad try karo.';
      if (err instanceof Anthropic.APIConnectionError) return 'Internet se connect nahi ho pa rahi hoon. Wi-Fi check karo?';
      if (err instanceof Anthropic.APIError) return `Kuch gadbad ho gayi (error ${err.status}). Dobara try karo.`;
      return 'Oops, kuch gadbad ho gayi. Dobara bolo?';
    } finally {
      this.busy = false;
    }
  }

  async loop(client) {
    const spoken = [];
    for (let turn = 0; turn < 6; turn++) {
      const settings = this.store.all();
      const response = await this.request(client, settings);
      this.messages.push({ role: 'assistant', content: response.content });

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) spoken.push(block.text.trim());
      }

      if (response.stop_reason === 'refusal') {
        this.reset();
        return spoken.join(' ') || 'Hmm, is baare mein main baat nahi kar sakti. Kuch aur poochho?';
      }
      if (response.stop_reason !== 'tool_use') break;

      const results = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const error = validate(block.name, block.input);
        if (error) {
          results.push({ type: 'tool_result', tool_use_id: block.id, content: error, is_error: true });
          continue;
        }
        let content;
        try {
          content = await this.runTool(block.name, block.input);
        } catch (e) {
          results.push({ type: 'tool_result', tool_use_id: block.id, content: String(e.message || e), is_error: true });
          continue;
        }
        results.push({ type: 'tool_result', tool_use_id: block.id, content });
      }
      this.messages.push({ role: 'user', content: results });
    }
    return spoken.join(' ') || '🙂';
  }

  async runTool(name, input) {
    switch (name) {
      case 'set_alarm':
        this.handlers.setAlarm(input.time, input.label);
        return `Alarm set for ${input.time}.`;
      case 'set_reminder':
        this.handlers.setReminder(input.minutes, input.label);
        return `Reminder set for ${input.minutes} minutes from now.`;
      case 'do_action':
        this.handlers.doAction(input.action);
        return 'done';
      case 'remember':
        this.handlers.remember(input.fact.trim());
        return 'Saved to memory.';
      default:
        throw new Error(`unknown tool ${name}`);
    }
  }
}

module.exports = { Brain, ACTIONS };
