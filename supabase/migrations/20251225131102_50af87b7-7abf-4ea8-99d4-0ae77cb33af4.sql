
-- Adicionar tag "scale lançamento" a todos os leads da sub-origem Entrada
INSERT INTO lead_tags (lead_id, name, color)
SELECT l.id, 'scale lançamento', '#ef4444'
FROM leads l
WHERE l.sub_origin_id = '00000000-0000-0000-0000-000000000002'
AND l.id NOT IN (
  SELECT lead_id FROM lead_tags WHERE LOWER(name) = 'scale lançamento'
);
