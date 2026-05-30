export function pickRandom<T>(items: T[]): T {
  if (!items.length) {
    throw new Error('Cannot pick from an empty list.');
  }

  return items[Math.floor(Math.random() * items.length)];
}
