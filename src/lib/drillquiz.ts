/* ============================================================
   Shared auto-generated question factory over the command docs.

   Used by TWO screens from the SAME generation rules:
     • the speed drill (timed recognition game)
     • the learning quiz "Auto-generated" source (untimed)

   All question kinds are built from the structured dataset only:
   flag ↔ purpose pairs, command names ↔ summaries. Distractors are
   drawn from real sibling values, so a discriminating eye is all a
   fair taker needs. NOT conceptual — that bank is handwritten in
   src/data/conceptualQuestions.ts and only feeds the quiz.
   ============================================================ */

import type { Command } from '../types';

export type Drill = { prompt: string; tag: string; options: string[]; answer: number };

export type DrillPools = {
  commands: Command[];
  withOptions: Command[];
  allNames: string[];
  allSummaries: string[];
  allFlagDescriptions: string[];
};

export function buildPools(commands: Command[]): DrillPools {
  return {
    commands,
    withOptions: commands.filter((c) => c.options.length >= 2),
    allNames: commands.map((c) => c.name),
    allSummaries: Array.from(new Set(commands.map((c) => c.summary))),
    allFlagDescriptions: Array.from(new Set(commands.flatMap((c) => c.options.map((o) => o.description)))),
  };
}

function randItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Build distinct distractors from a pool, excluding the answer text itself. */
function distractors(pool: string[], answer: string, count: number): string[] {
  const picked = new Set<string>();
  for (let guard = 0; guard < count * 40 && picked.size < count; guard += 1) {
    const candidate = randItem(pool);
    if (candidate && candidate !== answer && !picked.has(candidate)) picked.add(candidate);
  }
  return Array.from(picked);
}

/** options[0] must be the correct answer; it gets shuffled into place here. */
function finalize(prompt: string, tag: string, correctFirst: string[]): Drill {
  const correct = correctFirst[0].replace(/\s+/g, ' ').trim();
  const options = [correct, ...correctFirst.slice(1).map((text) => text.replace(/\s+/g, ' ').trim())].slice(0, 4);
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return { prompt, tag, options: shuffled, answer: shuffled.indexOf(correct) };
}

export function buildQuestion(pools: DrillPools): Drill {
  const kind = randItem(['flag-purpose', 'command-summary', 'summary-command', 'flag-name']);

  if (kind === 'flag-purpose' && pools.withOptions.length > 0) {
    const command = randItem(pools.withOptions);
    const option = randItem(command.options);
    const distractorsFound = distractors(
      pools.allFlagDescriptions.filter((d) => d !== option.description),
      option.description,
      3,
    );
    if (distractorsFound.length === 3) {
      return finalize(`${command.name}, what does ${option.flag} do?`, 'flag · purpose', [option.description, ...distractorsFound]);
    }
  }

  if (kind === 'flag-name' && pools.withOptions.length > 0) {
    const command = randItem(pools.withOptions);
    const option = randItem(command.options);
    const wrongFlags = command.options.filter((o) => o.flag !== option.flag).map((o) => o.flag);
    const otherFlags = distractors(
      pools.withOptions.flatMap((c) => c.options.map((o) => o.flag)).filter((f) => !wrongFlags.includes(f)),
      option.flag,
      3,
    );
    if (otherFlags.length === 3) {
      return finalize(`In ${command.name}, which flag means "${option.description}"?`, 'purpose · flag', [option.flag, ...otherFlags]);
    }
  }

  if (kind === 'summary-command') {
    const command = randItem(pools.commands);
    const others = distractors(
      pools.allNames.filter((n) => n !== command.name),
      command.name,
      3,
    );
    if (others.length === 3) {
      return finalize(`Which command matches: "${command.summary}"`, 'summary · command', [command.name, ...others]);
    }
  }

  /* fallback + 'command-summary' path */
  const command = randItem(pools.commands);
  const others = distractors(
    pools.allSummaries.filter((s) => s !== command.summary),
    command.summary,
    3,
  );
  if (others.length < 3) {
    /* guaranteed-valid shape for the full dataset */
    return finalize(`What does ${command.name} do?`, 'command · summary', [
      command.summary,
      'Reboots the system without confirmation.',
      'Prints the kernel ring buffer.',
      'Renames the current shell session.',
    ]);
  }
  return finalize(`What does ${command.name} do?`, 'command · summary', [command.summary, ...others]);
}
