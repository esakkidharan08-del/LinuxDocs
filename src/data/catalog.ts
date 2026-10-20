import type { Command } from '../types';
export const getPathForCommand = (command: Command) => command.section === 'linux' ? `/linux/${command.category}/${command.slug}` : `/ctf/${command.category}/${command.slug}`;
