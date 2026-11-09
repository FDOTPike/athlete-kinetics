/**
 * #177: in Coach mode (two or more athletes on this phone) Today and Profile
 * name the active athlete, so a coach can see whose plan is shown after a
 * switch. With a single athlete nothing is named.
 */
export interface NamedAthlete {
  id: string;
  name: string;
}

export function coachModeAthleteName(
  athletes: readonly NamedAthlete[] | null | undefined,
  activeAthleteId: string | null | undefined,
): string | null {
  if (athletes == null || athletes.length < 2 || activeAthleteId == null) return null;
  const active = athletes.find((a) => a.id === activeAthleteId);
  const name = active?.name.trim() ?? '';
  return name.length > 0 ? name : null;
}
