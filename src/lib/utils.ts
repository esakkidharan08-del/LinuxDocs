/** Minimal class-name joiner (shadcn-style `cn` without extra dependencies). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}