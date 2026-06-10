export { DB_NAME, closeKineticsDb, openKineticsDb, setInferenceMode } from './pragmas';
export { migrate } from './migrations';

import m004 from './schema/004_state_vector_materialize.sql';

/** The parameterized daily State Vector upsert (bind ?1 = 'YYYY-MM-DD').
 *  Comment-only lines stripped so it prepares as a single statement. */
export const MATERIALIZE_STATE_VECTOR_SQL: string = m004.replace(/^--.*$/gm, '');
