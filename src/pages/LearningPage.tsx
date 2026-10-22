/* eslint-disable */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, CheckCircle2, ChevronRight, Circle, Code2, Globe, GraduationCap,
  KeyRound, Lock, RotateCcw, ScrollText, Server, Shield, Sparkles, Target, Terminal, Trophy, Wrench, Workflow,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCatalog, getPathForLight } from '../context/CatalogContext';
import { readStreak } from '../lib/streak';

/* ============================================================
   Learning system: two stages, 8 paths.
   Stage 1 (Foundations) is always unlocked. Stage 2 (Advanced Ops)
   unlocks the moment every Stage 1 path is completed.
   ============================================================ */

type Difficulty = 'easy' | 'medium' | 'hard';
type Question = { q: string; options: string[]; answer: number; difficulty: Difficulty };
type Lesson = { title: string; intro: string; bullets: string[]; commands: string[] };
type LearningPath = {
  id: string;
  title: string;
  tagline: string;
  difficulty: string;
  stage: 1 | 2;
  icon: LucideIcon;
  color: string;
  lessons: Lesson[];
  questions: Question[];
};

type PathProgress = {
  completed: boolean;
  bestScore: number;
  bestTotal: number;
  lessons: string[];
};
type Progress = Record<string, PathProgress>;

const STORAGE_KEY = 'linuxdocs.learning-progress-v3';
const MAX_QUESTIONS = 10; // strict cap for every quiz
const PASS_THRESHOLD = 70;

/* ---------------- Stage 1 paths ---------------- */

const shellBasics: LearningPath = {
  id: 'shell-basics',
  title: 'Shell Basics',
  tagline: 'Walk, look, create, move, delete. The commands you use every single day.',
  difficulty: 'Beginner',
  stage: 1,
  icon: Terminal,
  color: '#22c55e',
  lessons: [
    {
      title: 'Where am I? Navigating the filesystem',
      intro: 'Everything starts with knowing where you stand and what is around you.',
      bullets: [
        'pwd prints the absolute path of your current directory.',
        'ls lists what is in it; ls -a also reveals hidden dotfiles, ls -l adds sizes and permissions.',
        'cd changes directory: cd notes goes deeper, cd .. goes up, plain cd jumps home.',
        'tree shows the whole folder structure as a diagram, find walks it programmatically.',
      ],
      commands: ['pwd', 'ls', 'cd', 'tree', 'find'],
    },
    {
      title: 'Creating, copying, moving, deleting',
      intro: 'The four verbs of file management.',
      bullets: [
        'touch creates an empty file or refreshes an existing one; mkdir makes directories (mkdir -p a/b/c builds nested paths).',
        'cp copies, cp -r copies directories. mv moves and renames in one step.',
        'rm deletes files permanently - there is no recycle bin; rm -r removes a directory with its contents.',
        'ln -s target linkname creates a symbolic link, a shortcut pointing at the target.',
      ],
      commands: ['touch', 'mkdir', 'cp', 'mv', 'rm', 'ln'],
    },
    {
      title: 'Reading things and getting help',
      intro: 'Never leave the terminal to look something up again.',
      bullets: [
        'cat dumps a whole file; less pages through it interactively.',
        'head shows the first lines, tail the last lines - both accept -n to set how many.',
        'file report.dat tells you the type of an unknown file; stat shows size, timestamps and permissions.',
        ' man <command> is the built-in manual; history lists the commands you already ran.',
      ],
      commands: ['cat', 'less', 'head', 'tail', 'file', 'stat', 'man', 'history'],
    },
  ],
  questions: [
    { q: 'Which command prints the full path of the directory you are currently in?', options: ['pwd', 'ls', 'cd', 'whoami'], answer: 0, difficulty: 'easy' },
    { q: 'Which command lists the files in the current directory?', options: ['echo', 'ls', 'mkdir', 'man'], answer: 1, difficulty: 'easy' },
    { q: 'How do you create a new empty file called notes.txt?', options: ['mkdir notes.txt', 'cp notes.txt', 'touch notes.txt', 'cat notes.txt'], answer: 2, difficulty: 'easy' },
    { q: 'Which command deletes a file permanently?', options: ['mv', 'rmdir', 'rm', 'trash'], answer: 2, difficulty: 'easy' },
    { q: 'What does `man ls` display?', options: ['The manual page for ls', 'A list of all commands', 'The ls folder', 'Nothing, it is invalid'], answer: 0, difficulty: 'easy' },
    { q: 'Which command copies a file?', options: ['mv', 'cp', 'rm', 'ln'], answer: 1, difficulty: 'easy' },
    { q: 'What does `whoami` print?', options: ['Your home directory', 'Your current username', 'The kernel version', 'The active shell'], answer: 1, difficulty: 'easy' },
    { q: 'Which single command both moves and renames a file?', options: ['cp', 'mv', 'touch', 'edit'], answer: 1, difficulty: 'easy' },
    { q: 'What does `echo Hello` do?', options: ['Creates a file named Hello', 'Prints Hello to the terminal', 'Echoes the last command', 'Starts a function called Hello'], answer: 1, difficulty: 'easy' },
    { q: 'Which command creates a new directory?', options: ['touch', 'mkdir', 'cd', 'ls'], answer: 1, difficulty: 'easy' },
    { q: 'What does `cp file1 /tmp` do when /tmp is an existing directory?', options: ['Merges into the /tmp entry and errors', 'Copies file1 into /tmp keeping the name file1', 'Renames /tmp to file1', 'Concatenates file1 onto every /tmp file'], answer: 1, difficulty: 'medium' },
    { q: 'What does running `touch existing.txt` on an already existing file do?', options: ['Deletes it', 'Errors and refuses', 'Updates its modification timestamp, content stays', 'Truncates it to zero bytes'], answer: 2, difficulty: 'medium' },
    { q: 'What does `rm -r projects` do that plain `rm projects` cannot?', options: ['Deletes read-only files only', 'Removes a directory and everything inside it', 'Moves projects to the trash', 'Requests a confirmation prompt'], answer: 1, difficulty: 'medium' },
    { q: 'Which command shows the first 15 lines of a file?', options: ['tail -n 15 file.txt', 'head -n 15 file.txt', 'cat -n 15 file.txt', 'less 15 file.txt'], answer: 1, difficulty: 'medium' },
    { q: 'What is the difference between `ls` and `ls -a`?', options: ['-a sorts alphabetically', '-a shows hidden dotfiles like .bashrc too', '-a shows file sizes', 'There is no difference'], answer: 1, difficulty: 'medium' },
    { q: 'After running `mkdir -p a/b/c`, what has been created?', options: ['Three sibling folders', 'The full nested path a/b/c including missing parents', 'Only folder c', 'A file named a/b/c'], answer: 1, difficulty: 'medium' },
    { q: 'In `ls -l` output the first character of -rw-r--r-- is a hyphen. What does it mean?', options: ['The file is empty', 'It is a regular file, not a directory', 'No read permission', 'The file is hidden'], answer: 1, difficulty: 'hard' },
    { q: 'What does running `cd` with no arguments do?', options: ['Stays in place with an error', 'Changes to your home directory', 'Changes to /', 'Opens a directory picker'], answer: 1, difficulty: 'hard' },
    { q: 'Why does `*.txt` not match a hidden file named .secret.txt?', options: ['Globbing skips dotfiles; use ls -a style listing or name it explicitly', 'Globbing only matches folders', 'Hidden files cannot exist', '* means one character'], answer: 0, difficulty: 'hard' },
    { q: 'In `find /var -name "*.log" 2>/dev/null`, what does the trailing part do?', options: ['Silently discards permission-denied error messages', 'Runs the find twice', 'Logs results to dev/log', 'Narrows the search to /dev'], answer: 0, difficulty: 'hard' },
    { q: 'What does `ln -s target linkname` create?', options: ['A hard copy of target', 'A symbolic link pointing at target', 'A backup of target', 'An archive of both files'], answer: 1, difficulty: 'hard' },
    { q: 'Which command reveals the type of an unknown file rather than its content?', options: ['cat', 'file', 'stat only', 'echo'], answer: 1, difficulty: 'hard' },
  ],
};

const textTools: LearningPath = {
  id: 'text-tools',
  title: 'Text Processing',
  tagline: 'Search, filter, reshape and rewrite text like a professional pipeline builder.',
  difficulty: 'Beginner',
  stage: 1,
  icon: Code2,
  color: '#38bdf8',
  lessons: [
    {
      title: 'Finding matching lines',
      intro: 'grep is the single most-used filter on any Linux box.',
      bullets: [
        'grep pattern file prints every line containing the pattern; -i ignores case, -n adds line numbers.',
        ' grep -c counts matching lines, grep -v inverts the match, grep -r searches a whole folder.',
        ' Exit code matters in scripts: 0 if a match was found, 1 if not - that is why grep drives if-conditions.',
      ],
      commands: ['grep', 'less'],
    },
    {
      title: 'Slicing columns and fields',
      intro: 'Structured text does not need to be scary.',
      bullets: [
        'cut -d, -f2 file.csv prints the second comma-separated field.',
        'awk "{print $1, $NF}" treats each line as fields and can compute; -F: switches the field separator.',
        'sort sorts lines, sort -n numerically, sort -u deletes duplicates in the same step.',
        'uniq collapses consecutive duplicates - it needs sorted input, which is why sort | uniq is a pair.',
      ],
      commands: ['cut', 'awk', 'sort', 'uniq', 'tr'],
    },
    {
      title: 'Rewriting text in place',
      intro: 'sed, tr and the JSON specialist.',
      bullets: [
        'sed "s/foo/bar/" replaces the first foo per line; append g to replace every match, -i edits the file in place.',
        'tr a-z A-Z uppercases, tr -d "\\r" deletes characters entirely.',
        ' jq .key parses JSON and extracts values, formatting pretty output by default.',
        'diff old new shows exactly which lines differ between two files.',
      ],
      commands: ['sed', 'tr', 'jq', 'diff', 'nano'],
    },
  ],
  questions: [
    { q: 'Which command searches a file for lines containing a word?', options: ['cut', 'grep', 'sort', 'head'], answer: 1, difficulty: 'easy' },
    { q: 'What does `wc -l notes.md` print?', options: ['The word count', 'The byte count', 'The number of lines', 'The longest line'], answer: 2, difficulty: 'easy' },
    { q: 'How do you open notes.md in the nano editor?', options: ['edit notes.md', 'nano notes.md', 'cat notes.md', 'open notes.md'], answer: 1, difficulty: 'easy' },
    { q: 'What does `head -n 5 access.log` show?', options: ['The last five lines', 'The first five lines', 'Five matching lines', 'Log level five'], answer: 1, difficulty: 'easy' },
    { q: 'Which command sorts the lines of names.txt alphabetically?', options: ['uniq names.txt', 'order names.txt', 'sort names.txt', 'cut names.txt'], answer: 2, difficulty: 'easy' },
    { q: 'What does uniq require to collapse duplicates?', options: ['Read permission', 'Sorted input', 'Binary files', 'No arguments'], answer: 1, difficulty: 'easy' },
    { q: 'Which command prints just the second column of a CSV file?', options: ['cut -d, -f2 data.csv', 'grep 2 data.csv', 'awk 2 data.csv', 'head 2 data.csv'], answer: 0, difficulty: 'easy' },
    { q: 'What does `tr a-z A-Z` do to text piped through it?', options: ['Deletes lowercase letters', 'Converts lowercase to uppercase', 'Translates file names', 'Switches encodings'], answer: 1, difficulty: 'easy' },
    { q: 'Which tool extracts values from a JSON file?', options: ['jq', 'awk', 'cut', 'grep only'], answer: 0, difficulty: 'easy' },
    { q: 'What does `diff old.txt new.txt` display?', options: ['File sizes', 'Checksums', 'The differing lines between the files', 'The common lines'], answer: 2, difficulty: 'easy' },
    { q: 'In `sed "s/error/ERROR/"`, how many matches change without the g flag?', options: ['Every match everywhere', 'Only the first match on each line', 'Nothing, g is required', 'Only the first line of the file'], answer: 1, difficulty: 'medium' },
    { q: 'What does `sort -n numbers.txt` do that plain sort does not?', options: ['Deletes duplicates', 'Orders numerically instead of lexicographically', 'Sorts by file name', 'Reverses the order'], answer: 1, difficulty: 'medium' },
    { q: 'Which grep option prints a count of matching lines instead of the lines themselves?', options: ['-n', '-v', '-c', '-r'], answer: 2, difficulty: 'medium' },
    { q: 'sorted.txt is sorted. What does `uniq -u sorted.txt` output?', options: ['Every line once', 'Lines that appear exactly once', 'Duplicate lines only', 'A count per line'], answer: 1, difficulty: 'medium' },
    { q: 'What does `cut -d: -f1 /etc/passwd` return?', options: ['Passwords, the last field', 'Usernames, the first colon-separated field', 'The whole lines unchanged', 'The number of users'], answer: 1, difficulty: 'medium' },
    { q: 'Which sed flag writes edits back into the file itself?', options: ['-g', '-i (in place)', '-w', '-f'], answer: 1, difficulty: 'medium' },
    { q: 'What does `grep -v root /etc/passwd` show?', options: ['Lines containing root', 'Every line EXCEPT lines containing root', 'Only the root line', 'A version string'], answer: 1, difficulty: 'hard' },
    { q: 'In awk, what does `{print $1, $NF}` output per line?', options: ['First and last field', 'First line only', 'All fields numbered', 'The field separator'], answer: 0, difficulty: 'hard' },
    { q: 'Which grep pattern matches error, Error and ERROR at once?', options: ['grep error*', 'grep -E "[eE][Rr][Rr][Oo][Rr]" style bracket classes - e.g. grep -i error is simpler', 'grep %ERROR', 'grep &error'], answer: 1, difficulty: 'hard' },
    { q: 'What does `tr -d "\\r" < file` accomplish?', options: ['Deletes empty lines', 'Removes carriage returns from Windows line endings', 'Renames the file', 'Reverses each line'], answer: 1, difficulty: 'hard' },
    { q: 'In `sort -t: -k3 -n /etc/passwd`, what orders the output?', options: ['The line length', 'The numeric third colon-separated field (the UID)', 'The file modification time', 'The field separator choice alone'], answer: 1, difficulty: 'hard' },
    { q: 'What does the number prefix added by `uniq -c` mean?', options: ['The column width', 'How many consecutive duplicate lines were collapsed into one', 'The line number', 'The byte count'], answer: 1, difficulty: 'hard' },
  ],
};

const systemNetworking: LearningPath = {
  id: 'system-networking',
  title: 'System & Networking',
  tagline: 'Processes, packages, disks, interfaces - take control of a running machine.',
  difficulty: 'Intermediate',
  stage: 1,
  icon: Server,
  color: '#a78bfa',
  lessons: [
    {
      title: 'Watching and managing processes',
      intro: 'Every running command is a process with an ID you can inspect and stop.',
      bullets: [
        'ps aux lists every running process with CPU and memory usage; top shows the same live.',
        'kill PID asks a process to stop (SIGTERM); kill -9 forces it (SIGKILL).',
        'pkill name matches processes by name, no PID lookup needed.',
        'htop offers an interactive view - filter, sort and kill from one screen.',
      ],
      commands: ['ps', 'top', 'kill', 'pkill', 'htop'],
    },
    {
      title: 'Disks, packages and the kernel',
      intro: 'Where the space goes and where the software comes from.',
      bullets: [
        'df -h shows free and used space per filesystem; du -sh dir totals a directory size.',
        'apt install curl installs packages from the distribution repositories.',
        'uname -a prints the kernel release and architecture.',
        'free -h reports RAM usage, including cache that Linux borrows back when needed.',
      ],
      commands: ['df', 'du', 'apt', 'uname', 'free'],
    },
    {
      title: 'Interfaces and connections',
      intro: 'Seeing the network from the command line.',
      bullets: [
        'ip addr lists interfaces and their addresses - the modern replacement for ifconfig.',
        'ping checks reachability and latency; Ctrl+C stops it.',
        'ss -t lists TCP sockets, ss -tuln shows everything listening on a port.',
        'curl and wget move data over HTTP(S): curl prints, wget saves.',
      ],
      commands: ['ip', 'ping', 'ss', 'curl', 'wget'],
    },
  ],
  questions: [
    { q: 'Which command checks whether a host is reachable over the network?', options: ['ping', 'curl', 'top', 'df'], answer: 0, difficulty: 'easy' },
    { q: 'What does `df -h` tell you?', options: ['Directory sizes', 'Free and used disk space per filesystem', 'File fragmentation', 'Disk temperature'], answer: 1, difficulty: 'easy' },
    { q: 'Which command shows network interfaces and their IP addresses?', options: ['ip addr', 'iwconfig', 'netcat', 'ss -s'], answer: 0, difficulty: 'easy' },
    { q: 'What does `ps aux` list?', options: ['Users logged in', 'Running processes with details', 'Auxiliary devices', 'Boot messages'], answer: 1, difficulty: 'easy' },
    { q: 'Which command downloads a file over HTTP?', options: ['cp http://...', 'wget URL', 'ftp URL', 'mv URL'], answer: 1, difficulty: 'easy' },
    { q: 'What does `uname -a` print?', options: ['Your username', 'Kernel version, architecture and system info', 'Network names', 'Uptime only'], answer: 1, difficulty: 'easy' },
    { q: 'Which command inspects open network sockets?', options: ['ss', 'top', 'df', 'env'], answer: 0, difficulty: 'easy' },
    { q: 'What does `apt install curl` do?', options: ['Downloads curl source code', 'Installs the curl package from the repositories', 'Upgrades the whole system', 'Runs curl help'], answer: 1, difficulty: 'easy' },
    { q: 'Which command stops a running process by its PID?', options: ['kill', 'end', 'halt', 'exit'], answer: 0, difficulty: 'easy' },
    { q: 'What does `du -sh /var/log` show?', options: ['Every file one by one', 'Total size of the directory in human-readable form', 'Disk free space', 'Log line counts'], answer: 1, difficulty: 'easy' },
    { q: 'What is the difference between `kill 1234` and `pkill nginx`?', options: ['kill targets a PID, pkill matches process names', 'They are aliases', 'pkill needs root always, kill never', 'kill can only stop services'], answer: 0, difficulty: 'medium' },
    { q: 'How does `systemctl reload nginx` differ from `restart`?', options: ['reload re-reads configuration without dropping the service, restart stops and starts it', 'They are identical', 'reload deletes cached pages', 'restart only works as root'], answer: 0, difficulty: 'medium' },
    { q: 'Which ssh option connects to a server listening on port 2222?', options: ['ssh --port 2222', 'ssh -p 2222 user@host', 'ssh 2222@host', 'ssh -n 2222'], answer: 1, difficulty: 'medium' },
    { q: 'What does `ss -t` filter the socket list down to?', options: ['UDP sockets', 'TCP sockets', 'Listening sockets only', 'Timed-out connections'], answer: 1, difficulty: 'medium' },
    { q: 'By what does `top` order the process table by default?', options: ['Process ID', 'Start time', 'CPU usage', 'Alphabetically'], answer: 2, difficulty: 'medium' },
    { q: 'Which curl flag saves the response body to a file instead of printing it?', options: ['-o output.html', '--save', '-w output.html', '-S'], answer: 0, difficulty: 'medium' },
    { q: 'What does `ss -tuln` display?', options: ['TCP and UDP sockets that are listening, ports shown numerically', 'Only established connections', 'Firewall rules', 'Routing table'], answer: 0, difficulty: 'hard' },
    { q: 'Why is `kill -9` considered a last resort?', options: ['It is slower than kill', 'SIGKILL cannot be caught, so the process gets no chance to clean up', 'It damages the kernel', 'It needs a GUI'], answer: 1, difficulty: 'hard' },
    { q: 'What does `journalctl -u nginx --since today` show?', options: ['All kernel logs', 'Nginx unit log entries from today onward', 'Nginx config errors only', 'Disk usage of logs'], answer: 1, difficulty: 'hard' },
    { q: 'What does `systemctl enable nginx` actually change?', options: ['Starts nginx immediately', 'Creates the autostart link so it starts at boot, without starting it now', 'Restarts it at midnight', 'Disables the firewall'], answer: 1, difficulty: 'hard' },
    { q: 'What extra does `rsync -avz src/ host:/backup` do compared with plain scp?', options: ['Archives recursively, preserves metadata and compresses during transfer', 'Encrypts the copies', 'Uploads to two hosts', 'Converts line endings'], answer: 0, difficulty: 'hard' },
    { q: 'How do you sort top by memory usage?', options: ['Press M', 'Press P', 'Press 1', 'Press k'], answer: 0, difficulty: 'hard' },
  ],
};

const securityCtf: LearningPath = {
  id: 'security-ctf',
  title: 'Security & CTF Starters',
  tagline: 'Your first offensive toolkit: scanning, brute force, stego and forensics.',
  difficulty: 'Intermediate',
  stage: 1,
  icon: Shield,
  color: '#f87171',
  lessons: [
    {
      title: 'Scanning and recon',
      intro: 'Every engagement starts with knowing the target surface.',
      bullets: [
        'nmap target scans ports and guesses services; -sV asks for versions, -sn finds live hosts first.',
        'gobuster dir -u url -w wordlist hunts hidden web pages - it also has dns and vhost modes.',
        'nikto is a web vulnerability scanner; wpscan speaks WordPress natively.',
        'whois and searchsploit pull public intel: registration data and known exploits.',
      ],
      commands: ['nmap', 'gobuster', 'nikto', 'wpscan', 'whois', 'searchsploit'],
    },
    {
      title: 'Cracking and brute force',
      intro: 'Hashes are the lock pins of CTF challenges.',
      bullets: [
        'john hash.txt cracks password hashes using rules and wordlists; --wordlist=rockyou.txt picks the dictionary.',
        'hashcat -m 0 switches the hash mode; GPU speeds make meter-long lists feasible.',
        'hydra -L users.txt -P pass.txt ssh://target tries credential pairs over SSH and other logins.',
        'hashid file guesses which hash format you are facing before you pick a cracker.',
      ],
      commands: ['john', 'hashcat', 'hydra', 'hashid'],
    },
    {
      title: 'Files, stego and binary forensics',
      intro: 'Challenges are often just files wearing disguises.',
      bullets: [
        'strings dump.bin extracts printable text - flags love hiding there.',
        'binwalk firmware.bin finds embedded files and filesystems inside blobs.',
        'exiftool photo.jpg reads metadata; steghide extract pulls hidden payloads out of images.',
        'checksec ./binary reports binary protections like NX, PIE and canaries for exploitation work.',
      ],
      commands: ['strings', 'binwalk', 'exiftool', 'steghide', 'checksec'],
    },
  ],
  questions: [
    { q: 'Which command scans a target for open ports?', options: ['ping', 'nmap', 'curl', 'grep'], answer: 1, difficulty: 'easy' },
    { q: 'What does `whois example.com` reveal?', options: ['The page source', 'Domain registration and ownership details', 'Open ports', 'DNS records only'], answer: 1, difficulty: 'easy' },
    { q: 'Which tool brute-forces logins such as SSH or forms?', options: ['hydra', 'john', 'sqlmap', 'strings'], answer: 0, difficulty: 'easy' },
    { q: 'What does `strings dump.bin` show?', options: ['Binary hex', 'Readable text fragments inside the binary', 'File metadata', 'Memory layout'], answer: 1, difficulty: 'easy' },
    { q: 'Which tool cracks password hashes from a wordlist?', options: ['john', 'jq', 'nmap', 'cut'], answer: 0, difficulty: 'easy' },
    { q: 'What does `binwalk firmware.bin` look for?', options: ['WiFi networks', 'Embedded files and filesystems in the blob', 'Broken symlinks', 'Video codecs'], answer: 1, difficulty: 'easy' },
    { q: 'Which tool hunts for hidden web directories using a wordlist?', options: ['gobuster', 'whois', 'tracert', 'less'], answer: 0, difficulty: 'easy' },
    { q: 'What does `exiftool photo.jpg` read?', options: ['Pixels', 'Metadata such as camera or GPS tags', 'Binary code', 'Network traffic'], answer: 1, difficulty: 'easy' },
    { q: 'Which command pulls concealed data out of an image made with steghide?', options: ['steghide extract', 'binwalk -st', 'exiftool -hide', 'strings -jpg'], answer: 0, difficulty: 'easy' },
    { q: 'What does `searchsploit openssh` find?', options: ['Running OpenSSH versions', 'Local Exploit-DB entries for OpenSSH', 'The OpenSSH config file', 'SSH tunnel guides'], answer: 1, difficulty: 'easy' },
    { q: 'What does `nmap -sV target` add to a basic scan?', options: ['More open ports', 'Detected service versions on open ports', 'OS fingerprints only', 'SSL certificates'], answer: 1, difficulty: 'medium' },
    { q: 'What does `hydra -L users.txt -P pass.txt ssh://host` do?', options: ['Lists SSH users', 'Tries every user/password pair over SSH', 'Cracks the SSH private key', 'Spoofs SSH banners'], answer: 1, difficulty: 'medium' },
    { q: 'What is gobuster dns mode used for?', options: ['Enumerating subdomains of a domain', 'Scanning DNS ports', 'Brute-forcing DNS passwords', 'Zone transfers'], answer: 0, difficulty: 'medium' },
    { q: 'Which sqlmap flag feeds a saved HTTP request from a file?', options: ['-r request.txt', '-f request.txt', '--load request.txt', '-u request.txt'], answer: 0, difficulty: 'medium' },
    { q: 'In `hashcat -m 0 hashes.txt wordlist.txt`, what does -m 0 select?', options: ['The GPU device', 'The hash mode, 0 being MD5', 'Maximum threads', 'Output mask'], answer: 1, difficulty: 'medium' },
    { q: 'What does `checksec ./binary` report?', options: ['Antivirus status', 'Stack canaries, NX, PIE and other binary protections', 'Password strength', 'Firewall rules'], answer: 1, difficulty: 'medium' },
    { q: 'Why run `nmap -sn 192.168.1.0/24` before a port scan?', options: ['It maps only DMZ hosts', 'It quickly finds which hosts are alive without port scanning', 'It disables logging on the router', 'It upgrades the subnet'], answer: 1, difficulty: 'hard' },
    { q: 'What does `steghide extract -sf img.jpg -p secret` do?', options: ['Encrypts the image', 'Uses the passphrase secret to pull hidden data out of img.jpg', 'Extracts JPEG fragments for repair', 'Signs the image'], answer: 1, difficulty: 'hard' },
    { q: 'In sqlmap, what does --batch change?', options: ['Runs non-interactive, automatically accepting default answers', 'Scans in parallel', 'Batches several targets', 'Enables verbose mode'], answer: 0, difficulty: 'hard' },
    { q: 'What does `wpscan --url site -e u` enumerate?', options: ['Plugins', 'WordPress usernames', 'Themes only', 'Backup files'], answer: 1, difficulty: 'hard' },
    { q: 'Why pipe `strings binary` into `grep -i flag`?', options: ['It compresses the output', 'It filters the dump down to probable flag markers', 'It sorts the strings', 'It hashes each string'], answer: 1, difficulty: 'hard' },
    { q: 'What does `objdump -d ./binary` produce?', options: ['Disassembled code of the executable sections', 'Object file list', 'Dumped strings', 'Debug symbols only'], answer: 0, difficulty: 'hard' },
  ],
};

/* ---------------- Stage 2 paths ---------------- */

const permissionsPath: LearningPath = {
  id: 'permissions-ownership',
  title: 'Permissions & Ownership',
  tagline: 'The rwx matrix, ownership changes, default masks and ACLs.',
  difficulty: 'Advanced',
  stage: 2,
  icon: KeyRound,
  color: '#fbbf24',
  lessons: [
    {
      title: 'Reading the permission matrix',
      intro: 'ls -l speaks a language once you learn its nine letters.',
      bullets: [
        'Triads order matters: owner, then group, then everyone else; r=4, w=2, x=1.',
        'chmod 755 means owner rwx (4+2+1), others r-x; digits mirror the matrix.',
        'chmod +x file adds execute without touching other bits; o-r removes others read.',
        'Directories need x to be enterable and r to be listable - missing either looks like a denial.',
      ],
      commands: ['ls', 'chmod', 'stat'],
    },
    {
      title: 'Changing who owns what',
      intro: 'Ownership and group membership decide who the matrix even applies to.',
      bullets: [
        'chown user:group file changes both; chown -R applies to whole directory trees.',
        'chgrp team file changes only the group side.',
        'passwd changes your password, root can reset any account with it.',
        'useradd creates accounts (with -m for a home directory) - ownership starts standing on users.',
      ],
      commands: ['chown', 'chgrp', 'passwd', 'useradd'],
    },
    {
      title: 'Defaults and fine-grained control',
      intro: 'Why new files never come out 777, and what happens next.',
      bullets: [
        'umask masks away permission bits from defaults: umask 022 turns dir 777 into 755 and file 666 into 644.',
        'getfacl file prints the exact access rules, including any ACL entries beyond the classic triads.',
        'setfacl -m u:deputy:rw file grants one extra user rights without touching the group.',
        'lsattr shows special flags such as +i (immutable), set with chattr +i.',
      ],
      commands: ['umask', 'getfacl', 'setfacl', 'lsattr', 'chattr'],
    },
  ],
  questions: [
    { q: 'What does chmod 755 grant?', options: ['Full rights to everyone', 'Owner rwx, group and others r-x', 'Owner rw only', 'Nobody any rights'], answer: 1, difficulty: 'easy' },
    { q: 'How do the rwx letters map to numbers?', options: ['r=1,w=2,x=3', 'r=4,w=2,x=1', 'r=2,w=4,x=8', 'r=7,w=5,x=5'], answer: 1, difficulty: 'easy' },
    { q: 'Which command changes who owns a file?', options: ['chmod', 'chown', 'usermod', 'passwd'], answer: 1, difficulty: 'easy' },
    { q: 'What does umask control?', options: ['The mount table', 'Which permission bits are masked away from newly created files', 'User passwords', 'Shell history'], answer: 1, difficulty: 'easy' },
    { q: 'How do you make a directory tree changeable recursively?', options: ['chmod -R 755 tree/', 'chmod --all tree/', 'chown --deep', 'There is no recursion'], answer: 0, difficulty: 'easy' },
    { q: 'Which command changes your account password?', options: ['usermod', 'passwd', 'login', 'chsh'], answer: 1, difficulty: 'easy' },
    { q: 'Which command PRINTS the ACL entries of a file?', options: ['getfacl file', 'acl --list file', 'setfacl -l2 file', 'ls -a file'], answer: 0, difficulty: 'easy' },
    { q: 'Which command MODIFIES an ACL entry?', options: ['acls --set', 'setfacl -m u:deputy:rw file', 'chmod -a file', 'chgrp -m file'], answer: 1, difficulty: 'easy' },
    { q: 'How do you change ownership of a whole directory tree?', options: ['chown -R user:group tree/', 'chown --fast', 'chown -v -1 tree/', 'mv tree user'], answer: 0, difficulty: 'easy' },
    { q: 'What does chmod +x script.sh do?', options: ['Locks the file', 'Adds execute permission keeping other bits', 'Sets only executable, clears the rest', 'Reassigns the owner'], answer: 1, difficulty: 'easy' },
    { q: 'What does chmod o-r notes.txt change?', options: ['Owner loses read', 'Others lose read permission', 'Group gains read', 'Ownership resets'], answer: 1, difficulty: 'medium' },
    { q: 'With umask 022, what are the permissions of a newly created directory?', options: ['777', '755', '644', '640'], answer: 1, difficulty: 'medium' },
    { q: 'What does `chgrp team file` do differently from chown?', options: ['Also changes the user', 'Changes only the group part of ownership', 'Adds a new group', 'Sets ACLs'], answer: 1, difficulty: 'medium' },
    { q: 'Why is a directory listed with r but without x unusable for cd?', options: ['cd needs the execute bit to enter directories', 'Only root can cd', 'r is for files only', 'x is meaningless for directories'], answer: 0, difficulty: 'medium' },
    { q: 'Which command shows file ATTRIBUTES like immutable or append-only?', options: ['lsattr', 'stat -x', 'getfacl', 'file -i'], answer: 0, difficulty: 'medium' },
    { q: 'What does `chattr +i file` achieve?', options: ['Marks the file invisible', 'Makes it immutable - even root cannot modify or delete it until the flag is removed', 'Increases inode count', 'Instant backups'], answer: 1, difficulty: 'medium' },
    { q: 'What does chmod u+s produce?', options: ['A sticky directory', 'The setuid bit - the program runs with the owner account privileges', 'Symlink shortcut', 'Append-only flag'], answer: 1, difficulty: 'hard' },
    { q: 'With umask 022, what permissions does a NEW FILE receive by default?', options: ['755', '644', '666', '600'], answer: 1, difficulty: 'hard' },
    { q: 'You want owner rwx, group and others read-only. Which numeric mode fits?', options: ['744', '644 (missing owner x)', '755 (others get x)', '447'], answer: 0, difficulty: 'hard' },
    { q: 'What does setfacl -m user:deputy:rw report.txt add?', options: ['A group entry', 'An ACL granting deputy read+write without touching owner or group bits', 'A secondary owner', 'Audit logging'], answer: 1, difficulty: 'hard' },
    { q: 'Why is umask 077 a good default on a shared web server?', options: ['It speeds up writes', 'New files come out owner-only (600/700), keeping sensitive data private from other accounts', 'It disables ACLs', 'It encrypts everything'], answer: 1, difficulty: 'hard' },
    { q: 'getfacl prints mask::r-x. What is this mask?', options: ['The kernel firewall', 'The maximum effective permission set for ACL entries', 'The umask value', 'The checksum'], answer: 1, difficulty: 'hard' },
  ],
};

const automationPath: LearningPath = {
  id: 'shell-automation',
  title: 'Shell Automation & Pipelines',
  tagline: 'xargs, tee, tr, sort, uniq - building unix pipelines that chain themselves.',
  difficulty: 'Advanced',
  stage: 2,
  icon: Workflow,
  color: '#34d399',
  lessons: [
    {
      title: 'Feeding commands with xargs',
      intro: 'Pipes carry stdout; xargs turns that text into real arguments.',
      bullets: [
        'cat list.txt | xargs rm deletes every name listed - xargs converts lines to arguments.',
        'xargs -I {} substitutes {} with each input item in a template command.',
        'Command substitution $(date +%Y) captures a command OUTPUT as text for another command.',
        'echo run | xargs -I {} echo {} again is the testing pattern: preview before destructive runs.',
      ],
      commands: ['xargs', 'echo', 'date'],
    },
    {
      title: 'Splitting the stream with tee',
      intro: 'One output, many destinations - watching what would otherwise vanish.',
      bullets: [
        'make 2>&1 | tee build.log shows the build live AND stores it.',
        'tee -a appends instead of truncating the target file.',
        'Pipes connect stages stdout-to-stdin; tee branches but does not block the chain.',
        'Combine: sort data.txt | tee sorted.txt | head reads, saves and trims in one line.',
      ],
      commands: ['tee', 'sort', 'head', 'cat'],
    },
    {
      title: 'Filters worth memorizing',
      intro: 'The small set of tools covering most text munging.',
      bullets: [
        'tr -d deletes characters; tr a-z A-Z recases - both stream-based, no files involved.',
        'sort -tu ":" -k3 (sort -t: -k3) orders by a chosen delimiter field; sort -h understands human sizes.',
        'cut ranges (-f1-3) slice several columns at once.',
        'uniq -u keeps singletons only; column -t aligns output into readable tables.',
      ],
      commands: ['tr', 'sort', 'uniq', 'cut', 'column'],
    },
  ],
  questions: [
    { q: 'What does xargs do with piped input?', options: ['Buffers it for later', 'Converts the input text into arguments for another command', 'Sorts the lines', 'Prints to stderr'], answer: 1, difficulty: 'easy' },
    { q: 'What does `tee out.log` do in a pipeline?', options: ['Deletes out.log', 'Writes stdin to out.log AND passes it on', 'Truncates the pipe', 'Timed echo'], answer: 1, difficulty: 'easy' },
    { q: 'What does `tr a-z A-Z` do?', options: ['Translates sizes', 'Converts lowercase to uppercase', 'Transfers ownership', 'Trims whitespace only'], answer: 1, difficulty: 'easy' },
    { q: 'Which flag makes sort remove duplicates while sorting?', options: ['-u', '-d', '-x', '-c'], answer: 0, difficulty: 'easy' },
    { q: 'What does `history` show?', options: ['Kernel events', 'Your previously executed commands', 'Git log', 'Uptime'], answer: 1, difficulty: 'easy' },
    { q: 'What does `cut -d, -f2` extract?', options: ['The second comma-separated field', 'Cut positions 2 to end', 'Commas only', 'Second file given'], answer: 0, difficulty: 'easy' },
    { q: 'What does `rev` do to its input lines?', options: ['Reverses the line order', 'Reverses the characters of each line', 'Reverts changes', 'Reviews syntax'], answer: 1, difficulty: 'easy' },
    { q: 'Which command formats text to a maximum line width for readability?', options: ['fmt', 'fold -w', 'column', 'printf'], answer: 0, difficulty: 'easy' },
    { q: 'What does the -c flag of uniq alter?', options: ['Casing', 'Prefixes each output line with its duplicate count', 'Copies input to output', 'Compression'], answer: 1, difficulty: 'easy' },
    { q: 'What does `grep -v pattern` output?', options: ['Matching lines', 'Every line EXCEPT matches', 'Verbose matches', 'Vector counts'], answer: 1, difficulty: 'easy' },
    { q: 'What does `xargs -I {}` enable?', options: ['Interactive mode', 'Substituting {} inside a template command with each input item', 'Input throttling', 'Idempotent runs'], answer: 1, difficulty: 'medium' },
    { q: 'In `sort -t: -k3 -n /etc/passwd`, what orders the lines?', options: ['The numeric third colon-separated field', 'The line length', 'The username alphabetically', 'The number of colons'], answer: 0, difficulty: 'medium' },
    { q: 'What does `tr -d "\\n"` produce?', options: ['Deletes newlines, joining everything to one line', 'Deletes nothing', 'Counts newlines', 'Doubles spacing'], answer: 0, difficulty: 'medium' },
    { q: 'How does `cut -f1-3` differ from -f2?', options: ['Ranges: fields one through three instead of just two', 'It sorts', 'It reads three files', 'No difference'], answer: 0, difficulty: 'medium' },
    { q: 'What does `uniq -u` output for sorted input?', options: ['Only lines that appear exactly once', 'Unique lines without counting', 'Uppercased lines', 'Universal lines'], answer: 0, difficulty: 'medium' },
    { q: 'What does `echo Today is $(date +%Y-%m-%d)` achieve?', options: ['Prints the literal text', 'Runs date first and embeds its output in the message', 'Schedules the echo', 'Creates a file'], answer: 1, difficulty: 'medium' },
    { q: 'Why is `grep -E "(err|warn)" log` useful here?', options: ['-E enables extended regex so one pass matches both words', 'It rewrites the log', 'It greps errors twice', 'It escapes the pattern'], answer: 0, difficulty: 'hard' },
    { q: 'In awk, what does the awk block with a guard such as `$2 > 100 {print $1}` output?', options: ['The first field, but only for lines whose second field exceeds 100', 'Always the whole line', 'Only the second field unconditionally', 'Nothing, awk cannot compare numbers'], answer: 0, difficulty: 'hard' },
    { q: 'What does `sed -i "s/http:///" file` risk that stdout-only sed does not?', options: ['It rewrites the FILE in place - a bad pattern is destructive with no preview', 'Nothing, they are equal', 'It changes permissions', 'It sorts the file'], answer: 0, difficulty: 'hard' },
    { q: 'What does `sort -h sizes.txt` handle that -n cannot?', options: ['Hexadecimal', 'Human suffixes like 2K and 1M', 'Headers', 'Numbers only in quotes'], answer: 1, difficulty: 'hard' },
    { q: 'What classic frequency pipeline counts words in a document?', options: ['tr space "\\n" | sort | uniq -c | sort -nr', 'wc -w only $COLUMNS', 'fmt -w | column', 'grep -c . | tee'], answer: 0, difficulty: 'hard' },
    { q: 'What does `tee -a existing.log` change compared with plain tee?', options: ['Appends to existing.log instead of overwriting it', 'Automatic timestamping', 'Binary-safe mode', 'Writes to stderr instead'], answer: 0, difficulty: 'hard' },
  ],
};

const servicesLogsPath: LearningPath = {
  id: 'services-logs',
  title: 'Services & Log Intelligence',
  tagline: 'systemd units, the journal, process signals - keeping a server observable.',
  difficulty: 'Advanced',
  stage: 2,
  icon: ScrollText,
  color: '#60a5fa',
  lessons: [
    {
      title: 'Unit lifecycle with systemctl',
      intro: 'Everything on a modern server is a unit with a lifecycle you can steer.',
      bullets: [
        ' systemctl start/stop/restart/status steer a unit live, enable hooks it into boot, mask blocks it entirely.',
        'systemctl --failed lists units that crashed on last boot - first stop after logging in.',
        'mask prevents a unit even from indirect activation; unmask reverts it.',
        'systemctl cat unit shows the on-disk unit definition for quick inspection.',
      ],
      commands: ['systemctl', 'journalctl'],
    },
    {
      title: 'Reading the journal',
      intro: 'journalctl is the time machine of every unit.',
      bullets: [
        'journalctl -u nginx filters to that one unit - the first flag you will learn.',
        'journalctl -n 20 shows the last 20 lines, -f follows live like tail -f.',
        'journalctl -b scopes to the current boot; --since "1 hour ago" scopes to time windows.',
        'journalctl -p err lowers the noise by priority level.',
      ],
      commands: ['journalctl', 'grep'],
    },
    {
      title: 'Processes and signals in depth',
      intro: 'Control the actors behind the units.',
      bullets: [
        'ps -ef prints full-format listing; ps -u root narrows to a single user.',
        'kill -HUP PID historically signals config reloads (SIGHUP); kill -l lists all signals.',
        'pkill --signal HUP nginx sends a named signal to a named process group.',
        'top refreshes continuously, press M for memory or P for CPU sorting; htop offers the same with cleaner UX.',
      ],
      commands: ['ps', 'kill', 'pkill', 'top', 'htop'],
    },
  ],
  questions: [
    { q: 'Which command starts a systemd unit?', options: ['systemctl start unit', 'service unit up', 'run unit', 'init unit'], answer: 0, difficulty: 'easy' },
    { q: 'How do you stop a service through systemd?', options: ['systemctl stop unit', 'kill unit', 'halt unit', 'down unit'], answer: 0, difficulty: 'easy' },
    { q: 'Which journalctl flag filters by a specific unit?', options: ['-u unit', '--unit-file', '-U', '--for unit'], answer: 0, difficulty: 'easy' },
    { q: 'What does `ps -ef` display?', options: ['Full-format list of all processes', 'Only your processes', 'Environment variables', 'Disk errors'], answer: 0, difficulty: 'easy' },
    { q: 'What does htop give you over ps?', options: ['An interactive, filterable live view', 'Historical logs', 'Network stats', 'Nothing'], answer: 0, difficulty: 'easy' },
    { q: 'What does `kill -l` print?', options: ['The last process', 'The list of available signals', 'Load average', 'Locked files'], answer: 1, difficulty: 'easy' },
    { q: 'When does systemctl enable actually start a unit?', options: ['Immediately', 'It only hooks the unit into boot - it does not start it now', 'At shutdown', 'When masked'], answer: 1, difficulty: 'easy' },
    { q: 'What does `journalctl -b` scope the log view to?', options: ['The current boot', 'Binary logs', 'Logging devices', 'Bounced units'], answer: 0, difficulty: 'easy' },
    { q: 'How do you kill a process NAME without knowing the PID?', options: ['pkill name', 'kill -name', 'ps | x', 'top -k name'], answer: 0, difficulty: 'easy' },
    { q: 'What shows a quick grouped socket summary plus listening ports?', options: ['ss -s', 'ss -t', 'netstat --all', 'ip -s'], answer: 0, difficulty: 'easy' },
    { q: 'What does systemctl mask unit accomplish beyond disable?', options: ['Prevents the unit from being started even indirectly', 'Deletes the unit', 'Restarts it in a loop', 'Changes its owner'], answer: 0, difficulty: 'medium' },
    { q: 'What does `journalctl -n 20` display?', options: ['Units with 20 fails', 'The most recent 20 log lines', 'Logs from 20 boots', '20 priority levels'], answer: 1, difficulty: 'medium' },
    { q: 'What is `kill -HUP PID2` contract?', options: ['Hangup well reserved', 'Deliver SIGHUP - conventionally asks a daemon to reload its configuration', 'Force kill third variant', 'Pauses the process'], answer: 1, difficulty: 'medium' },
    { q: 'Which command lists units that failed during boot?', options: ['systemctl --failed', 'systemctl ls --broken', 'journalctl --fails', 'ps -eF'], answer: 0, difficulty: 'medium' },
    { q: 'What does `journalctl -p err` filter to?', options: ['Priority error and above', 'Error counts per unit', 'Files with errors', 'Extended errors'], answer: 0, difficulty: 'medium' },
    { q: 'Why use htop over top?', options:['Cleaner interactive interface with easier filtering, tree views and killing', 'It uses less power always', 'It logs automatically', 'It is the same program'], answer: 0, difficulty: 'medium' },
    { q: 'What does `systemctl list-dependencies unit` reveal?', options: ['Which units this unit requires and conflicts with', 'Package dependencies only', 'Libraries loaded in RAM', 'Apt candidates'], answer: 0, difficulty: 'hard' },
    { q: 'How do you filter the journal by the executable that produced entries?', options: ['journalctl /usr/sbin/nginx path form', 'journalctl -x nginx', 'journalctl --bin', 'journalctl -prog'], answer: 0, difficulty: 'hard' },
    { q: 'Why can zombie processes survive their parent not calling wait()?', options: ['The parent never reaps the exit status, so the entry stays in the table', 'Kernels never clean up', 'Zombies are daemons', 'Signals are disabled'], answer: 0, difficulty: 'hard' },
    { q: 'What does `ps -o pid,ppid,cmd` achieve?', options: ['Custom output format - only these columns', 'Kills by match', 'Opens the process', 'Sorts by RAM'], answer: 0, difficulty: 'hard' },
    { q: 'What does `systemctl cat unit` display?', options: ['The unit file content from disk', 'Event logs', 'CPU stats', 'A cat command template'], answer: 0, difficulty: 'hard' },
    { q: 'What does `journalctl --disk-usage` show?', options: ['Total space the journal archives consume', 'Log lines per unit', 'Disk speed', 'Archived attempts'], answer: 0, difficulty: 'hard' },
  ],
};

const secureOpsPath: LearningPath = {
  id: 'secure-ops',
  title: 'Secure Remote Operations',
  tagline: 'SSH, encrypted copies, tunnels and live connection auditing.',
  difficulty: 'Advanced',
  stage: 2,
  icon: Globe,
  color: '#e879f9',
  lessons: [
    {
      title: 'Working through SSH',
      intro: 'Your remote-control channel and its knobs.',
      bullets: [
        'ssh user@host logs in; ssh -i key.pem selects a specific identity key.',
        'ssh user@host command runs a single remote command instead of a shell.',
        'ssh -p 2222 targets non-default ports; -N tunnels without opening a shell at all.',
        'Keys beat passwords: public key auth means no credential guessing surface.',
      ],
      commands: ['ssh'],
    },
    {
      title: 'Moving files safely: scp and rsync',
      intro: 'Two tools, two philosophies.',
      bullets: [
        'scp file host:/dest does a one-shot encrypted copy; scp -r copies directories.',
        'scp -P 2222 ... - capital P for port in scp, lowercase in ssh.',
        'rsync -avz src/ host:/backup archives, preserves metadata and compresses; only deltas move on re-runs.',
        'Trailing slashes matter: src/ copies CONTENTS, src without slash copies the folder itself. --delete mirrors removals.',
      ],
      commands: ['scp', 'rsync'],
    },
    {
      title: 'Watching the wire',
      intro: 'Know exactly what is talking, on which ports, right now.',
      bullets: [
        'lsof -i lists processes with open network connections; lsof -p PID scopes to one process.',
        'ss -s prints socket totals: listening, established, timed out.',
        'ss -i adds TCP internals like round-trip time per connection.',
        'curl -s api.example.com/health makes the quickest service alive-check.',
      ],
      commands: ['lsof', 'ss', 'curl'],
    },
  ],
  questions: [
    { q: 'How do you connect to a server by SSH?', options: ['ssh user@host', 'connect host', 'login --ssh host', 'tel user@host'], answer: 0, difficulty: 'easy' },
    { q: 'Which flag selects a specific SSH key file?', options: ['-i key.pem', '-k key.pem', '--key=key.pem', '-key file'], answer: 0, difficulty: 'easy' },
    { q: 'What does `scp file.txt host:/tmp` do?', options: ['Copies the file encrypted to /tmp on host', 'Moves it locally', 'Mounts /tmp', 'Starts a server'], answer: 0, difficulty: 'easy' },
    { q: 'How do you copy a whole directory with scp?', options: ['scp -r dir host:/dest', 'scp --dir', 'scp -f dir', 'scp only moves files'], answer: 0, difficulty: 'easy' },
    { q: 'What does rsync do on its second run against the same target?', options: ['Copies everything again', 'Transfers only changed deltas', 'Refuses to run', 'Switches protocols'], answer: 1, difficulty: 'easy' },
    { q: 'Which tool lists processes with open network connections?', options: ['lsof -i', 'ps -net', 'ss --proc', 'net-ls'], answer: 0, difficulty: 'easy' },
    { q: 'What does `ss -t` display?', options: ['Timers', 'TCP sockets', 'Tunnels', 'Traceroute'], answer: 1, difficulty: 'easy' },
    { q: 'Which command is the quickest service health check from a script?', options: ['curl -s http://...', 'ping all', 'nmap localhost', 'traceroute api'], answer: 0, difficulty: 'easy' },
    { q: 'How does ssh run a remote command instead of a shell?', options: ['ssh user@host "command"', 'ssh -c "command"', 'ssh --exec "command"', 'run ssh "command"'], answer: 0, difficulty: 'easy' },
    { q: 'What does rsync -z add to transfers?', options: ['Compression in transit', 'Zero-copy mode', 'Zip archives at destination', 'Zombie safety'], answer: 0, difficulty: 'easy' },
    { q: 'For scp, which flag sets the port number?', options: ['-P (capital)', '-p (lowercase)', '--port', '-23'], answer: 0, difficulty: 'medium' },
    { q: 'What does `ssh -N user@host -L 8080:localhost:80` achieve?', options: ['Opens a port-forward tunnel without a remote shell', 'Denies network', 'Names a connection', 'No-op'], answer: 0, difficulty: 'medium' },
    { q: 'What does rsync --exclude "*.tmp" do mid-transfer?', options: ['Skips matching files during synchronization', 'Deletes matching files', 'Compresses them only', 'Fast-forwards them'], answer: 0, difficulty: 'medium' },
    { q: 'What does lsof -p 4321 list?', options: ['Every open file handle of process 4321', 'Ports 4321', 'Policies of PID 4321', 'Users named 4321'], answer: 0, difficulty: 'medium' },
    { q: 'What does `ss -s` output?', options: ['A summary table of socket states', 'The ssh service status', 'Snapshot mode', 'Secure stats'], answer: 0, difficulty: 'medium' },
    { q: 'Why is scp considered simpler but slower than rsync for updates?', options: ['It always recopies the whole set, rsync sends only differences', 'scp uses UDP', 'rsync skips verification', 'They are equally fast'], answer: 0, difficulty: 'medium' },
    { q: 'Why does the trailing slash in `rsync -av src/ dest/` matter?', options: ['It copies the CONTENTS of src into dest; without it the src folder itself is nested inside dest', 'It is cosmetic only', 'It forces encryption', 'It skips hidden files'], answer: 0, difficulty: 'hard' },
    { q: 'What does rsync --delete accomplish on a mirrored pair?', options: ['Removes destination files that disappeared at the source, completing the mirror', 'Deletes the source', 'Self-destructs after finish', 'Drops permissions'], answer: 0, difficulty: 'hard' },
    { q: 'Why might lsof +D /var/log be slow and what is the alternative?', options: ['It walks the whole tree; use find ... -exec lsof on the resulting file list or per-file lsof', 'It is diskless', 'It needs IPv6', 'Nothing, it is fast'], answer: 0, difficulty: 'hard' },
    { q: 'What extra does `ss -i` add per connection?', options: ['TCP internals like round-trip time and congestion windows', 'Icon mapping', 'IPtables rules', 'Interface stats'], answer: 0, difficulty: 'hard' },
    { q: 'How do you point rsync at a custom ssh port?', options: ['rsync -e "ssh -p 2222" src host:/dest', 'rsync --port=2222', 'rsync cannot use custom ports', '-P 2222'], answer: 0, difficulty: 'hard' },
    { q: 'What does ssh -A enable and why is it risky?', options: ['Agent forwarding - a compromised remote root could reuse your local agent keys', 'Anonymous login mode', 'An always-on VPN tunnel', 'Automatic audit logging'], answer: 0, difficulty: 'hard' },
  ],
};

/* ---------------- Ordering & derivation ---------------- */

const stage1Paths = [shellBasics, textTools, systemNetworking, securityCtf];
const stage2Paths = [permissionsPath, automationPath, servicesLogsPath, secureOpsPath];
const PATHS = [...stage1Paths, ...stage2Paths];
const PATH_ORDER = PATHS.map((p) => p.id);

/** Re-exported so the Dashboard can surface the same curriculum numbers. */
export const LEARNING_PATHS = PATHS;

/* ============================================================
   Component
   ============================================================ */

type QuizChoice = number | null;

export function LearningPage() {
  /* ---- progress (loaded synchronously so nothing gets clobbered) ---- */
  const [progress, setProgress] = useState<Progress>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Progress;
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      /* corrupted storage - start fresh */
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      /* storage full or blocked - progress simply stays in memory */
    }
  }, [progress]);

  /* ---- view / quiz state ---- */
  const [view, setView] = useState<'paths' | 'lessons' | 'setup' | 'quiz' | 'results'>('paths');
  const [selectedId, setSelectedId] = useState<string>(PATHS[0].id);
  const [flash, setFlash] = useState<string | null>(null);

  const [quizFilter, setQuizFilter] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [quizCount, setQuizCount] = useState(5);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizChoices, setQuizChoices] = useState<QuizChoice[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<QuizChoice>(null);

  const selected = useMemo(() => PATHS.find((p) => p.id === selectedId) ?? PATHS[0], [selectedId]);
  const streak = useMemo(() => readStreak(), []);

  /* ---- derived global stats ---- */
  const pathsDone = PATH_ORDER.filter((id) => progress[id]?.completed).length;
  const stage1DoneCount = stage1Paths.filter((p) => progress[p.id]?.completed).length;
  const stage1Complete = stage1DoneCount === stage1Paths.length;
  const totalLessons = PATHS.reduce((n, p) => n + p.lessons.length, 0);
  const lessonsRead = PATHS.reduce((n, p) => n + (progress[p.id]?.lessons.length ?? 0), 0);
  const quizTaken = PATHS.filter((p) => (progress[p.id]?.bestTotal ?? 0) > 0);
  const quizAvg = quizTaken.length
    ? Math.round(
        quizTaken.reduce((sum, p) => {
          const entry = progress[p.id];
          return entry && entry.bestTotal > 0 ? sum + (entry.bestScore / entry.bestTotal) * 100 : sum;
        }, 0) / quizTaken.length,
      )
    : null;
  const allComplete = pathsDone === PATHS.length;

  /* unlocked recommendations: first incomplete path the user can actually reach */
  const recommended = useMemo(() => {
    if (!stage1Complete) return stage1Paths.find((p) => !progress[p.id]?.completed) ?? null;
    return stage2Paths.find((p) => !progress[p.id]?.completed) ?? null;
  }, [progress, stage1Complete]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  /* ---------------- actions ---------------- */

  const choosePath = (path: LearningPath) => {
    setSelectedId(path.id);
    setView('lessons');
  };

  const toggleLesson = (index: number) => {
    const path = selected;
    const beforeCompleted = progress[path.id]?.completed ?? false;
    const next = toggleLessonInProgress(progress, path, index);
    setProgress(next);
    if (!beforeCompleted && next[path.id]?.completed) {
      setFlash(`${path.title} completed! Reading all lessons marks the path as done.`);
    }
  };

  const openSetup = () => {
    setQuizFilter('mixed');
    setQuizCount(5);
    setView('setup');
  };

  /* strict cap: never more than 10, never more than the pool offers */
  const pool = useMemo(() => {
    if (!selected) return [] as Question[];
    return quizFilter === 'mixed' ? selected.questions : selected.questions.filter((q) => q.difficulty === quizFilter);
  }, [selected, quizFilter]);

  const maxCount = Math.max(1, Math.min(MAX_QUESTIONS, pool.length));
  const effectiveCount = Math.min(quizCount, maxCount);

  const startQuiz = () => {
    if (!selected) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, effectiveCount);
    if (!shuffled.length) return;
    setQuizQuestions(shuffled);
    setQuizChoices(Array(shuffled.length).fill(null));
    setQuizScore(0);
    setStep(0);
    setChoice(null);
    setView('quiz');
  };

  const quizQuestion = quizQuestions[step];

  const answer = (index: number) => {
    if (choice !== null || !quizQuestion) return;
    setChoice(index);
    setQuizChoices((choices) => {
      const updated = [...choices];
      updated[step] = index;
      return updated;
    });
    if (index === quizQuestion.answer) setQuizScore((score) => score + 1);
  };

  const next = () => {
    if (!quizQuestion) return;
    if (step < quizQuestions.length - 1) {
      setStep(step + 1);
      setChoice(null);
      return;
    }
    const total = quizQuestions.length;
    const entry = progress[selected.id];
    setProgress((current) => ({
      ...current,
      [selected.id]: {
        completed: true,
        bestScore: Math.max(entry?.bestScore ?? 0, quizScore),
        bestTotal: Math.max(entry?.bestTotal ?? 0, total),
        lessons: entry?.lessons ?? [],
      },
    }));
    setView('results');
  };

  const resetAll = () => {
    if (!window.confirm('Reset ALL learning progress across every path? This cannot be undone.')) return;
    setProgress({});
    setFlash('Progress reset. Fresh start!');
  };

  /* ---------------- render ---------------- */

  const difficultyStyle: Record<string, string> = {
    Beginner: 'bg-emerald-400/15 text-emerald-400',
    Intermediate: 'bg-sky-400/15 text-sky-400',
    Advanced: 'bg-fuchsia-400/15 text-fuchsia-400',
  };

  const quizFilterStyle: Record<string, string> = {
    easy: 'bg-emerald-400/15 text-emerald-400',
    medium: 'bg-amber-400/15 text-amber-400',
    hard: 'bg-rose-400/15 text-rose-400',
    mixed: 'bg-sky-400/15 text-sky-400',
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {/* ================= header ================= */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-[var(--terminal-green)]">~/learn</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Learning Paths</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)] sm:text-base">
              Two stages. {PATHS.length} paths. Finish every Stage&nbsp;1 path to unlock the Stage&nbsp;2 advanced tier -
              your progress is saved automatically.
            </p>
          </div>
          {streak.current > 0 && (
            <span
              className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1.5 font-mono text-xs text-amber-400"
              title={streak.best > streak.current ? `Best streak: ${streak.best} days` : 'Keep visiting daily'}
            >
              🔥 {streak.current}-day streak
              {streak.best > streak.current && <span className="text-amber-400/60">· best {streak.best}</span>}
            </span>
          )}
        </header>

        {/* ================= progress dashboard ================= */}
        <section aria-label="Overall progress" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Paths complete"
            value={`${pathsDone}/${PATHS.length}`}
            bar={pathsDone / PATHS.length}
            hint={allComplete ? 'All stages conquered' : stage1Complete ? 'Stage 2 running' : 'Stage 1 in progress'}
          />
          <StatCard label="Lessons read" value={`${lessonsRead}/${totalLessons}`} bar={totalLessons ? lessonsRead / totalLessons : 0} hint="across every path" />
          <StatCard label="Quiz average" value={quizAvg === null ? '—' : `${quizAvg}%`} bar={quizAvg ? quizAvg / 100 : 0} hint={`${quizTaken.length} quizzes taken`} />
          <StatCard
            label="Current stage"
            value={stage1Complete ? 'Stage 2' : 'Stage 1'}
            bar={stage1Complete ? stage2Paths.filter((p) => progress[p.id]?.completed).length / stage2Paths.length : stage1DoneCount / stage1Paths.length}
            hint={stage1Complete ? 'Advanced tier unlocked' : `${stage1DoneCount}/${stage1Paths.length} until Stage 2`}
          />
        </section>

        {flash && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3">
            <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <p className="flex-1 text-sm text-emerald-300">{flash}</p>
            <button onClick={() => setFlash(null)} className="text-xs font-mono text-emerald-400/70 hover:text-emerald-300" aria-label="Dismiss">
              [x]
            </button>
          </div>
        )}

        {/* ================= views ================= */}
        {view === 'paths' && pathsView()}
        {view === 'lessons' && lessonsView()}
        {view === 'setup' && setupView()}
        {view === 'quiz' && quizQuestion && quizView(quizQuestion)}
        {view === 'results' && resultsView()}
      </div>
    </div>
  );

  /* ============================================================
     VIEW: paths overview
     ============================================================ */
  function pathsView() {
    const stageSections = [
      { stage: 1 as const, title: 'Stage 1 — Foundations', items: stage1Paths, done: stage1DoneCount, locked: false },
      { stage: 2 as const, title: 'Stage 2 — Advanced Ops', items: stage2Paths, done: stage2Paths.filter((p) => progress[p.id]?.completed).length, locked: !stage1Complete },
    ];

    return (
      <div className="space-y-10">
        <div className="flex justify-end">
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:border-rose-400/60 hover:text-rose-400"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset progress
          </button>
        </div>
        {stageSections.map((section) => (
          <section key={section.stage}>
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-xl font-bold sm:text-2xl">{section.title}</h2>
              <span className="rounded-full bg-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--text-muted)]">
                {section.done}/{section.items.length} complete
              </span>
            </div>

            {section.locked ? (
              <LockedStagePanel stage1DoneCount={stage1DoneCount} stageTotal={stage1Paths.length} quizAvg={quizAvg} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {section.items.map((path) => (
                  <PathCard
                    key={path.id}
                    path={path}
                    progressEntry={progress[path.id]}
                    isRecommended={recommended?.id === path.id}
                    difficultyStyle={difficultyStyle}
                    onOpen={() => choosePath(path)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

        {allComplete && <MasteryCard commandsRunHint={lessonsRead} />}
      </div>
    );
  }

  /* ============================================================
     VIEW: lessons of one path
     ============================================================ */
  function lessonsView() {
    const path = selected;
    const entry = progress[path.id];
    const lessonsDone = entry?.lessons.length ?? 0;
    const Icon = path.icon;

    return (
      <div>
        <button
          onClick={() => setView('paths')}
          className="mb-6 inline-flex items-center gap-2 font-mono text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--terminal-green)]"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> All paths
        </button>

        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: path.color + '20' }}>
              <Icon className="h-6 w-6" style={{ color: path.color }} />
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold sm:text-3xl">{path.title}</h2>
              <p className="text-sm text-[var(--text-muted)]">{path.tagline}</p>
            </div>
            {entry?.completed && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-400">
                <Check className="h-4 w-4" /> Completed
              </span>
            )}
          </div>
          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
            {path.difficulty} · Stage {path.stage} · {lessonsDone}/{path.lessons.length} lessons read
            {entry?.bestTotal ? ` · best quiz ${Math.round((entry.bestScore / entry.bestTotal) * 100)}%` : ''}
          </p>
        </header>

        <div className="space-y-4">
          {path.lessons.map((lesson, index) => {
            const isRead = entry?.lessons.includes(String(index)) ?? false;
            return (
              <article
                key={lesson.title}
                className={`rounded-xl border p-4 transition-colors sm:p-6 ${
                  isRead ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                      Lesson {index + 1} · {lesson.title}
                    </p>
                    <p className="mt-1.5 text-sm text-[var(--text-muted)] sm:text-base">{lesson.intro}</p>
                  </div>
                  <button
                    onClick={() => toggleLesson(index)}
                    className="shrink-0 rounded-lg border border-[var(--border)] p-2 transition-colors hover:border-[var(--terminal-green)]"
                    aria-label={isRead ? `Mark lesson ${index + 1} as unread` : `Mark lesson ${index + 1} as read`}
                    title={isRead ? 'Mark as unread' : 'Mark as read'}
                  >
                    {isRead ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-[var(--text-muted)]" />}
                  </button>
                </div>
                <ul className="mt-4 space-y-2">
                  {lesson.bullets.map((line) => (
                    <li key={line} className="flex gap-2 text-sm leading-relaxed sm:text-base">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--terminal-green)]" />
                      <span className="text-[var(--text)]">{line}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  {lesson.commands.map((name) => (
                    <CommandChip key={name} name={name} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Finish line · reading all {path.lessons.length} lessons marks the path complete
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)] sm:text-base">
            Prefer to prove it the hard way instead? Quizzes cap at {MAX_QUESTIONS} questions - pass 70% to certify.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={openSetup}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--terminal-green)] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <Target className="h-4 w-4" /> Take the quiz
            </button>
            {entry?.bestTotal ? (
              <button
                onClick={openSetup}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--terminal-green)]"
              >
                <RotateCcw className="h-4 w-4" /> Try to beat {Math.round((entry.bestScore / entry.bestTotal) * 100)}%
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     VIEW: quiz setup — difficulty first, then a strict 1..10 count
     ============================================================ */
  function setupView() {
    const path = selected;
    const counts = {
      easy: path.questions.filter((q) => q.difficulty === 'easy').length,
      medium: path.questions.filter((q) => q.difficulty === 'medium').length,
      hard: path.questions.filter((q) => q.difficulty === 'hard').length,
      mixed: path.questions.length,
    };
    const filterOptions: Array<{ id: 'easy' | 'medium' | 'hard' | 'mixed'; label: string }> = [
      { id: 'mixed', label: 'Mixed (all levels)' },
      { id: 'easy', label: 'Easy' },
      { id: 'medium', label: 'Medium' },
      { id: 'hard', label: 'Hard' },
    ];

    return (
      <div>
        <button
          onClick={() => setView('lessons')}
          className="mb-6 inline-flex items-center gap-2 font-mono text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--terminal-green)]"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to lessons
        </button>

        <header className="mb-8">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Quiz · <span style={{ color: path.color }}>{path.title}</span>
          </h2>
          <p className="mt-2 text-sm text-[var(--text-muted)] sm:text-base">
            Step 1 — pick a difficulty. Step 2 — choose how many questions, up to a strict maximum of {MAX_QUESTIONS}.
          </p>
        </header>

        <section aria-label="Difficulty">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">Step 1 · difficulty</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setQuizFilter(option.id)}
                className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  quizFilter === option.id ? 'border-[var(--terminal-green)] bg-[var(--terminal-green)]/10' : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                }`}
              >
                <span className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider ${quizFilterStyle[option.id]}`}>
                  {option.label}
                </span>
                <span className="mt-2 block text-sm text-[var(--text-muted)]">{counts[option.id]} questions available</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Question count" className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">Step 2 · number of questions</p>
            <p className="font-mono text-xs text-[var(--text-muted)]">
              max {maxCount}{quizFilter !== 'mixed' ? ' at this difficulty' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="range"
              min={1}
              max={maxCount}
              step={1}
              value={effectiveCount}
              onChange={(event) => setQuizCount(Number(event.target.value))}
              className="h-2 w-full max-w-md cursor-pointer appearance-none rounded-full bg-[var(--border)] accent-[var(--terminal-green)] sm:w-auto sm:flex-1"
              aria-label="Number of quiz questions"
            />
            <span className="font-mono text-2xl font-bold text-[var(--terminal-green)]">
              {effectiveCount}<span className="text-sm text-[var(--text-muted)]">/{maxCount}</span>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: MAX_QUESTIONS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                disabled={n > maxCount}
                onClick={() => setQuizCount(n)}
                className={`h-9 w-9 rounded-lg border font-mono text-sm transition-colors ${
                  n > maxCount
                    ? 'cursor-not-allowed border-[var(--border)] text-[var(--text-muted)] opacity-40'
                    : effectiveCount === n
                      ? 'border-[var(--terminal-green)] bg-[var(--terminal-green)]/15 text-[var(--terminal-green)]'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--terminal-green)]'
                }`}
                aria-label={`Select ${n} questions`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {effectiveCount} {effectiveCount === 1 ? 'question' : 'questions'} of <span style={{ color: path.color }}>{path.title}</span> at{' '}
            <span className="uppercase tracking-wide">{quizFilter}</span> level. Hard cap: {MAX_QUESTIONS} questions per quiz.
          </p>
        </section>

        <button
          onClick={startQuiz}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--terminal-green)] px-6 py-3.5 font-semibold text-black transition-opacity hover:opacity-90 sm:w-auto"
        >
          <ZapLike /> Start quiz — {effectiveCount} question{effectiveCount === 1 ? '' : 's'}
        </button>
      </div>
    );
  }

  function ZapLike() {
    return <Target className="h-4 w-4" />;
  }

  /* ============================================================
     VIEW: quiz
     ============================================================ */
  function quizView(question: Question) {
    const isLast = step === quizQuestions.length - 1;
    const isCorrect = choice === question.answer;

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setView('lessons');
            }}
            className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--terminal-green)]"
          >
            <ChevronRight className="h-4 w-4 rotate-180" /> Quit
          </button>
          <span className={`rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wider ${quizFilterStyle[question.difficulty]}`}>
            {question.difficulty}
          </span>
        </div>

        <div className="mb-2 flex items-center justify-between font-mono text-xs text-[var(--text-muted)]">
          <span>
            Q{step + 1} / {quizQuestions.length} · score {quizScore}
          </span>
          <span>{Math.round(((step + (choice !== null ? 1 : 0)) / quizQuestions.length) * 100)}%</span>
        </div>
        <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--terminal-green)] transition-all duration-300"
            style={{ width: `${Math.round(((step + (choice !== null ? 1 : 0)) / quizQuestions.length) * 100)}%` }}
          />
        </div>

        <h2 className="text-lg font-semibold leading-relaxed sm:text-xl xl:text-2xl">{question.q}</h2>

        <div className="mt-6 grid gap-3">
          {question.options.map((option, index) => {
            const isChoice = choice === index;
            const isAnswer = question.answer === index;
            const revealed = choice !== null;
            return (
              <button
                key={option}
                disabled={revealed}
                onClick={() => answer(index)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                  revealed && isAnswer
                    ? 'border-emerald-400 bg-emerald-400/10'
                    : revealed && isChoice
                      ? 'border-rose-400 bg-rose-400/10'
                      : revealed
                        ? 'border-[var(--border)] opacity-60'
                        : 'border-[var(--border)] hover:border-[var(--terminal-green)]'
                }`}
              >
                <span className="font-mono text-xs text-[var(--text-muted)]">{String.fromCharCode(65 + index)}</span>
                <span className="text-sm sm:text-base">{option}</span>
                {revealed && isAnswer && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-emerald-400" />}
                {revealed && isChoice && !isAnswer && <span className="ml-auto text-xs font-semibold uppercase text-rose-400">your pick</span>}
              </button>
            );
          })}
        </div>

        {choice !== null && (
          <div className={`mt-5 rounded-xl border px-4 py-3 text-sm sm:text-base ${isCorrect ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-rose-400/50 bg-rose-400/10'}`}>
            {isCorrect ? '✓ Correct.' : '✗ Not quite.'}{' '}
            <span className="text-[var(--text-muted)]">Correct answer: {question.options[question.answer]}</span>
          </div>
        )}

        <button
          onClick={next}
          disabled={choice === null}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--terminal-green)] px-6 py-3 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {isLast ? 'Finish quiz' : 'Next question'} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* ============================================================
     VIEW: results + stage unlock
     ============================================================ */
  function resultsView() {
    const path = selected;
    const entry = progress[path.id];
    const total = quizQuestions.length;
    const pct = Math.round((quizScore / total) * 100);
    const passed = pct >= PASS_THRESHOLD;
    const stage2JustUnlocked = stage1Complete && path.stage === 1;
    const nextPath = stage1Complete ? stage2Paths.find((p) => !progress[p.id]?.completed) : stage1Paths.find((p) => !progress[p.id]?.completed);

    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--terminal-green)]">Quiz complete</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            {quizScore}<span className="text-xl text-[var(--text-muted)]">/{total}</span>
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)] sm:text-base">
            {passed ? `Passed - ${pct}% (pass mark ${PASS_THRESHOLD}%).` : `${pct}% - pass mark is ${PASS_THRESHOLD}%.`} Best on this path:{' '}
            {entry ? Math.round((entry.bestScore / entry.bestTotal) * 100) : pct}%.
          </p>

          {quizChoices.some((choiceValue, index) => choiceValue !== quizQuestions[index]?.answer) && (
            <ul className="mt-5 space-y-1.5 text-sm">
              {quizQuestions.map((question, index) => {
                const chosen = quizChoices[index];
                const good = chosen !== null && chosen === question.answer;
                return (
                  <li key={question.q} className="flex gap-2">
                    <span className={good ? 'text-emerald-400' : 'text-rose-400'}>{good ? '✓' : '✗'}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">{question.q}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={startQuiz}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--terminal-green)] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <RotateCcw className="h-4 w-4" /> Retake ({effectiveCount} questions)
            </button>
            <button
              onClick={openSetup}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--terminal-green)]"
            >
              Change settings
            </button>
            <button
              onClick={() => setView('lessons')}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--terminal-green)]"
            >
              Back to lessons
            </button>
            <button
              onClick={() => setView('paths')}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--terminal-green)]"
            >
              All paths
            </button>
          </div>
        </div>

        {stage2JustUnlocked && <StageUnlockHero onStart={() => choosePath(stage2Paths[0])} />}
        {!stage2JustUnlocked && nextPath && !progress[nextPath.id]?.completed && (
          <button
            onClick={() => choosePath(nextPath)}
            className="mt-5 flex w-full items-center gap-4 rounded-xl border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/5 p-5 text-left transition-colors hover:bg-[var(--terminal-green)]/10"
          >
            <nextPath.icon className="h-8 w-8 shrink-0" style={{ color: nextPath.color }} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-mono uppercase tracking-wider text-[var(--terminal-green)]">Recommended next</span>
              <span className="block font-semibold">{nextPath.title}</span>
              <span className="block text-sm text-[var(--text-muted)]">{nextPath.tagline}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-[var(--terminal-green)]" />
          </button>
        )}
      </div>
    );
  }
}

/* ============================================================
   Pieces outside the component
   ============================================================ */

function toggleLessonInProgress(progress: Progress, path: LearningPath, index: number): Progress {
  const prev = progress[path.id] ?? { completed: false, bestScore: 0, bestTotal: 0, lessons: [] };
  const lessons = prev.lessons.includes(String(index))
    ? prev.lessons.filter((id) => id !== String(index))
    : [...prev.lessons, String(index)];
  const allRead = path.lessons.every((_, i) => lessons.includes(String(i)));
  return { ...progress, [path.id]: { ...prev, lessons, completed: prev.completed || allRead } };
}

function StatCard({ label, value, bar, hint }: { label: string; value: string; bar: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] sm:text-xs">{label}</p>
      <p className="mt-1 text-2xl font-bold sm:text-3xl">{value}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <div className="h-full rounded-full bg-[var(--terminal-green)] transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, bar)) * 100)}%` }} />
      </div>
      {hint && <p className="mt-1.5 truncate text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

function PathCard({
  path,
  progressEntry,
  isRecommended,
  difficultyStyle,
  onOpen,
}: {
  path: LearningPath;
  progressEntry?: PathProgress;
  isRecommended: boolean;
  difficultyStyle: Record<string, string>;
  onOpen: () => void;
}) {
  const Icon = path.icon;
  const lessonsRead = progressEntry?.lessons.length ?? 0;
  const bestPct = progressEntry?.bestTotal ? Math.round((progressEntry.bestScore / progressEntry.bestTotal) * 100) : null;
  const allRead = lessonsRead === path.lessons.length && lessonsRead > 0;

  return (
    <button
      onClick={onOpen}
      className={`relative flex flex-col rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 ${
        isRecommended ? 'border-[var(--terminal-green)]/60 bg-[var(--terminal-green)]/5' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]/40'
      }`}
    >
      {isRecommended && (
        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-[var(--terminal-green)] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-black">
          <Sparkles className="h-3 w-3" /> Next
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: path.color + '20' }}>
          <Icon className="h-5 w-5" style={{ color: path.color }} />
        </span>
        {progressEntry?.completed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
            <Trophy className="h-3.5 w-3.5" /> Completed
          </span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-bold">{path.title}</h3>
      <p className="mt-1 line-clamp-2 flex-1 text-sm text-[var(--text-muted)]">{path.tagline}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${difficultyStyle[path.difficulty] ?? 'bg-[var(--border)] text-[var(--text-muted)]'}`}>
          {path.difficulty}
        </span>
        <span className="rounded-full bg-[var(--border)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Stage {path.stage}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: Math.round((lessonsRead / path.lessons.length) * 100) + '%', backgroundColor: path.color }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs text-[var(--text-muted)]">
        <span>
          {lessonsRead}/{path.lessons.length} lessons{allRead && !progressEntry?.completed ? ' · quiz to certify' : ''}
        </span>
        <span>{bestPct !== null ? `quiz ${bestPct}%` : `Stage ${path.stage}`}</span>
      </div>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: path.color }}>
        {progressEntry?.completed ? 'Review path' : lessonsRead ? 'Continue' : 'Start path'} <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function LockedStagePanel({ stage1DoneCount, stageTotal, quizAvg }: { stage1DoneCount: number; stageTotal: number; quizAvg: number | null }) {
  const ratio = stage1DoneCount / stageTotal;
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/60 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--border)]">
          <Lock className="h-5 w-5 text-[var(--text-muted)]" />
        </span>
        <div>
          <h3 className="text-lg font-bold text-[var(--text-muted)]">Stage 2 — Advanced Ops is locked</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Complete every Stage {1} path to gain access to {stageTotal} advanced paths: permissions, automation, services and secure ops.
          </p>
        </div>
      </div>
      <div className="mt-4 max-w-md">
        <div className="flex justify-between font-mono text-xs text-[var(--text-muted)]">
          <span>
            {stage1DoneCount}/{stageTotal} foundation paths complete
          </span>
          <span>{quizAvg !== null ? `quiz avg ${quizAvg}%` : 'no quizzes yet'}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full rounded-full bg-[var(--terminal-green)] transition-all" style={{ width: Math.round(ratio * 100) + '%' }} />
        </div>
      </div>
    </div>
  );
}

function StageUnlockHero({ onStart }: { onStart: () => void }) {
  const nextStagePath = stage2Paths[0];
  return (
    <div className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-6 text-center sm:p-8">
      <GraduationCap className="mx-auto h-10 w-10 text-emerald-400" />
      <h3 className="mt-3 text-2xl font-bold">Stage 1 complete — Stage 2 unlocked!</h3>
      <p className="mt-2 text-sm text-[var(--text-muted)] sm:text-base">
        All four foundation paths are done. {stage2Paths.length} advanced paths are now waiting: Permissions &amp; Ownership, Shell Automation,
        Services &amp; Logs, and Secure Remote Operations.
      </p>
      <button
        onClick={onStart}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
      >
        Start {nextStagePath.title} <ArrowRight className="h-4 w-4" />
      </button>
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs">
        <Link
          to="/practice-terminal"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 px-3 py-2 font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/10"
        >
          <Terminal className="h-3.5 w-3.5" /> Warm up first
        </Link>
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">Every Stage 2 path follows the same rhythm: lessons → quiz → mastery.</p>
    </div>
  );
}

function MasteryCard({ commandsRunHint }: { commandsRunHint: number }) {
  return (
    <div className="rounded-2xl border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/5 p-6 text-center sm:p-8">
      <Trophy className="mx-auto h-10 w-10 text-[var(--terminal-green)]" />
      <h3 className="mt-3 text-2xl font-bold">Every path complete - {commandsRunHint} lessons mastered</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-muted)] sm:text-base">
        This is the whole curriculum. Keep the muscle memory alive with live practice, or explain any command string to see how the pieces fit together.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          to="/practice-terminal"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--terminal-green)] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Terminal className="h-4 w-4" /> Practice terminal
        </Link>
        <Link
          to="/explain"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--terminal-green)]/50 px-4 py-2.5 text-sm font-semibold text-[var(--terminal-green)] transition-colors hover:bg-[var(--terminal-green)]/10"
        >
          <Wrench className="h-4 w-4" /> Explain a command
        </Link>
        <Link
          to="/ctf"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--terminal-green)]/50 px-4 py-2.5 text-sm font-semibold text-[var(--terminal-green)] transition-colors hover:bg-[var(--terminal-green)]/10"
        >
          <Shield className="h-4 w-4" /> CTF hub
        </Link>
      </div>
    </div>
  );
}

/* ---- command chip: links into the authed catalog whenever possible ---- */
function CommandChip({ name }: { name: string }) {
  // Chip linking only needs the light index (slug/name/section) — no doc fetch.
  const { lights } = useCatalog();
  const light = lights.find((l) => l.slug === name || l.name.toLowerCase() === name.toLowerCase());
  if (!light) {
    return <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-xs text-[var(--text-muted)]">{name}</span>;
  }
  const isCTF = light.section === 'ctf';
  return (
    <Link
      to={getPathForLight(light)}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs transition-colors hover:opacity-80"
      style={{
        borderColor: (isCTF ? '#f87171' : '#22c55e') + '55',
        color: isCTF ? '#f87171' : '#22c55e',
        backgroundColor: (isCTF ? '#f87171' : '#22c55e') + '12',
      }}
    >
      {name}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

export default LearningPage;
