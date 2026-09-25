// These are pronunciation changes only; the displayed coaching copy remains untouched.
const pronunciation: Readonly<Record<string, string>> = {
  RPE: 'R P E',
  RIR: 'R I R',
  RDL: 'Romanian deadlift',
  DB: 'dumbbell',
  KB: 'kettlebell',
  'e.g.': 'for example',
};

export function toSpokenText(displayed: string): string {
  return displayed
    .replace(/(^|\n)(\s*)(\d+)\.\s*(?:•\s*)?/g, (_match, start: string, indent: string, number: string) =>
      `${start}${indent}Step ${number}. `)
    .replace(/(^|\n)(\s*)•\s*/g, '$1$2')
    .replace(/(^|[^\w])(?:RPE|RIR|RDL|DB|KB|e\.g\.)(?=$|[^\w])/gi,
      (match: string, prefix: string) => `${prefix}${pronunciation[match.slice(prefix.length).toUpperCase()] ?? pronunciation['e.g.']}`);
}
