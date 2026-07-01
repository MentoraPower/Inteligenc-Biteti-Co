<?php
/**
 * Plugin Name: Biteti CRM — Integração Elementor
 * Description: Por formulário: ligue "Ativar Biteti", cole a URL de conexão e mapeie cada campo no controle "Biteti". Opcional por formulário — formulários sem o switch ligado não são afetados. Vários formulários na mesma página funcionam de forma independente.
 * Version: 5.0.0
 * Author: Biteti & Co Inteligenc
 */

if (!defined('ABSPATH')) exit;

class Biteti_CRM_Elementor {
    public function __construct() {
        add_action('admin_menu', [$this, 'menu']);
        // Per-field "Biteti" mapping control (below Placeholder).
        add_action('elementor/element/form/section_form_fields/before_section_end', [$this, 'add_field_control'], 10, 2);
        // Per-form "Conexão Biteti" section: enable switch + connection URL.
        add_action('elementor/element/form/section_form_fields/after_section_end', [$this, 'add_connection_section'], 10, 2);
        add_action('elementor_pro/forms/new_record', [$this, 'on_submit'], 10, 2);
    }

    public function menu() {
        add_menu_page('Biteti', 'Biteti', 'manage_options', 'biteti-crm-elementor', [$this, 'page'], 'dashicons-share-alt2', 58);
    }
    public function page() { ?>
        <div class="wrap">
            <h1>Biteti — Integração Elementor</h1>
            <p>Tudo é configurado <b>por formulário</b>, no editor do Elementor. Nada global aqui.</p>
            <h2>Como usar (por formulário)</h2>
            <ol>
                <li>Na plataforma: <b>Integrações → Elementor</b> → crie a integração e copie a <b>URL de Conexão</b> + os <b>nomes dos campos</b>.</li>
                <li>No formulário do Elementor: aba <b>Conteúdo → Conexão Biteti</b> → ligue <b>"Ativar Biteti"</b> e cole a <b>URL de Conexão</b>.</li>
                <li>Em cada campo, preencha o controle <b>"Biteti"</b> com o nome (ex: <code>name</code>, <code>email</code>, <code>phone</code>, <code>instagram</code> ou o id de um campo personalizado).</li>
            </ol>
            <p><b>Vários formulários na mesma página:</b> ligue o "Ativar Biteti" só nos que você quiser. Os outros não são afetados.</p>
        </div>
    <?php }

    /* ---------------- Per-field "Biteti" control ---------------- */
    public function add_field_control($element, $args) {
      try {
        if (!class_exists('\ElementorPro\Plugin')) return;
        $elementor = \ElementorPro\Plugin::elementor();
        $control_data = $elementor->controls_manager->get_control_from_stack($element->get_unique_name(), 'form_fields');
        if (is_wp_error($control_data) || empty($control_data['fields']) || !is_array($control_data['fields'])) return;

        $new_field = [
            'name'          => 'biteti_field',
            'label'         => 'Biteti',
            'type'          => \Elementor\Controls_Manager::TEXT,
            'placeholder'   => 'name, email, phone, instagram ou id do campo',
            'description'   => 'Nome que a plataforma aceita (veja na integração). Só usado se "Ativar Biteti" estiver ligado.',
            'tab'           => 'content',
            'inner_tab'     => 'form_fields_content_tab',
            'tabs_wrapper'  => 'form_fields_tabs',
        ];

        $out = [];
        $inserted = false;
        foreach ($control_data['fields'] as $f) {
            $out[] = $f;
            if (!$inserted && isset($f['name']) && $f['name'] === 'placeholder') { $out[] = $new_field; $inserted = true; }
        }
        if (!$inserted) $out[] = $new_field;
        $control_data['fields'] = $out;
        $element->update_control('form_fields', $control_data);
      } catch (\Throwable $e) { /* never break the editor */ }
    }

    /* ---------------- Per-form connection section ---------------- */
    public function add_connection_section($element, $args) {
      try {
        $element->start_controls_section('biteti_crm_section', [
            'label' => 'Conexão Biteti',
            'tab'   => \Elementor\Controls_Manager::TAB_CONTENT,
        ]);
        $element->add_control('biteti_crm_enable', [
            'label'        => 'Ativar Biteti',
            'type'         => \Elementor\Controls_Manager::SWITCHER,
            'label_on'     => 'Sim',
            'label_off'    => 'Não',
            'return_value' => 'yes',
            'default'      => '',
            'description'  => 'Ligue apenas neste formulário para enviá-lo ao CRM.',
        ]);
        $element->add_control('biteti_crm_url', [
            'label'       => 'URL de Conexão Biteti',
            'type'        => \Elementor\Controls_Manager::TEXT,
            'placeholder' => 'Cole a URL de conexão gerada na plataforma',
            'condition'   => ['biteti_crm_enable' => 'yes'],
        ]);
        $element->end_controls_section();
      } catch (\Throwable $e) { /* never break the editor */ }
    }

    /* ---------------- On submit ---------------- */
    public function on_submit($record, $handler) {
      try {
        $settings = $record->get('form_settings');

        // Per-form opt-in: must be enabled AND have a connection URL.
        $enabled = isset($settings['biteti_crm_enable']) && $settings['biteti_crm_enable'] === 'yes';
        $url = isset($settings['biteti_crm_url']) ? trim($settings['biteti_crm_url']) : '';
        if (!$enabled || !$url) return;

        // Map each field id -> "Biteti" value from the field definitions.
        $defs = isset($settings['form_fields']) ? $settings['form_fields'] : [];
        $crm_map = [];
        foreach ($defs as $fd) {
            $crm = isset($fd['biteti_field']) ? trim($fd['biteti_field']) : '';
            if ($crm === '') continue;
            if (!empty($fd['custom_id'])) $crm_map[$fd['custom_id']] = $crm;
            if (!empty($fd['_id']))       $crm_map[$fd['_id']] = $crm;
        }
        $lookup = function ($id) use ($crm_map) {
            if (isset($crm_map[$id])) return $crm_map[$id];
            $stripped = preg_replace('/^field_/', '', (string) $id);
            if (isset($crm_map[$stripped])) return $crm_map[$stripped];
            if (isset($crm_map['field_' . $id])) return $crm_map['field_' . $id];
            return null;
        };

        $body = [];
        foreach ($record->get('fields') as $id => $field) {
            $value = isset($field['value']) ? $field['value'] : '';
            $crm = $lookup($id);
            if ($crm !== null) $body[$crm] = $value;
        }

        // Page URL (UTMs + lead history).
        $meta = $record->get('meta');
        $page_url = '';
        if (is_array($meta)) {
            if (isset($meta['page_url']['value'])) $page_url = $meta['page_url']['value'];
            elseif (isset($meta['page_url']) && !is_array($meta['page_url'])) $page_url = $meta['page_url'];
        }
        if (!$page_url && !empty($_SERVER['HTTP_REFERER'])) $page_url = $_SERVER['HTTP_REFERER'];
        if ($page_url) {
            $parts = wp_parse_url($page_url);
            if (!empty($parts['query'])) {
                parse_str($parts['query'], $q);
                foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as $u) {
                    if (!empty($q[$u]) && !isset($body[$u])) $body[$u] = trim($q[$u]);
                }
            }
        }

        if (empty($body)) return;

        $body['_source'] = 'elementor';
        if ($page_url) $body['_page_url'] = $page_url;
        $formName = isset($settings['form_name']) ? $settings['form_name'] : '';
        if ($formName) $body['_form'] = $formName;

        wp_remote_post($url, [
            'timeout'  => 15,
            'blocking' => false,
            'headers'  => ['Content-Type' => 'application/json'],
            'body'     => wp_json_encode($body),
        ]);
      } catch (\Throwable $e) { /* never break the form submission */ }
    }
}

new Biteti_CRM_Elementor();
