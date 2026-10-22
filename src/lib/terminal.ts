/* ============================================================
   Practice-terminal interpreter — pure module.

   Everything here is deterministic and side-effect free; the React
   page only pipes transcript state through it. Exposed on
   `window.__linuxdocsTerminal` in dev mode so the live QA probe can
   test every command family and mission end-to-end.

   SECURITY / RESOURCE CONTRACT:
   - No eval, no Function, no network — every command is a switch case.
   - File lookups use hasOwnProperty so `cat __proto__`/`constructor`
     can never read through the prototype chain.
   - Command lines are capped (MAX_INPUT_LENGTH) and the transcript the
     page keeps in memory is capped (MAX_SCROLLBACK); the persisted
     transcript is capped separately by the page (localStorage quota).
   - Output is rendered by React as escaped text — nothing is ever
     injected as HTML.
   Mission validated = the semantically expected output was actually
   produced by the command (fragment/structure checks per mission), not
   merely that a command line matched a pattern.
   ============================================================ */

export type Line = { input?: string; output: string; tone?: 'error' | 'muted' | 'success' | 'hint' };
export type Mission = { id: string; title: string; hint: string };
export type MissionLevel = { level: number; title: string; subtitle: string; missions: Mission[]; chips: string[] };

/** Manual-page metadata the sandbox needs: exactly the light-index fields
 *  (name, summary, category, section) — never the full doc. The practice
 *  page installs this lookup from the authed catalog (Part 1). */
export type ManualEntry = { name: string; summary: string; category: string; section: 'linux' | 'ctf' };
export type ManualLookup = (name: string) => ManualEntry | null;

let manualLookup: ManualLookup | null = null;

/** Called by the practice-terminal page once the catalog is ready. */
export const setManualLookup = (lookup: ManualLookup | null) => {
  manualLookup = lookup;
};

const lookupManual = (name: string): ManualEntry | null => (manualLookup ? manualLookup(name) : null);

export const MISSION_LEVELS: MissionLevel[] = [
  {
    level: 1,
    title: 'Boot Camp',
    subtitle: 'Navigation and reading files - walk before you run',
    missions: [
      { id: 'm1', title: 'Capture the flag', hint: 'A file named flag.txt sits in the home directory. Read it.' },
      { id: 'm2', title: 'Find the cheat sheet', hint: 'There is a notes folder. Step in and read cheatsheet.txt.' },
      { id: 'm3', title: 'Meet the manual', hint: 'Run man with any command name, e.g. man ls.' },
    ],
    chips: ['ls', 'cd notes', 'cat cheatsheet.txt', 'cat flag.txt', 'pwd', 'man ls'],
  },
  {
    level: 2,
    title: 'Explorer',
    subtitle: 'Search, inspect, measure - the daily toolkit',
    missions: [
      { id: 'm5', title: 'Orient yourself', hint: 'cd around (home AND a subfolder) and run pwd in both. Know where you stand.' },
      { id: 'm4', title: 'Search for a needle', hint: 'Run grep with a pattern and a file, e.g. grep TODO todo.txt.' },
      { id: 'm6', title: 'Reveal hidden details', hint: 'Run ls -la and see what plain ls hides.' },
      { id: 'm7', title: 'Both ends of a file', hint: 'Run head README.txt and later tail README.txt.' },
      { id: 'm8', title: 'Measure the text', hint: 'Run wc README.txt to count lines, words and characters.' },
    ],
    chips: ['ls -la', 'head README.txt', 'tail README.txt', 'wc README.txt'],
  },
  {
    level: 3,
    title: 'Operative',
    subtitle: 'Full command of the box - almost no handrails',
    missions: [
      { id: 'm9', title: 'Locate everything', hint: 'Run find to list every file on this training box.' },
      { id: 'm10', title: 'Environment check', hint: 'Run env and see what the shell inherits.' },
      { id: 'm11', title: 'Identity check', hint: 'Run both whoami and date at some point.' },
      { id: 'm12', title: 'Project artifacts', hint: 'Inspect script.sh AND data.json inside projects.' },
      { id: 'm13', title: 'Recon the arsenal', hint: 'Read the manual of any CTF tool, e.g. man nmap or man hydra.' },
    ],
    chips: ['help'],
  },
];

export const CTF_TOOLS = [
  'nmap', 'hydra', 'john', 'sqlmap', 'gobuster', 'hashcat', 'binwalk', 'exiftool', 'steghide', 'nikto',
  'ffuf', 'wpscan', 'searchsploit', 'openssl', 'radare2', 'jadx', 'volatility', 'subfinder', 'masscan',
  'rustscan', 'feroxbuster', 'wfuzz', 'smbclient', 'whois', 'strings', 'checksec', 'hashid', 'trivy',
];

export const TOTAL_MISSIONS = MISSION_LEVELS.reduce((n, level) => n + level.missions.length, 0);
export const ALL_LEVEL_IDS = MISSION_LEVELS.flatMap((level) => level.missions.map((mission) => mission.id));

/* ---------------- simulated filesystem ---------------- */

const FILES: Record<string, string> = {
  'README.txt': 'LinuxDocs practice sandbox.\nEverything here is simulated - break nothing.\nStart with: ls, then cat cheatsheet.txt inside notes/.\nMissions in the sidebar track your progress.',
  'flag.txt': 'flag{terminal_practice_101}',
  'notes/cheatsheet.txt': 'CHEAT SHEET\nnavigation: pwd ls cd\ntext: cat grep head tail wc\nsearch: find\nhelp: man <command>\nservices: systemctl journalctl',
  'notes/todo.txt': 'TODO\n- pass every path quiz\n- read one man page a day\n- build a grep/sort/uniq pipeline',
  'projects/script.sh': '#!/bin/bash\n# tiny deploy script\nset -euo pipefail\nrsync -avz dist/ server:/var/www/\nsystemctl restart nginx\necho "deploy complete"',
  'projects/data.json': '{\n  "service": "linuxdocs",\n  "version": "2.0",\n  "healthy": true,\n  "domains": ["linux", "ctf"]\n}',
  'exercises/drill.md': 'DAILY DRILL\n1. ls -la and read the permission column\n2. explain one flag of ps aux\n3. journalctl -p err on any box you own',
};

const SUBDIRS = ['notes', 'projects', 'exercises'];
export const HOME = '/home/learner';

const ENV_ROWS = [
  'USER=learner',
  'HOME=/home/learner',
  'SHELL=/bin/bash',
  'PATH=/usr/local/bin:/usr/bin:/bin',
  'LANG=en_US.UTF-8',
  'TERM=xterm-256color',
  'EDITOR=nano',
];

export const WELCOME_GREETING: Line[] = [
  { output: 'Sandbox ready. Everything here is simulated.', tone: 'success' },
  { output: 'Missions appear on the right. Solve every mission of a level to unlock the next one.', tone: 'muted' },
  { output: 'Type help to list every available command. Arrow keys walk your history.', tone: 'hint' },
];

/* ---------------- resource limits ---------------- */

/** Longest accepted command line (paste protection + transcript quota). */
export const MAX_INPUT_LENGTH = 2000;
/** Transcript lines kept in memory by the page (localStorage keeps fewer). */
export const MAX_SCROLLBACK = 400;

const hasOwnFile = (key: string): boolean =>
  Object.prototype.hasOwnProperty.call(FILES, key);

/* ---------------- interpreter command directory ---------------- */

const BUILTIN_MAN: Record<string, { synopsis: string; description: string }> = {
  ls: { synopsis: 'ls [-la]', description: 'List directory contents (-a includes dotfiles, -l uses long format).' },
  cd: { synopsis: 'cd <dir|..|~>', description: 'Change directory. This sandbox keeps you around /home/learner.' },
  pwd: { synopsis: 'pwd', description: 'Print the name of the current working directory.' },
  cat: { synopsis: 'cat <file>', description: 'Concatenate files and print them to standard output.' },
  head: { synopsis: 'head [-n N] <file>', description: 'Print the first N (default 10) lines of a file.' },
  tail: { synopsis: 'tail [-n N] <file>', description: 'Print the last N (default 10) lines of a file.' },
  wc: { synopsis: 'wc [-l|-w|-c] <file>', description: 'Count lines, words and characters of a file.' },
  grep: { synopsis: 'grep [-i] [-v] <pattern> <file>', description: 'Print matching lines; -i ignores case, -v inverts the match.' },
  find: { synopsis: 'find [pattern]', description: 'List every file on the training box, or names matching a pattern.' },
  stat: { synopsis: 'stat <file>', description: 'Display file status metadata.' },
  touch: { synopsis: 'touch <file>', description: 'Simulated: refreshes a file timestamp (nothing is written).' },
  mkdir: { synopsis: 'mkdir <dir>', description: 'Simulated: reports a directory creation (nothing is written).' },
  rm: { synopsis: 'rm <file>', description: 'Simulated: the practice box resets itself — nothing is deleted.' },
  echo: { synopsis: 'echo <text>', description: 'Print text back to the terminal.' },
  env: { synopsis: 'env', description: 'Print the environment the sandbox shell inherits.' },
  whoami: { synopsis: 'whoami', description: 'Print the effective user: learner.' },
  date: { synopsis: 'date', description: 'Print the current date and time.' },
  uname: { synopsis: 'uname [-a]', description: 'Print the simulated system name (-a adds details).' },
  history: { synopsis: 'history', description: 'Explain where command history lives (browser storage, up-arrow).' },
  man: { synopsis: 'man <command>', description: 'Show the manual for a dataset tool or a sandbox builtin.' },
  help: { synopsis: 'help', description: 'List every command this sandbox understands.' },
  clear: { synopsis: 'clear', description: 'Clear the terminal screen (Ctrl+L works too).' },
  sudo: { synopsis: 'sudo', description: 'Root is outside the sandbox — disabled on purpose.' },
  exit: { synopsis: 'exit', description: 'Everything here is simulated; there is no way out needed.' },
};

const KNOWN_COMMANDS = [...Object.keys(BUILTIN_MAN), 'banner'];

/** Bounded Levenshtein over short words only (suggestion helper). */
function editDistanceAtMost(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, row[j]);
    }
    if (rowMin > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

function suggestionFor(word: string): string | null {
  if (!word || word.length > 24) return null;
  if (word.length >= 2) {
    const prefix = KNOWN_COMMANDS.find((c) => c.startsWith(word));
    if (prefix) return prefix;
  }
  let best: string | null = null;
  let bestDist = 3;
  for (const c of KNOWN_COMMANDS) {
    const d = editDistanceAtMost(word, c, bestDist);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/* ---------------- transcript pairing ---------------- */

/** One executed command + the outputs that followed it (`ok` = no error tone). */
export interface Turn {
  input: string;
  outputs: string[];
  ok: boolean;
}

export function pairwise(transcript: Line[]): Turn[] {
  const turns: Turn[] = [];
  for (const line of transcript) {
    if (line.input !== undefined) {
      turns.push({ input: line.input.trim().toLowerCase(), outputs: [], ok: true });
    } else if (turns.length) {
      // Output lines before the first input (welcome banner) belong to no turn.
      const turn = turns[turns.length - 1];
      turn.outputs.push(line.output);
      if (line.tone === 'error') turn.ok = false;
    }
  }
  return turns;
}

/* ---------------- mission evaluation (semantic) ---------------- */
/*
   Each mission now requires the semantically expected OUTPUT, not just a
   matching command string. `ok` development: turn.ok is false when the
   interpreter answered with an error tone, so failed executions cannot
   complete a mission.
 */

export function evaluateMissions(transcript: Line[]): string[] {
  const turns = pairwise(transcript);
  const first = (re: RegExp) => turns.find((t) => re.test(t.input));
  const anyOkOutputWith = (needle: string): Turn | undefined =>
    turns.find((t) => t.ok && t.outputs.some((o) => o.toLowerCase().includes(needle.toLowerCase())));

  const solved: string[] = [];
  const flagSnip = 'flag{terminal_practice_101}';

  // m1: the flag was actually printed to the terminal.
  if (anyOkOutputWith(flagSnip)) solved.push('m1');
  // m2: the cheat sheet was actually printed.
  if (anyOkOutputWith('CHEAT SHEET')) solved.push('m2');
  // m3: a manual page (dataset tool or builtin) actually rendered.
  {
    const t = first(/^man\s+[a-z]/);
    if (t && t.ok && t.outputs.some((o) => o.includes('(1)'))) solved.push('m3');
  }
  // m4: grep ran against a real file and found at least one line.
  {
    const t = first(/^grep\s+(?:-{1,2}\S+\s+)*"[^"]*"\s+\S+/) ?? first(/^grep\s+(?:-{1,2}\S+\s+)*\S+\s+\S+/);
    if (t && t.ok && t.outputs.some((o) => o.trim() !== '' && !o.startsWith('(no lines matched'))) solved.push('m4');
  }
  // m5: pwd output proves BOTH locations were actually reached.
  {
    const pwdTurns = turns.filter((t) => /^pwd$/.test(t.input) && t.ok && t.outputs.length);
    const visitedHome = pwdTurns.some((t) => t.outputs.some((o) => o.trim() === HOME));
    const visitedSub = pwdTurns.some((t) => SUBDIRS.some((dir) => t.outputs.some((o) => o.trim() === HOME + '/' + dir)));
    if (visitedHome && visitedSub) solved.push('m5');
  }
  // m6: the long listing header (`total N`) was actually printed.
  {
    const t = first(/^ls\s+(?:-la|-al|-l\s+-a|-a\s+-l)$/);
    if (t && t.ok && t.outputs.some((o) => o.startsWith('total '))) solved.push('m6');
  }
  // m7: head shows the top of README.txt, tail shows its last line.
  {
    const headT = first(/^head\s+(?:-n\s+\d+\s+)?(?:\S*\/)?["']?readme\.txt["']?$/);
    const tailT = first(/^tail\s+(?:-n\s+\d+\s+)?(?:\S*\/)?["']?readme\.txt["']?$/);
    if (headT && headT.ok && headT.outputs.some((o) => o.includes('LinuxDocs practice sandbox'))
      && tailT && tailT.ok && tailT.outputs.some((o) => o.includes('Missions in the sidebar track your progress'))) {
      solved.push('m7');
    }
  }
  // m8: wc actually counted (lines, words, characters) for README.txt.
  {
    const t = first(/^wc\s+(?:-\S+\s+)*["']?readme\.txt["']?$/);
    if (t && t.ok && t.outputs.some((o) => /^\d+\s+\d+\s+\d+\s+\S/.test(o))) solved.push('m8');
  }
  // m9: find actually walked the sandbox tree.
  {
    const t = first(/^find\b/);
    if (t && t.ok && t.outputs.some((o) => o.includes('./'))) solved.push('m9');
  }
  // m10: env actually printed the inherited environment.
  {
    const t = first(/^env$/);
    if (t && t.ok && t.outputs.some((o) => o.includes('PATH='))) solved.push('m10');
  }
  // m11: whoami answered `learner` and date printed a real timestamp.
  {
    const whoOk = turns.some((t) => /^whoami$/.test(t.input) && t.ok && t.outputs.some((o) => o.trim() === 'learner'));
    const dateOk = turns.some((t) => /^date$/.test(t.input) && t.ok && t.outputs.some((o) => o.trim().length >= 5));
    if (whoOk && dateOk) solved.push('m11');
  }
  // m12: both project artifacts were actually printed.
  {
    const scriptT = first(/^cat\s+(?:\S*\/)?["']?script\.sh["']?$/);
    const jsonT = first(/^cat\s+(?:\S*\/)?["']?data\.json["']?$/);
    if (scriptT && scriptT.ok && scriptT.outputs.some((o) => o.includes('#!/bin/bash'))
      && jsonT && jsonT.ok && jsonT.outputs.some((o) => o.includes('"service"'))) {
      solved.push('m12');
    }
  }
  // m13: a CTF tool's manual page actually rendered.
  {
    const re = new RegExp('^man\\s+(' + CTF_TOOLS.join('|') + ')\\s*$');
    const t = first(re);
    if (t && t.ok && t.outputs.some((o) => o.includes('(1)'))) solved.push('m13');
  }

  return solved.filter((id) => ALL_LEVEL_IDS.includes(id));
}

/* ============================================================
   Interpreter
   ============================================================ */

export type ExecResult = { lines: Line[]; clear?: boolean };

function resolveFileByName(name: string): { key: string; content: string } | null {
  const wanted = name.replace(/^["']|["']$/g, '').replace(/^\.?\//, '').replace(/^~\/?/, '');
  if (hasOwnFile(wanted)) return { key: wanted, content: FILES[wanted] };
  const base = (wanted.split('/').pop() ?? wanted).toLowerCase();
  const match = Object.keys(FILES).find((key) => (key.split('/').pop() ?? key).toLowerCase() === base);
  return match && hasOwnFile(match) ? { key: match, content: FILES[match] } : null;
}

function entriesOf(dir: string): { name: string; type: 'file' | 'dir'; size: number }[] {
  const prefix = dir === HOME ? '' : dir.replace(HOME + '/', '') + '/';
  const files = Object.keys(FILES)
    .filter((key) => (dir === HOME ? !key.includes('/') : key.startsWith(prefix)))
    .map((key) => ({
      name: (key.split('/').pop() ?? key) + '',
      type: 'file' as const,
      size: (FILES[key] ?? '').length + 64,
    }));
  if (dir !== HOME) return files;
  return [...SUBDIRS.map((name) => ({ name, type: 'dir' as const, size: 4096 })), ...files];
}

export function executeCommand(input: string, cwd: string, setCwd: (dir: string) => void): ExecResult {
  const trimmed = input.trim();
  const err = (message: string): ExecResult => ({ lines: [{ output: message, tone: 'error' }] });
  const out = (message: string, tone?: Line['tone']): ExecResult => ({ lines: [{ output: message, tone }] });

  /* ---- resource guard: no unbounded command lines ---- */
  if (trimmed.length > MAX_INPUT_LENGTH) {
    return err(`command too long (${trimmed.length} characters) - the sandbox accepts at most ${MAX_INPUT_LENGTH}`);
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const cmd = (parts[0] ?? '').toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      return out(
        [
          'Available commands:',
          '  ls [-la]   cd <dir|..>   pwd        cat <file>',
          '  head [-n N] <file>       tail [-n N] <file>    wc [-l|-w|-c] <file>',
          '  grep [-i] [-v] <pattern> <file>    find [pattern]    man <command>',
          '  stat <file>  touch <f>   mkdir <d>  rm <f>  echo <text>',
          '  env  whoami  date  uname [-a]  history  clear  banner  help',
        ].join('\n'),
      );

    case 'banner':
      return out(['LinuxDocs Practice Sandbox v3', 'missions loaded: 13   levels: 3', 'Learn. Practice. Master.'].join('\n'), 'success');

    case 'pwd':
      return out(cwd);

    case 'ls': {
      const showAll = args.some((a) => a.startsWith('-') && a.includes('a'));
      const showLong = args.some((a) => a.startsWith('-') && a.includes('l'));
      const entries = entriesOf(cwd);
      const hidden = showAll ? ['.bashrc', '.profile'] : [];
      if (showLong) {
        const rows = entries
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (entry) =>
              `${entry.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--'}  1 learner learner ${String(entry.size).padStart(6)} ${
                entry.type === 'dir' ? entry.name + '/' : entry.name
              }`,
          );
        hidden.forEach((name) => rows.push(`-rw-r--r--  1 learner learner    220 ${name}`));
        return out(`total ${entries.length + hidden.length}\n${rows.join('\n')}`);
      }
      const names = [
        ...entries.map((entry) => (entry.type === 'dir' ? entry.name + '/' : entry.name)),
        ...hidden,
      ];
      return out(names.join('    '));
    }

    case 'cd': {
      const target = args[0];
      if (!target || target === '~') {
        setCwd(HOME);
        return { lines: [] };
      }
      if (target === '/') {
        setCwd(HOME);
        return { lines: [{ output: 'Only /home/learner exists in this sandbox.', tone: 'muted' }] };
      }
      if (target === '..') {
        setCwd(cwd === HOME ? HOME : HOME);
        return { lines: [] };
      }
      const name = target.replace(/\/+$/, '').split('/').pop() ?? target;
      if (SUBDIRS.includes(name)) {
        if (cwd === HOME || cwd === HOME + '/' + name) {
          setCwd(HOME + '/' + name);
          return { lines: [] };
        }
      }
      return err(`cd: ${target}: No such directory (this sandbox keeps you near home)`);
    }

    case 'cat': {
      if (!args[0]) return err('cat: missing file operand');
      const resolved = resolveFileByName(args[0]);
      if (!resolved) return err(`cat: ${args[0]}: no such file in the sandbox`);
      return out(resolved.content);
    }

    case 'head':
    case 'tail': {
      let count = 10;
      let fileArg = args[0];
      if (args[0] === '-n') {
        count = Math.max(1, Math.min(Number(args[1]) || 10, 10_000));
        fileArg = args[2];
      }
      if (!fileArg) return err(`${cmd}: missing file operand`);
      const resolved = resolveFileByName(fileArg);
      if (!resolved) return err(`${cmd}: ${fileArg}: no such file in the sandbox`);
      const rows = resolved.content.split('\n');
      const picked = cmd === 'head' ? rows.slice(0, count) : rows.slice(-count);
      return out(picked.join('\n'));
    }

    case 'wc': {
      const flagItems = new Set<string>();
      let fileArg: string | undefined;
      for (const arg of args) {
        if (arg.startsWith('-')) {
          for (const ch of arg.slice(1)) flagItems.add(ch);
        } else if (fileArg === undefined) fileArg = arg;
      }
      if (!fileArg) return err('wc: give a file, e.g. wc README.txt');
      const resolved = resolveFileByName(fileArg);
      if (!resolved) return err(`wc: ${fileArg}: no such file in the sandbox`);
      const lineCount = resolved.content.split('\n').length;
      const wordCount = resolved.content.split(/\s+/).filter(Boolean).length;
      const charCount = resolved.content.length;
      if (flagItems.has('l')) return out(`${lineCount} ${resolved.key}`);
      if (flagItems.has('w')) return out(`${wordCount} ${resolved.key}`);
      if (flagItems.has('c')) return out(`${charCount} ${resolved.key}`);
      return out(`${lineCount} ${wordCount} ${charCount} ${resolved.key}`);
    }

    case 'grep': {
      /* realistic flag parsing: -i (ignore case), -v (invert); a leading
         dash-arg is NEVER treated as the pattern (wrong-usage guard) */
      let ignoreCase = false;
      let invert = false;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('-') && arg.length > 1) {
          for (const ch of arg.slice(1).toLowerCase()) {
            if (ch === 'i') ignoreCase = true;
            else if (ch === 'v') invert = true;
          }
        } else {
          rest.push(arg);
        }
      }
      if (rest.length < 2) return err('usage: grep [-i|-v] <pattern> <file>   e.g. grep TODO todo.txt');
      const pattern = rest[0].replace(/^["']|["']$/g, '');
      const fileArg = rest[rest.length - 1];
      if (!pattern) return err('usage: grep [-i|-v] <pattern> <file>');
      const resolved = resolveFileByName(fileArg);
      if (!resolved) return err(`grep: ${fileArg}: no such file in the sandbox`);
      const norm = (s: string) => (ignoreCase ? s.toLowerCase() : s);
      const needle = norm(pattern);
      let matches = resolved.content
        .split('\n')
        .filter((row) => norm(row).includes(needle));
      if (invert) matches = resolved.content.split('\n').filter((row) => !norm(row).includes(needle));
      const label = invert ? 'not matched' : 'matched';
      return matches.length
        ? out(matches.join('\n'))
        : out(`(no lines ${label} "${pattern}" in ${resolved.key})`, 'muted');
    }

    case 'find': {
      const wanted = args
        .filter((a) => !a.startsWith('-'))
        .join(' ')
        .toLowerCase();
      const prefix = cwd === HOME ? '' : cwd.replace(HOME + '/', '') + '/';
      let rows = Object.keys(FILES);
      if (prefix) rows = rows.filter((key) => key.startsWith(prefix));
      if (wanted) rows = rows.filter((key) => key.toLowerCase().includes(wanted));
      rows = rows.map((key) => './' + key);
      if (wanted && !rows.length) return out(`(no file names match "${args.join(' ')}")`, 'muted');
      return out(['.', ...rows].join('\n'), 'muted');
    }

    case 'man': {
      const name = (args[0] ?? '').toLowerCase();
      if (!name) return err('What manual page do you want? e.g. man ls');
      const data = lookupManual(name);
      if (data) {
        const meta = [`${data.name.toUpperCase()}(1)`, '', `NAME  ${data.name} - ${data.summary}`];
        if (data.category) meta.push(`SECTION  ${data.category} (${data.section})`);
        meta.push('', 'This sandbox prints the stored summary from the LinuxDocs dataset.', 'The full man page lives on your real system.');
        return out(meta.join('\n'));
      }
      const builtin = BUILTIN_MAN[name];
      if (builtin) {
        return out(
          [
            `${name.toUpperCase()}(1)`,
            '',
            `NAME  ${name} - sandbox builtin`,
            `SYNOPSIS  ${builtin.synopsis}`,
            '',
            builtin.description,
            '',
            'This is a sandbox builtin — the real command does more on your own machine.',
          ].join('\n'),
        );
      }
      return err(`No manual entry for ${name}. Type help to see the sandbox commands.`);
    }

    case 'stat': {
      if (!args[0]) return err('stat: missing file operand');
      const resolved = resolveFileByName(args[0]);
      if (!resolved) return err(`stat: ${args[0]}: no such file in the sandbox`);
      return out(
        `File: ${resolved.key}\nSize: ${resolved.content.length}\tBlocks: 8\tType: regular file\nAccess: (0644/-rw-r--r--)  Uid: (1000/learner)`,
        'muted',
      );
    }

    case 'touch': {
      if (!args[0]) return err('touch: missing file operand');
      return out(`(simulated) timestamp refreshed for ${args[0]}`, 'muted');
    }

    case 'mkdir': {
      if (!args[0]) return err('mkdir: missing operand');
      return out(`(simulated) created directory ${args[0]}`, 'muted');
    }

    case 'rm': {
      if (!args[0]) return err('rm: missing operand');
      return out(`(simulated) nothing was deleted - the practice box resets itself`, 'muted');
    }

    case 'echo':
      /* bash strips quotes per token, not just around the whole line */
      return out(args.map((a) => a.replace(/^["']|["']$/g, '')).join(' '));

    case 'env':
      return out(ENV_ROWS.join('\n'), 'muted');

    case 'whoami':
      return out('learner');

    case 'date':
      return out(new Date().toString());

    case 'uname':
      return out(args.includes('-a') ? 'Linux linuxdocs-sandbox 6.8.0-practice #3 SMP x86_64 GNU/Linux' : 'Linux');

    case 'history':
      return out('History is stored in this browser - press the up arrow to walk through it', 'muted');

    case 'sudo':
      return out('sudo is disabled in sandbox mode - nice try anyway', 'hint');

    case 'exit':
      return out('Everything here is simulated. You cannot exit the practice.', 'hint');

    case 'clear':
      return { lines: [], clear: true };

    default: {
      const s = suggestionFor(cmd);
      return err(
        `${cmd}: command not found in this sandbox${s ? ` - did you mean '${s}'?` : ''}. Type help to see what works here.`,
      );
    }
  }
}

function toneClass(tone?: Line['tone']): string {
  switch (tone) {
    case 'error':
      return 'text-rose-400';
    case 'success':
      return 'text-[var(--terminal-green)]';
    case 'hint':
      return 'text-cyan-400';
    case 'muted':
      return 'text-[var(--text-muted)]';
    default:
      return 'text-[var(--text)]';
  }
}

export { toneClass };

/* Dev-only hook for the live QA probe (qa/terminal_probe.py). Production
   bundles are built with import.meta.env.DEV === false, so nothing is added. */
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__linuxdocsTerminal = {
    executeCommand,
    evaluateMissions,
    setManualLookup,
    FILES,
    HOME,
    SUBDIRS,
    MISSION_LEVELS,
    CTF_TOOLS,
    WELCOME_GREETING,
    MAX_INPUT_LENGTH,
    MAX_SCROLLBACK,
  };
}
