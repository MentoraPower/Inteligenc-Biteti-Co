
INSERT INTO lead_tags (lead_id, name, color)
SELECT l.id, 'Planejamento 2026', '#f97316'
FROM leads l
JOIN crm_sub_origins so ON l.sub_origin_id = so.id
WHERE so.nome ILIKE '%Planejamento%'
AND NOT EXISTS (
  SELECT 1 FROM lead_tags lt 
  WHERE lt.lead_id = l.id AND lt.name = 'Planejamento 2026'
);
