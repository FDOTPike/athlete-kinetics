import { bootAfterSafeRecovery } from '../../src/state/backupStartup';
import {
  acquireDataMaintenanceLock,
  athleteDataBootAllowed,
  authorizeAthleteDataBoot,
  dataMutationAllowed,
  requireDataMutationAllowed,
  resetDataMaintenanceLockForTests,
} from '../../src/state/dataMaintenanceLock';

beforeEach(() => resetDataMaintenanceLockForTests());

test('failed restore recovery keeps normal athlete boot closed', async () => {
  const boot = jest.fn();
  await expect(bootAfterSafeRecovery(async () => false, authorizeAthleteDataBoot, boot)).resolves.toBe(false);
  expect(boot).not.toHaveBeenCalled();
  expect(athleteDataBootAllowed()).toBe(false);
  await expect(bootAfterSafeRecovery(async () => { throw new Error('invalid journal'); }, authorizeAthleteDataBoot, boot)).rejects.toThrow('invalid journal');
  expect(boot).not.toHaveBeenCalled();
});

test('maintenance lock rejects a mutation between athlete snapshots and releases afterward', async () => {
  const release = acquireDataMaintenanceLock('test-all-athlete-snapshot');
  try {
    expect(dataMutationAllowed()).toBe(false);
    await Promise.resolve(); // boundary between sequential athlete snapshots
    expect(() => requireDataMutationAllowed()).toThrow(/temporarily locked/);
    authorizeAthleteDataBoot();
    expect(athleteDataBootAllowed()).toBe(false);
  } finally {
    release();
  }
  expect(dataMutationAllowed()).toBe(true);
  expect(() => requireDataMutationAllowed()).not.toThrow();
});
