export { DB_NAME, closeKineticsDb, openKineticsDb, setInferenceMode } from './pragmas';
export { migrate } from './migrations';
export {
  DEMO_DAYS,
  SPO2_FOLD_SQL,
  SPO2_TRIM_SQL,
  demoDates,
  generateDemoHistory,
  type DemoReport,
  type DemoSql,
} from './demoData';

import m004 from './schema/004_state_vector_materialize.sql';

/** The parameterized daily State Vector upsert (bind ?1 = 'YYYY-MM-DD').
 *  Comment-only lines stripped so it prepares as a single statement. */
export const MATERIALIZE_STATE_VECTOR_SQL: string = m004.replace(/^--.*$/gm, '');
