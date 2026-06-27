
INSERT INTO lead_tags (lead_id, name, color)
SELECT l.id, 'Ebook power', '#f59e0b'
FROM leads l
JOIN crm_sub_origins so ON l.sub_origin_id = so.id
JOIN crm_origins o ON so.origin_id = o.id
WHERE o.nome ILIKE '%Lançamento Janeiro%' 
AND so.nome ILIKE '%Ebook Power%'
AND NOT EXISTS (
  SELECT 1 FROM lead_tags lt 
  WHERE lt.lead_id = l.id AND lt.name = 'Ebook power'
);
