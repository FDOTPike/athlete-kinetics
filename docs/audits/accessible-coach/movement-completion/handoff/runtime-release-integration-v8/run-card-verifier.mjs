import {pathToFileURL} from 'node:url';
const base='C:/Users/fpike/.codex/visualizations/2026/10/04/01a10600-ce62-7120-b660-90110f93f889/audit/motion-completion';
process.argv=[process.argv[0],base+'/runtime-release-integration-v8/verify-cards-external.mjs',...[143,53,82,138,163,92,158,253,80,262,292,264,49,178,220,84,52].map(id=>base+'/cards-release-integration-v8/movement-'+id)];
await import(pathToFileURL(base+'/runtime-release-integration-v8/verify-cards-external.mjs'));
