-- 024_phase17_equipment_fixes.sql
-- Fixes equipment mismatches found in Phase 17 Hermes Audit.
-- Dumbbell Bench Press: [BB, DB] -> [DB]
-- Dumbbell Shoulder Press: [BB, DB] -> [DB]
-- Pallof Press: [Cable, Banded] -> [Banded] to match the canonical band's equipment row.
-- A cable version needs a separate equipment-distinct movement record.

UPDATE movement_detail 
SET supported_prefixes = '["DB"]' 
WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Bench Press');

UPDATE movement_detail 
SET supported_prefixes = '["DB"]' 
WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Dumbbell Shoulder Press');

UPDATE movement_detail 
SET supported_prefixes = '["Banded"]' 
WHERE movement_id = (SELECT movement_id FROM movement WHERE name = 'Pallof Press');
