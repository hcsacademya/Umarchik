// Asboblar (tools/*.ts) ishlatadigan Node modullari uchun eng kerakli turlar (@types/node o'rnatmasdan)
declare const process: { argv: string[] };
declare module 'node:child_process' {
  export function execFileSync(file: string, args: string[], opts?: { stdio?: 'inherit' }): { toString(): string };
}
declare module 'node:fs' {
  export function readFileSync(path: string, enc: 'utf8'): string;
  export function writeFileSync(path: string, data: string): void;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}
