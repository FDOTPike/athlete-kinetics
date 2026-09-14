import { bootAfterSafeRecovery } from '../../src/state/backupStartup';
import {
  acquireDataMaintenanceLock,
  authorizeAthleteDataBoot,
  resetDataMaintenanceLockForTests,
} from '../../src/state/dataMaintenanceLock';
import { useStore } from '../../src/state/useStore';

const mockOpen = jest.fn();
const mockLoadRegistry = jest.fn();

jest.mock('@op-engineering/op-sqlite', () => ({ open: (...args) => mockOpen(...args) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: (...args) => mockLoadRegistry(...args),
  saveRegistry: jest.fn(async () => false),
}));

beforeEach(() => {
  resetDataMaintenanceLockForTests();
  mockOpen.mockReset();
  mockLoadRegistry.mockReset();
  useStore.setState({ status: 'booting', error: null });
});

test('failed startup recovery cannot be bypassed by a later store boot call', async () => {
  const initialBoot = jest.fn();
  await expect(bootAfterSafeRecovery(async () => false, authorizeAthleteDataBoot, initialBoot)).resolves.toBe(false);
  useStore.getState().boot();
  await Promise.resolve();
  expect(initialBoot).not.toHaveBeenCalled();
  expect(mockLoadRegistry).not.toHaveBeenCalled();
  expect(mockOpen).not.toHaveBeenCalled();
});

test('maintenance lock centrally prevents registry load and database open', async () => {
  authorizeAthleteDataBoot();
  const release = acquireDataMaintenanceLock('integration-snapshot');
  try {
    useStore.getState().boot();
    await Promise.resolve();
    expect(mockLoadRegistry).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  } finally {
    release();
  }
});
