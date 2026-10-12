export type Section = 'linux' | 'ctf';

export interface CommandOption {
  flag: string;
  description: string;
  example?: string;
}

export interface CommandExample {
  title: string;
  command: string;
  output: string;
  explanation: string;
}

export interface Command {
  slug: string;
  name: string;
  category: string;
  section: Section;
  summary: string;
  syntax: string;
  description: string;
  options: CommandOption[];
  examples: CommandExample[];
  useCases: string[];
  related: string[]; // slugs
  tags: string[];
  notes?: string;
  warnings?: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
  section: Section;
  description: string;
  iconName?: string;
}

export interface CTFDomainInfo {
  id: string;
  name: string;
  description: string;
  tools: string[];
  recommendedExternalTools: { name: string; url: string; description: string }[];
}
