/* ============================================================
   Conceptual question bank — the "why / when / which angle" tier
   above command recall.

   These questions test mental-model understanding (differences,
   trade-offs, footguns, when-to-pick-what) instead of raw syntax.
   They live alongside each learning path's bank inside the same
   quiz (a source picker on the quiz setup screen selects them)
   and are deliberately NOT part of the speed drill, which stays a
   command-recognition timing game.

   Shape = the LearningPage Question type exactly, so both banks
   flow through the same quiz views and score paths.
   ============================================================ */

export type Question = { q: string; options: string[]; answer: number; difficulty: 'easy' | 'medium' | 'hard' };

export const CONCEPTUAL_QUESTIONS: Record<string, Question[]> = {
  'shell-basics': [
    {
      q: 'Why can `mv` rename a 10 GB file instantly while `cp` takes minutes?',
      options: [
        'mv just rewrites the directory entry (same filesystem); cp must actually duplicate the data',
        'mv runs at kernel level, cp runs in user space',
        'cp verifies the copy with a checksum, which is slow',
        'mv is multi-threaded, cp is single-threaded',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'Which is the main risk of blindly running `rm -rf $VAR/` when VAR might be empty?',
      options: [
        'The shell expands it to `rm -rf /`, deleting everything',
        'rm asks for confirmation, which blocks scripts',
        'Only root can run rm without a path',
        'Trailing slashes make rm fail safely',
      ],
      answer: 0,
      difficulty: 'hard',
    },
    {
      q: 'When is `touch` preferred over `echo >` to start a file?',
      options: [
        'When you want an empty file and must not truncate existing content',
        'When the file belongs to another user',
        'When you are creating a directory instead',
        'Never — the two are identical',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'You script `cd /tmp/backup && rm *.log`. Why is this pattern fragile?',
      options: [
        'If cd fails, rm still runs in the original directory and deletes wrong logs',
        'rm cannot run from a script',
        'Globbing is not allowed after cd',
        'Scripted cd is always ignored by the shell',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'What is the practical difference between a relative and an absolute path in scripts?',
      options: [
        'Relative paths resolve against the current working directory, so they break when scripts run from elsewhere',
        'Absolute paths are faster to resolve',
        'Relative paths are prohibited in cron',
        'Both behave identically for scripts',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'Why do `less` and `head` exist when `cat` also prints a file?',
      options: [
        'cat dumps everything at once — poor for huge logs, paging or seeing just the start',
        'cat is deprecated and unreliable',
        'less and head bypass file permissions',
        'cat cannot read text files',
      ],
      answer: 0,
      difficulty: 'easy',
    },
  ],
  'text-tools': [
    {
      q: 'Why does `grep` beat reading a log file manually when investigating a failure?',
      options: [
        'It filters millions of lines to the matching ones instantly and can be chained into narrower and narrower views',
        'It rewrites the log to remove errors',
        'It automatically restarts the failing service',
        'It searches inside binary attachments only',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'When would you choose `awk` over `grep`?',
      options: [
        'When you need to act on fields/columns of each line, not just filter whole lines',
        'When the input is not text',
        'When you need to count files in a directory',
        'Never — they do the same thing',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'What is the key ordering idea behind `sort | uniq -c`?',
      options: [
        'uniq only collapses ADJACENT duplicates, so sort brings equal lines together first',
        'uniq sorts internally, so the order never matters',
        'sort removes duplicates already',
        'uniq -c sorts its output',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'Why is `cut` usually the wrong tool for splitting text by runs of spaces?',
      options: [
        'cut splits exactly one character (like a single space); repeated spaces create empty fields',
        'cut only works on binary files',
        'cut cannot handle fixed positions',
        'cut ignores the locale, so it fails on text',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'You need lines that match BOTH "error" and "auth". Why chain `grep error | grep auth`?',
      options: [
        'grep lacks a native AND across patterns, so each stage keeps only lines surviving both filters',
        'Chaining is faster because grep caches results',
        'A single grep cannot accept two words',
        'The second grep replaces the log content',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'What changes in a regex when you switch `grep` to `grep -E`?',
      options: [
        'You get extended regex: `+ ? | ()` work directly without backslash escapes',
        'Matching becomes case-insensitive',
        'Binary files are included in the search',
        'Nothing changes at all',
      ],
      answer: 0,
      difficulty: 'hard',
    },
  ],
  'system-networking': [
    {
      q: 'A server "is up" (ping works) but the web app is unreachable. Why does that NOT prove the web stack is fine?',
      options: [
        'ping tests reachability of the host (ICMP), not whether the specific service port is listening — curl the port instead',
        'ping only works on Windows',
        'ICMP proves the HTTP process is healthy',
        'ping measures DNS resolution',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'Why does `ss -tlnp` (or netstat) come before `curl` when a port refuses connections?',
      options: [
        'It shows whether anything is listening on that port first — a missing listener explains an instant refusal without guessing the app',
        'It restarts the listener service',
        'curl cannot be called from scripts',
        'ss measures bandwidth, which curl needs',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'When is `dig`/`nslookup` the right first tool instead of `ping`?',
      options: [
        'When a hostname may be resolving wrongly or to a stale IP — verify the DNS answer first',
        'When you suspect high CPU usage',
        'When you want to transfer a zone file',
        'When the network cable might be unplugged',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'Why does `kill -9` as a first resort hurt?',
      options: [
        'SIGKILL skips the process cleanup handlers — files, sockets and shared state can be left dirty; SIGTERM gives a chance to exit cleanly',
        'kill -9 requires a kernel rebuild',
        'Only PID 1 can send SIGKILL',
        'It does not hurt; it is always the best choice',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'Which pair best answers "is DNS or the routing path broken"?',
      options: [
        'dig +trace for name resolution and traceroute for per-hop routing',
        'whoami and hostname',
        'top and df',
        'crontab and journalctl',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'A colleague runs `traceroute google.com` and many hops show `* * *`. What is the sane interpretation?',
      options: [
        'Intermediate routers may drop ICMP TTL-exceeded replies — only the failing final hop with no echo matters',
        'The internet is down',
        'traceroute must be run as root only',
        'Every * means packet loss at that hop',
      ],
      answer: 0,
      difficulty: 'hard',
    },
  ],
  'security-ctf': [
    {
      q: 'Why hash a password with a salt instead of storing a plain hash?',
      options: [
        'Salts make precomputed tables (rainbow tables) useless and keep equal passwords hashing differently',
        'A salt shortens the stored hash',
        'Hashes fail without a salt',
        'Clients require salts to log in',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'When choosing a tool to crack a captured hash, when does `john` have an edge over `hashcat`?',
      options: [
        'john ships broad hash-format auto-detection and rules-based mangling out of the box; hashcat leans on GPU + explicit formats',
        'john never works on GPUs',
        'hashcat cannot read hash files',
        'They are interchangeable with no trade-offs',
      ],
      answer: 0,
      difficulty: 'hard',
    },
    {
      q: 'Why does `nmap -sV` produce sharper results than a plain `nmap host` scan?',
      options: [
        'Version detection probes open ports to fingerprint software and versions, not just list them',
        'It uses UDP only, which skips firewalls',
        'It scans IPv6 automatically',
        'It disables the OS guessing phase',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'You must stay legal during a pentest engagement. Which control matters most?',
      options: [
        'Written authorization defining scope, timing and rules of engagement before touching any target',
        'Using only free tools',
        'Scanning fast to finish early',
        'Masking your IP with VPNs',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'Why is `strings` the classic first move on an unknown binary?',
      options: [
        'It surfaces printable text — URLs, flags, prompts and library names — without executing the file',
        'It reverses the binary to full source code',
        'It patches the binary safely',
        'It only works on ELF files',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'In web exploitation, why does reading raw `curl` output beat a browser alone?',
      options: [
        'It shows exact headers, redirects and response bodies — stack traces or server banners a rendered page hides',
        'curl bypasses SSL entirely',
        'Browsers cannot send requests',
        'curl is always faster to render JS',
      ],
      answer: 0,
      difficulty: 'medium',
    },
  ],
  'permissions-ownership': [
    {
      q: 'Why is `chmod 777 file` almost always the wrong fix for "permission denied"?',
      options: [
        'It grants write+execute to world — any local user or malware can alter or run it; grants should be minimal',
        'chmod cannot set 777 numerically',
        '777 breaks hard links',
        '777 only affects the owner',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'When does `sudo` fail where you would get a direct `chown` right?',
      options: [
        'When the filesystem is mounted read-only or overseas-restricted (e.g. ro, or user namespace limits) — ownership change must be allowed at that level first',
        'sudo never changes file ownership',
        'chown requires a reboot',
        'Ownership cannot change without uname',
      ],
      answer: 0,
      difficulty: 'hard',
    },
    {
      q: 'How does `umask` differ from `chmod` in practice?',
      options: [
        'umask masks the DEFAULT permission bits at file creation; chmod mutates the bits of an existing file afterwards',
        'umask applies only to directories',
        'chmod persists a shell default',
        'They are aliases of one command',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'You want every user on a shared directory to keep ownership but share the group write. What combination fits?',
      options: [
        'Common group + `chmod g+s` setgid bit on the directory + group-writable bits on contents',
        'chmod 777 on the directory',
        'Giving everyone the same password',
        'A weekly cron that chowns everything',
      ],
      answer: 0,
      difficulty: 'hard',
    },
    {
      q: 'Why does `1` in `755` make a file "likely an executable", not just readable?',
      options: [
        'The execute bit is what allows execve to run it as a program; the other digits grant read/write respectively',
        '7 means hidden-file bit',
        '5 is the inode age',
        'Execute permission is irrelevant to running files',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'A web server can read but not create files in /srv/app. Which diagnosis order makes sense?',
      options: [
        'Check owner/group of the directory and the service user groups first, then adjust grants minimally',
        'Blindly chmod 777 the whole tree',
        'Reinstall the server',
        'Restart the web server repeatedly',
      ],
      answer: 0,
      difficulty: 'easy',
    },
  ],
  'shell-automation': [
    {
      q: 'Why does `[ "$a" = "$b" ]` beat `[ $a = $b ]` when both variables could be empty?',
      options: [
        'Unquoted empties collapse and the test sees too few arguments and errors — quoting keeps both operands real',
        'test is deprecated',
        'The shell re-splits quoted strings',
        'Empty variables auto-error regardless',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'A cron job works interactively but fails at 3am. Which difference explains most such breakages?',
      options: [
        'Cron runs with a minimal environment and different PATH/cwd than your interactive shell',
        'Cron disables shell variables entirely',
        'Cron runs in a container',
        'Cron only supports bash --posix',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'When is `find -exec` preferable to `find | xargs`?',
      options: [
        'Filenames with spaces/newlines: -exec (or xargs -0) avoids the naive whitespace re-splitting of plain xargs',
        'find -exec always runs faster',
        'xargs cannot handle files at all',
        'There is no difference — both break',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'Why does a script borrowed from the web fail with strange characters in `bash`?',
      options: [
        'Windows CRLF line endings leave a stray \\r in commands — dos2unix fixes it',
        'bash lacks math support',
        'Scripts cannot be copy-pasted',
        'The shebang cannot be user-set',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'Why prefer `set -euo pipefail` near the top of production shell scripts?',
      options: [
        'It stops on failed commands, undefined variables and pipe breakages instead of silently continuing',
        'It makes scripts run faster',
        'It enables job control',
        'It logs every command to syslog',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'When should a task move from a shell script to an actual systemd unit or cron entry?',
      options: [
        'When it must run reliably on a schedule or restart with the machine, not just on demand',
        'When the script exceeds ten characters',
        'When loops are needed',
        'Never — scripts are enough forever',
      ],
      answer: 0,
      difficulty: 'hard',
    },
  ],
  'services-logs': [
    {
      q: 'Why is `systemctl status nginx` the right first move on a broken Nginx?',
      options: [
        'It shows whether the unit is active/failed plus fresh journal lines for that unit in one shot',
        'It rewrites the Nginx config',
        'It restarts the service unconditionally',
        'It bypasses systemd entirely',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'Where does service stdout go when systemd owns the service?',
      options: [
        'Into the journal — query it with journalctl -u <unit>',
        'Nowhere, it is discarded',
        'Directly to /tmp',
        'To every logged-in user terminal',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'What does `journalctl -f` give you that `journalctl` alone does not?',
      options: [
        'A live follow of new entries as they arrive — like tail -f, essential while reproducing an issue',
        'Root access to logs',
        'Automatic log rotation',
        'It exports logs to a cloud bucket',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'A service crashes after boot but `systemctl enable` was set. Why might it still be down?',
      options: [
        'Failed units can enter failed state on a dependency — inspect `systemctl status` and its Requires/After chain rather than guessing',
        'enable only preloads the binary',
        'Services never start at boot',
        'The kernel blocks systemd daemons',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'Why filter logs by unit (`journalctl -u`) before grepping the whole journal?',
      options: [
        'It scopes the search to that service — the machine-wide journal mixes all services and would drown the signal',
        'Unit filters are faster on disk',
        'The whole journal is unreadable text',
        'Grepping journals is forbidden',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'After fixing a config, why may starting the service still fail?',
      options: [
        'The unit may need `daemon-reload` (unit files changed) or the config test (nginx -t) may reveal a syntax error — verify, do not guess',
        'Services can only start once',
        'Config is irrelevant to services',
        'systemd caches binaries forever',
      ],
      answer: 0,
      difficulty: 'hard',
    },
  ],
  'secure-ops': [
    {
      q: 'Why does password auth over SSH keep getting disabled on hardened servers?',
      options: [
        'Keys resist brute force; PasswordAuthentication yes leaves the door open to guessing and leak attacks at scale',
        'Passwords are stored in the kernel',
        'SSH keys expire weekly',
        'Clients cannot type passwords',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'What does `firewall-cmd --permanent` change, versus the default command?',
      options: [
        'Without --permanent rules vanish on reboot; permanent entries are loaded only on reload/restart of the daemon',
        'It writes a cron entry',
        'It disables SELinux',
        'It reverts to iptables',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'Why run `apt update` before `apt upgrade`?',
      options: [
        'upgrade installs only versions the package cache already knows — without update it sees nothing newer',
        'update performs the upgrades itself',
        'update clears old packages',
        'They are synonyms with different flags',
      ],
      answer: 0,
      difficulty: 'easy',
    },
    {
      q: 'You must expose one web app with a dynamic reverse proxy for many backends. Which beats manual Nginx config?',
      options: [
        'Caddy — it can fetch its own TLS certificates and has a small, unopinionated config',
        'manually editing resolv.conf',
        'A cron that swaps configs',
        'Changing sshd_config',
      ],
      answer: 0,
      difficulty: 'hard',
    },
    {
      q: 'Why keep `ss` (or netstat) open while a hardened firewall rule set is being tested?',
      options: [
        'It answers whether the port is even bound — mistakes look identical to firewall blocks without that check',
        'It mails failures to admins',
        'It rewrites the firewall for testing',
        'It downloads new rules',
      ],
      answer: 0,
      difficulty: 'medium',
    },
    {
      q: 'What is the operational role of `last` / `who` on an incident?',
      options: [
        'They establish who was logged in and when — the timeline anchor before deeper log digs',
        'They list running services',
        'They block suspicious addresses',
        'They rotate auth logs',
      ],
      answer: 0,
      difficulty: 'easy',
    },
  ],
};
