export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fromPaise(paisa: number): number {
  return paisa / 100;
}
