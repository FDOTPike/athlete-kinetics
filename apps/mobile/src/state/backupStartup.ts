/** Keep normal athlete data closed unless recovery initialization explicitly
 * succeeds. Rejections propagate for the root caller to report separately. */
export async function bootAfterSafeRecovery(
  initialize: () => Promise<boolean>,
  authorizeBoot: () => void,
  boot: () => void,
): Promise<boolean> {
  if (!(await initialize())) return false;
  authorizeBoot();
  boot();
  return true;
}
