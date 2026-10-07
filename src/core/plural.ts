/** A count with its noun: `1 column`, `3 columns`. Pass `many` when the plural is not the noun plus "s". */
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
