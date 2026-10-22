import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'src', 'data', 'commands.ts');
const outputPath = path.join(root, 'backend', 'data', 'commands.json');
const source = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
  .replace(/^import .*\n/m, '')
  .replaceAll('export const ', 'const ')
  .replaceAll('export function ', 'function ');
const sandbox = {};
vm.runInNewContext(`${source}\nresult = { categories: LINUX_CATEGORIES, domains: CTF_DOMAINS, commands: COMMANDS };`, sandbox);

const permissions = [
  {
    slug: 'chmod', name: 'chmod', category: 'permissions-and-ownership', section: 'linux',
    summary: 'Change file mode bits and permissions.', syntax: 'chmod [OPTION]... MODE[,MODE]... FILE...',
    description: 'Change the access permissions of each FILE according to MODE, using symbolic or octal notation.',
    options: [
      { flag: '-R', description: 'Change files and directories recursively.', example: 'chmod -R u+rwX,go+rX project/' },
      { flag: '--reference=RFILE', description: 'Use the mode of RFILE instead of MODE.', example: 'chmod --reference=template.conf app.conf' }
    ],
    examples: [
      { title: 'Add execute permission for the owner', command: 'chmod u+x deploy.sh', output: '', explanation: 'Allows the file owner to execute the deployment script.' },
      { title: 'Set a private key to owner-read only', command: 'chmod 600 id_ed25519', output: '', explanation: 'Restricts the key to its owner, as SSH expects.' },
      { title: 'Make a project tree readable and traversable', command: 'chmod -R u+rwX,go+rX project/', output: '', explanation: 'Adds owner write access and read/traverse access for other users.' }
    ],
    useCases: ['Securing private keys', 'Making scripts executable', 'Applying permissions to a project tree'],
    related: ['chown', 'chgrp', 'umask', 'ls'], tags: ['permissions', 'mode', 'security']
  },
  {
    slug: 'chown', name: 'chown', category: 'permissions-and-ownership', section: 'linux',
    summary: 'Change file owner and group.', syntax: 'chown [OPTION]... [OWNER][:[GROUP]] FILE...',
    description: 'Change the user and optionally the group ownership of each FILE.',
    options: [
      { flag: '-R', description: 'Operate on files and directories recursively.', example: 'chown -R www-data:www-data /srv/www' },
      { flag: '--reference=RFILE', description: 'Use the owner and group of RFILE.', example: 'chown --reference=template.conf app.conf' }
    ],
    examples: [
      { title: 'Assign a web directory to its service account', command: 'sudo chown -R www-data:www-data /srv/www', output: '', explanation: 'Transfers ownership of the document root to the web service account.' },
      { title: 'Change only the owner', command: 'sudo chown alice report.txt', output: '', explanation: 'Changes the user owner while retaining the existing group.' },
      { title: 'Change only the group', command: 'sudo chown :developers build.log', output: '', explanation: 'Assigns the file to the developers group without changing its owner.' }
    ],
    useCases: ['Assigning service directory ownership', 'Repairing ownership after extraction', 'Sharing files with a group'],
    related: ['chmod', 'chgrp', 'ls', 'getfacl'], tags: ['ownership', 'users', 'groups']
  },
  {
    slug: 'chgrp', name: 'chgrp', category: 'permissions-and-ownership', section: 'linux',
    summary: 'Change the group ownership of files.', syntax: 'chgrp [OPTION]... GROUP FILE...',
    description: 'Change the group ownership of each FILE to GROUP.',
    options: [
      { flag: '-R', description: 'Operate on files and directories recursively.', example: 'chgrp -R developers shared/' },
      { flag: '--reference=RFILE', description: 'Use the group of RFILE.', example: 'chgrp --reference=template.conf app.conf' }
    ],
    examples: [
      { title: 'Share a file with a team', command: 'chgrp developers design.md', output: '', explanation: 'Sets the file group to developers.' },
      { title: 'Update a shared directory', command: 'sudo chgrp -R developers /srv/project', output: '', explanation: 'Changes group ownership throughout the project tree.' },
      { title: 'Copy a reference group', command: 'chgrp --reference=README.md notes.txt', output: '', explanation: 'Uses the group owner of README.md for notes.txt.' }
    ],
    useCases: ['Maintaining team-shared files', 'Preparing group-based access', 'Repairing extracted archive ownership'],
    related: ['chown', 'chmod', 'getfacl', 'ls'], tags: ['groups', 'ownership', 'sharing']
  },
  {
    slug: 'umask', name: 'umask', category: 'permissions-and-ownership', section: 'linux',
    summary: 'Set the default file creation permission mask.', syntax: 'umask [-p] [-S] [mode]',
    description: 'Set or display the file mode creation mask used by the shell for newly created files and directories.',
    options: [
      { flag: '-S', description: 'Print the mask in symbolic form.', example: 'umask -S' },
      { flag: '-p', description: 'Print the mask in a reusable shell command form.', example: 'umask -p' }
    ],
    examples: [
      { title: 'Display the current mask', command: 'umask', output: '0022', explanation: 'Shows the octal mask applied to new files and directories.' },
      { title: 'Use a private default', command: 'umask 077', output: '', explanation: 'Makes newly created files private to the current user by default.' },
      { title: 'Inspect symbolic permissions', command: 'umask -S', output: 'u=rwx,g=rx,o=rx', explanation: 'Displays the effective default permission mask symbolically.' }
    ],
    useCases: ['Setting secure shell defaults', 'Protecting newly created credentials', 'Configuring login profiles'],
    related: ['chmod', 'touch', 'mkdir', 'stat'], tags: ['permissions', 'defaults', 'shell']
  },
  {
    slug: 'setfacl', name: 'setfacl', category: 'permissions-and-ownership', section: 'linux',
    summary: 'Modify access control lists for files and directories.', syntax: 'setfacl [OPTION]... { -m | -M } ACL... FILE...',
    description: 'Sets or removes extended ACL entries without replacing the traditional owner, group, and mode model.',
    options: [
      { flag: '-m', description: 'Modify or add ACL entries.', example: 'setfacl -m u:alice:rw report.csv' },
      { flag: '-x', description: 'Remove ACL entries.', example: 'setfacl -x u:alice report.csv' },
      { flag: '-R', description: 'Apply changes recursively.', example: 'setfacl -R -m g:developers:rX project/' }
    ],
    examples: [
      { title: 'Grant one user read/write access', command: 'setfacl -m u:alice:rw report.csv', output: '', explanation: 'Adds an ACL entry for Alice without changing the owning group.' },
      { title: 'Grant a group directory access', command: 'setfacl -R -m g:developers:rX project/', output: '', explanation: 'Gives developers read and directory traversal access throughout the tree.' },
      { title: 'Remove a user ACL', command: 'setfacl -x u:alice report.csv', output: '', explanation: 'Removes Alice’s named ACL entry.' }
    ],
    useCases: ['Fine-grained shared access', 'Granting exceptions to standard modes', 'Managing project directory permissions'],
    related: ['getfacl', 'chmod', 'chown', 'chgrp'], tags: ['acl', 'permissions', 'access-control']
  },
  {
    slug: 'getfacl', name: 'getfacl', category: 'permissions-and-ownership', section: 'linux',
    summary: 'Display file access control lists.', syntax: 'getfacl [OPTION]... FILE...',
    description: 'Prints the access ACL and default ACL for each FILE, including the effective permissions after mask calculation.',
    options: [
      { flag: '-R', description: 'List ACLs recursively.', example: 'getfacl -R project/' },
      { flag: '-e', description: 'Print all effective rights, including rights masked by the ACL mask.', example: 'getfacl -e report.csv' }
    ],
    examples: [
      { title: 'Inspect a file ACL', command: 'getfacl report.csv', output: '# file: report.csv\n# owner: alice\n# group: developers\nuser::rw-\ngroup::r--\nmask::rw-\nother::---', explanation: 'Shows owner, group, named entries, and the ACL mask.' },
      { title: 'Inspect a project tree', command: 'getfacl -R project/', output: '# file: project/\n# owner: alice\n# group: developers\nuser::rwx\ngroup::r-x\nother::---', explanation: 'Reports ACLs for every item below project.' },
      { title: 'Show effective rights', command: 'getfacl -e report.csv', output: 'user:alice:rw-\nuser:bob:r--\nmask::rw-', explanation: 'Includes effective permissions after the mask is applied.' }
    ],
    useCases: ['Auditing shared access', 'Verifying setfacl changes', 'Troubleshooting unexpected permissions'],
    related: ['setfacl', 'ls', 'stat', 'chmod'], tags: ['acl', 'audit', 'permissions']
  },
  {
    slug: 'chattr', name: 'chattr', category: 'permissions-and-ownership', section: 'linux',
    summary: 'Change extended filesystem attributes.', syntax: 'chattr [ -RVf ] [ -+=AacdeijPsStu ] file...',
    description: 'Changes Linux filesystem attributes on ext-family filesystems and other filesystems that support them.',
    options: [
      { flag: '-R', description: 'Recursively change attributes.', example: 'sudo chattr -R +i archive/' },
      { flag: '+i', description: 'Set the immutable attribute.', example: 'sudo chattr +i release.txt' },
      { flag: '-i', description: 'Clear the immutable attribute.', example: 'sudo chattr -i release.txt' }
    ],
    examples: [
      { title: 'Protect a release file', command: 'sudo chattr +i release.txt', output: '', explanation: 'Marks the file immutable until the attribute is cleared.' },
      { title: 'Allow updates again', command: 'sudo chattr -i release.txt', output: '', explanation: 'Clears the immutable attribute.' },
      { title: 'Protect an archive tree', command: 'sudo chattr -R +i archive/', output: '', explanation: 'Sets immutable on each item in the archive tree.' }
    ],
    useCases: ['Protecting audit artifacts', 'Preventing accidental changes', 'Investigating filesystem attributes'],
    related: ['lsattr', 'chmod', 'stat', 'sudo'], tags: ['filesystem', 'attributes', 'immutable']
  },
  {
    slug: 'lsattr', name: 'lsattr', category: 'permissions-and-ownership', section: 'linux',
    summary: 'List extended filesystem attributes.', syntax: 'lsattr [ -RVadlpv ] [ files... ]',
    description: 'Displays the filesystem attributes of files and directories on supported filesystems.',
    options: [
      { flag: '-R', description: 'Recursively list attributes.', example: 'lsattr -R archive/' },
      { flag: '-d', description: 'List directory attributes rather than directory contents.', example: 'lsattr -d archive/' }
    ],
    examples: [
      { title: 'Inspect a file', command: 'lsattr release.txt', output: '----i---------e---- release.txt', explanation: 'Shows immutable and extent-related attributes when present.' },
      { title: 'Inspect a directory itself', command: 'lsattr -d archive/', output: '------------------ archive/', explanation: 'Reports attributes on the directory entry.' },
      { title: 'Inspect a tree', command: 'lsattr -R archive/', output: 'archive/:\n------------------ archive/2026.log', explanation: 'Lists attributes recursively below archive.' }
    ],
    useCases: ['Auditing immutable files', 'Checking filesystem metadata', 'Verifying chattr operations'],
    related: ['chattr', 'stat', 'ls', 'getfacl'], tags: ['filesystem', 'attributes', 'audit']
  }
];
const existingSlugs = new Set(sandbox.result.commands.map((command) => command.slug));
const files = JSON.parse(fs.readFileSync(path.join(root, 'backend', 'data', 'batch2.json'), 'utf8'))
  .filter((command) => !existingSlugs.has(command.slug));
const text = JSON.parse(fs.readFileSync(path.join(root, 'backend', 'data', 'batch3.json'), 'utf8'))
  .filter((command) => !existingSlugs.has(command.slug));

const categories = sandbox.result.categories;
const domains = sandbox.result.domains;
// Permission entries now live in src/data/commands.ts as well; keep the inline
// literal only as a fallback source so slugs are never duplicated.
const permissionEntries = permissions.filter((command) => !existingSlugs.has(command.slug));
const commands = [...sandbox.result.commands.filter((command) => command.section === 'linux' || command.section === 'ctf'), ...permissionEntries, ...files, ...text];

// Guard against duplicate slugs reaching the generated dataset.
{
  const seen = new Set();
  const dupes = [];
  for (const command of commands) {
    if (seen.has(command.slug)) dupes.push(command.slug);
    seen.add(command.slug);
  }
  if (dupes.length > 0) {
    throw new Error(`build_commands produced duplicate slugs: ${[...new Set(dupes)].join(', ')}`);
  }
}

const knownSlugs = new Set(commands.map((command) => command.slug));
const needsHumanReview = [];
for (const command of commands) {
  command.related = command.related.filter((slug) => knownSlugs.has(slug));
  if (command.examples.length < 3 || command.options.length === 0 || command.useCases.length === 0 || command.tags.length === 0) {
    needsHumanReview.push(command.slug);
  }
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({ categories, domains, commands, needsHumanReview }, null, 2) + '\n');
