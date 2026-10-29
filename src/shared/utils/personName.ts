const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?:[ '\u2019-]\p{L}[\p{L}\p{M}]*)*$/u;

export function isValidPersonName(value: string): boolean {
  const name = value.trim();
  const length = Array.from(name).length;
  return length >= 2 && length <= 160 && PERSON_NAME_PATTERN.test(name);
}
