export function isMinor(dob: string, asOf: Date = new Date()): boolean {
  const birthDate = new Date(dob);
  const eighteenthBirthday = new Date(
    birthDate.getFullYear() + 18,
    birthDate.getMonth(),
    birthDate.getDate(),
  );
  return asOf < eighteenthBirthday;
}
