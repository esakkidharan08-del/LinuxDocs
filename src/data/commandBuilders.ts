export type BuilderField = {
  id: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
};

export type BuilderFlag = {
  flag: string;
  label: string;
  explanation: string;
};

export type BuilderSpec = {
  fields: BuilderField[];
  flags: BuilderFlag[];
  build: (values: Record<string, string>, flags: Set<string>) => string;
  explain: (values: Record<string, string>, flags: Set<string>) => string[];
};

const value = (values: Record<string, string>, id: string, fallback: string) => values[id]?.trim() || fallback;

export const commandBuilderSpecs: Record<string, BuilderSpec> = {
  grep: {
    fields: [{ id: 'pattern', label: 'Pattern', placeholder: 'error' }, { id: 'file', label: 'File or directory', placeholder: 'app.log' }],
    flags: [
      { flag: '-i', label: 'Ignore case', explanation: 'matches upper- and lowercase text' },
      { flag: '-n', label: 'Line numbers', explanation: 'prints the matching line number' },
      { flag: '-r', label: 'Recursive', explanation: 'searches directories recursively' },
      { flag: '-v', label: 'Invert match', explanation: 'prints lines that do not match' }
    ],
    build: (v, f) => `grep ${[...f].join(' ')} "${value(v, 'pattern', 'PATTERN')}" ${value(v, 'file', 'FILE')}`,
    explain: (v, f) => [`Searches ${value(v, 'file', 'the selected file')} for ${value(v, 'pattern', 'the supplied pattern')}.`, ...[...f].map((flag) => commandBuilderSpecs.grep.flags.find((item) => item.flag === flag)?.explanation || '')]
  },
  find: {
    fields: [{ id: 'path', label: 'Starting path', placeholder: '.' }, { id: 'name', label: 'Name pattern', placeholder: '*.log' }],
    flags: [{ flag: '-type f', label: 'Files only', explanation: 'limits results to regular files' }, { flag: '-type d', label: 'Directories only', explanation: 'limits results to directories' }, { flag: '-maxdepth 2', label: 'Depth 2', explanation: 'stops after two directory levels' }],
    build: (v, f) => `find ${value(v, 'path', '.')} ${[...f].join(' ')} -name "${value(v, 'name', '*') }"`,
    explain: (v, f) => [`Walks ${value(v, 'path', 'the current directory')} and matches names like ${value(v, 'name', '*')}.`, ...[...f].map((flag) => flag === '-type f' ? 'returns regular files only' : flag === '-type d' ? 'returns directories only' : 'limits traversal depth')]
  },
  tar: {
    fields: [{ id: 'archive', label: 'Archive', placeholder: 'backup.tar.gz' }, { id: 'path', label: 'Path', placeholder: 'project/' }],
    flags: [{ flag: '-c', label: 'Create', explanation: 'creates a new archive' }, { flag: '-x', label: 'Extract', explanation: 'extracts archive contents' }, { flag: '-t', label: 'List', explanation: 'lists archive contents' }, { flag: '-z', label: 'gzip', explanation: 'uses gzip compression' }, { flag: '-v', label: 'Verbose', explanation: 'lists files as they are processed' }],
    build: (v, f) => `tar ${[...f].join(' ')} -f ${value(v, 'archive', 'archive.tar')} ${value(v, 'path', '.')}`,
    explain: (v, f) => [`Operates on ${value(v, 'archive', 'the archive')}.`, ...[...f].map((flag) => commandBuilderSpecs.tar.flags.find((item) => item.flag === flag)?.explanation || '')]
  },
  chmod: {
    fields: [{ id: 'mode', label: 'Mode', placeholder: 'u+x' }, { id: 'path', label: 'Path', placeholder: 'script.sh' }],
    flags: [{ flag: '-R', label: 'Recursive', explanation: 'applies the mode through a directory tree' }],
    build: (v, f) => `chmod ${[...f].join(' ')} ${value(v, 'mode', 'MODE')} ${value(v, 'path', 'FILE')}`,
    explain: (v, f) => [`Changes permissions on ${value(v, 'path', 'the selected path')} using ${value(v, 'mode', 'the selected mode')}.`, ...(f.has('-R') ? ['applies the change recursively'] : [])]
  },
  curl: {
    fields: [{ id: 'url', label: 'URL', placeholder: 'https://example.test' }],
    flags: [{ flag: '-I', label: 'Headers only', explanation: 'requests response headers without the body' }, { flag: '-L', label: 'Follow redirects', explanation: 'follows HTTP redirects' }, { flag: '-s', label: 'Silent', explanation: 'hides the progress meter' }, { flag: '-X POST', label: 'POST', explanation: 'uses the POST method' }],
    build: (v, f) => `curl ${[...f].join(' ')} ${value(v, 'url', 'URL')}`,
    explain: (v, f) => [`Requests ${value(v, 'url', 'the selected URL')}.`, ...[...f].map((flag) => commandBuilderSpecs.curl.flags.find((item) => item.flag === flag)?.explanation || '')]
  },
  nmap: {
    fields: [{ id: 'target', label: 'Target', placeholder: '192.0.2.10' }],
    flags: [{ flag: '-sV', label: 'Version detection', explanation: 'probes open ports for service versions' }, { flag: '-sC', label: 'Default scripts', explanation: 'runs the default NSE scripts' }, { flag: '-p-', label: 'All ports', explanation: 'scans all TCP ports' }, { flag: '-O', label: 'OS detection', explanation: 'attempts operating system detection' }],
    build: (v, f) => `nmap ${[...f].join(' ')} ${value(v, 'target', 'TARGET')}`,
    explain: (v, f) => [`Scans the authorized target ${value(v, 'target', 'TARGET')}.`, ...[...f].map((flag) => commandBuilderSpecs.nmap.flags.find((item) => item.flag === flag)?.explanation || '')]
  },
  ssh: {
    fields: [{ id: 'user', label: 'User', placeholder: 'alice' }, { id: 'host', label: 'Host', placeholder: 'server.example.test' }, { id: 'port', label: 'Port', placeholder: '22' }],
    flags: [{ flag: '-o StrictHostKeyChecking=yes', label: 'Strict host checking', explanation: 'requires a trusted known-host key' }, { flag: '-v', label: 'Verbose', explanation: 'prints connection diagnostics' }],
    build: (v, f) => `ssh -p ${value(v, 'port', '22')} ${[...f].join(' ')} ${value(v, 'user', 'USER')}@${value(v, 'host', 'HOST')}`,
    explain: (v, f) => [`Opens an SSH session to ${value(v, 'user', 'USER')}@${value(v, 'host', 'HOST')} on port ${value(v, 'port', '22')}.`, ...[...f].map((flag) => commandBuilderSpecs.ssh.flags.find((item) => item.flag === flag)?.explanation || '')]
  },
  rsync: {
    fields: [{ id: 'source', label: 'Source', placeholder: 'project/' }, { id: 'destination', label: 'Destination', placeholder: 'server:/srv/project/' }],
    flags: [{ flag: '-a', label: 'Archive', explanation: 'preserves common metadata recursively' }, { flag: '-v', label: 'Verbose', explanation: 'lists transferred items' }, { flag: '--delete', label: 'Delete extras', explanation: 'removes destination files absent from the source' }, { flag: '-n', label: 'Dry run', explanation: 'shows changes without applying them' }],
    build: (v, f) => `rsync ${[...f].join(' ')} ${value(v, 'source', 'SOURCE')} ${value(v, 'destination', 'DESTINATION')}`,
    explain: (v, f) => [`Synchronizes ${value(v, 'source', 'the source')} to ${value(v, 'destination', 'the destination')}.`, ...[...f].map((flag) => commandBuilderSpecs.rsync.flags.find((item) => item.flag === flag)?.explanation || '')]
  },
  awk: {
    fields: [{ id: 'program', label: 'Program', placeholder: '{print $1}' }, { id: 'file', label: 'File', placeholder: 'data.txt' }],
    flags: [{ flag: '-F:', label: 'Colon delimiter', explanation: 'splits input fields at colons' }, { flag: '-v OFS=,', label: 'Comma output', explanation: 'sets the output field separator to a comma' }],
    build: (v, f) => `awk ${[...f].join(' ')} '${value(v, 'program', '{print $0}')}' ${value(v, 'file', 'FILE')}`,
    explain: (v, f) => [`Runs the awk program ${value(v, 'program', '{print $0}')} for each input record.`, ...[...f].map((flag) => commandBuilderSpecs.awk.flags.find((item) => item.flag === flag)?.explanation || '')]
  },
  sed: {
    fields: [{ id: 'expression', label: 'Expression', placeholder: 's/old/new/g' }, { id: 'file', label: 'File', placeholder: 'config.txt' }],
    flags: [{ flag: '-n', label: 'Quiet output', explanation: 'suppresses automatic printing' }, { flag: '-i', label: 'Edit in place', explanation: 'writes changes back to the file' }],
    build: (v, f) => `sed ${[...f].join(' ')} '${value(v, 'expression', 'EXPRESSION')}' ${value(v, 'file', 'FILE')}`,
    explain: (v, f) => [`Applies ${value(v, 'expression', 'the expression')} to each line of ${value(v, 'file', 'the input')}.`, ...[...f].map((flag) => commandBuilderSpecs.sed.flags.find((item) => item.flag === flag)?.explanation || '')]
  }
};
