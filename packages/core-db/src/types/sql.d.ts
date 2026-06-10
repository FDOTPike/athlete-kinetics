/** Raw-string .sql imports (bundled via babel-plugin-inline-import on device,
 *  resolved by tsconfig include for type-checking). */
declare module '*.sql' {
  const sql: string;
  export default sql;
}
