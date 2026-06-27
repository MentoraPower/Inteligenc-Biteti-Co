
-- Copiar campos personalizados de "Rev. Power Academy" para "CHECKIN" (Power Academy)
-- MANTENDO os mesmos IDs para compatibilidade com webhook

INSERT INTO sub_origin_custom_fields (id, sub_origin_id, field_key, field_label, field_type, options, ordem, is_required)
VALUES
  ('de99f37b-0be0-4bb5-aa36-f8dc5d7bbfc5', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'qual_seu_nicho_de_atuacao_na_area_da_beleza', 'Qual seu nicho de atuação na área da beleza?', 'text', NULL, 1, false),
  ('cd2f5c58-9786-489f-8c49-e83939855fd6', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'a_quanto_tempo_voce_acompanha_a_biteti_no_instagram', 'A quanto tempo você acompanha a Biteti no Instagram?', 'text', NULL, 2, false),
  ('7915053c-bda3-4f39-ad37-f164d08d5d7c', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'tem_seu_proprio_espaco', 'Tem seu próprio espaço?', 'text', NULL, 3, false),
  ('55a97204-78a2-4a87-b382-dde85a584df7', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'qual_seu_faturamento_mensal_atualmente', 'Qual seu faturamento mensal atualmente?', 'text', NULL, 4, false),
  ('99c89333-b8ea-424e-a071-4b6eb7c51151', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'qual_o_faturamento_dos_seus_sonhos', 'Qual o faturamento dos seus sonhos?', 'number', NULL, 5, false),
  ('af0c761e-2731-426b-9d90-0a12d8676a48', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'alem_de_dinheiro_o_que_voce_mais_quer_conquistar_pode_ser_pessoal_ou_profissional', 'Além de dinheiro, o que você mais quer conquistar? (pode ser pessoal ou profissional)', 'text', NULL, 6, false),
  ('13c1d0f0-b3e9-411d-9a2e-49c955a1c975', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'ja_tinha_feito_algum_curso_de_empreendedorismo_marketing_e_posicionamento_para_a_area_da_beleza_parecido_com_a_power_academy_antes', 'Já tinha feito algum curso de empreendedorismo, marketing e posicionamento para a área da beleza parecido com a Power Academy antes?', 'text', NULL, 7, false),
  ('42d29fdf-8b27-4259-bf88-6c1410f75ba5', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'porque_decidiu_comprar_a_power_academy', 'Porque decidiu comprar a Power Academy?', 'text', NULL, 8, false),
  ('be5ec49d-3c1e-4556-a80d-c71106715a00', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'o_que_tem_que_acontecer_para_daqui_uns_meses_voce_dizer_foi_o_melhor_investimento_que_eu_fiz', 'O que tem que acontecer para daqui uns meses você dizer "foi o melhor investimento que eu fiz"?', 'text', NULL, 9, false),
  ('21e9c1f2-6adf-44f8-8f23-d32afb339c74', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'como_voce_se_ve_daqui_5_anos_na_sua_profissao', 'Como você se vê daqui 5 anos na sua profissão?', 'text', NULL, 10, false),
  ('c1377fa6-34c6-43d7-9cc8-e5feb66b89d0', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'qual_sua_maior_dificuldade_hoje', 'Qual sua maior dificuldade hoje?', 'text', NULL, 11, false),
  ('2f59a8f6-9860-42bd-ae8e-b0e3dc08334a', '86701108-d8e9-4233-8a88-1c2e4d3000c7', 'se_a_biteti_te_chamasse_para_tomar_um_cafe_e_voce_pudesse_fazer_3_perguntas_quais_seriam', 'Se a Biteti te chamasse para tomar um café e você pudesse fazer 3 perguntas, quais seriam?', 'text', NULL, 12, false)
ON CONFLICT (id) DO UPDATE SET
  sub_origin_id = EXCLUDED.sub_origin_id,
  field_key = EXCLUDED.field_key,
  field_label = EXCLUDED.field_label,
  field_type = EXCLUDED.field_type,
  options = EXCLUDED.options,
  ordem = EXCLUDED.ordem,
  is_required = EXCLUDED.is_required;
