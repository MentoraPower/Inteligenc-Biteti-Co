<?php
/**
 * Plugin Name: Biteti CRM — Integração Elementor
 * Description: Por formulário: ligue "Ativar Biteti", cole a URL e nomeie cada campo no controle "Biteti" (abaixo do Placeholder). O controle "Biteti" é injetado SOMENTE no editor — nunca na renderização nem no envio — então não quebra o formulário. Opcional por formulário; vários na mesma página funcionam independentes.
 * Version: 7.0.0
 * Author: Biteti & Co Inteligenc
 */

if (!defined('ABSPATH')) exit;

class Biteti_CRM_Elementor {
    const OPT_LAST = 'biteti_crm_last_fields';
    const OPT_LASTFORM = 'biteti_crm_last_form';

    public function __construct() {
        add_action('admin_menu', [$this, 'menu']);
        // "Biteti" per-field control — registered ONLY in the editor (see guard).
        add_action('elementor/element/form/section_form_fields/before_section_end', [$this, 'add_field_control'], 10, 2);
        // "Conexão Biteti" section (enable switch + URL) — safe new section.
        add_action('elementor/element/form/section_form_fields/after_section_end', [$this, 'add_connection_section'], 10, 2);
        add_action('elementor_pro/forms/new_record', [$this, 'on_submit'], 10, 2);
    }

    public function menu() {
        add_menu_page('Biteti', 'Biteti', 'manage_options', 'biteti-crm-elementor', [$this, 'page'], 'dashicons-share-alt2', 58);
    }
    public function page() {
        $last = get_option(self::OPT_LAST, []);
        $lastForm = get_option(self::OPT_LASTFORM, []);
        ?>
        <div class="wrap">
            <h1>Biteti — Integração Elementor</h1>
            <h2>Como usar (por formulário)</h2>
            <ol>
                <li>Na plataforma: <b>Integrações → Elementor</b> → crie a integração (pipeline + tag) e copie a <b>URL de Conexão</b>.</li>
                <li>No formulário: aba <b>Conteúdo → Conexão Biteti</b> → ligue <b>"Ativar Biteti"</b> e cole a URL.</li>
                <li>Em cada campo, no fim das opções (abaixo do Placeholder), preencha <b>"Biteti"</b> com <code>name</code>, <code>email</code>, <code>phone</code>, <code>instagram</code> ou o id de um campo personalizado.</li>
            </ol>
            <hr>
            <h2>Última submissão recebida</h2>
            <?php if (empty($last)) : ?>
                <p><em>Nenhuma submissão recebida ainda.</em></p>
            <?php else : ?>
                <p><b>Form:</b> <?php echo esc_html($lastForm['name'] ?? '—'); ?> &nbsp; <b>Form ID:</b> <code><?php echo esc_html($lastForm['id'] ?? '—'); ?></code></p>
                <table class="widefat striped" style="max-width:820px">
                    <thead><tr><th>ID do campo</th><th>Label</th><th>Biteti</th><th>Exemplo</th></tr></thead>
                    <tbody>
                        <?php foreach ($last as $f) : ?>
                            <tr>
                                <td><code><?php echo esc_html($f['id']); ?></code></td>
                                <td><?php echo esc_html($f['label']); ?></td>
                                <td><code><?php echo esc_html($f['crm'] ?? ''); ?></code></td>
                                <td><?php echo esc_html(mb_strimwidth((string)$f['value'], 0, 50, '…')); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
        <?php
    }

    /* ---------------- "Biteti" per-field control (EDITOR ONLY) ---------------- */
    public function add_field_control($element, $args) {
      try {
        // CRITICAL: only touch the widget in the editor panel. Never on the
        // frontend render and never during a form submission — that is what
        // used to break form validation. The value the user types is saved with
        // the form and read at submit time from the stored settings.
        if (!is_admin()) return;
        if (!empty($_REQUEST['action']) && $_REQUEST['action'] === 'elementor_pro_forms_send_form') return;
        if (wp_doing_cron()) return;

        if (!class_exists('\ElementorPro\Plugin')) return;
        $elementor = \ElementorPro\Plugin::elementor();
        $control_data = $elementor->controls_manager->get_control_from_stack($element->get_unique_name(), 'form_fields');
        if (is_wp_error($control_data) || empty($control_data['fields']) || !is_array($control_data['fields'])) return;

        $new_field = [
            'name'         => 'biteti_field',
            'label'        => 'Biteti',
            'type'         => \Elementor\Controls_Manager::TEXT,
            'placeholder'  => 'name, email, phone, instagram ou id do campo',
            'description'  => 'Nome que a plataforma aceita. Só é usado se "Ativar Biteti" estiver ligado.',
            'tab'          => 'content',
            'inner_tab'    => 'form_fields_content_tab',
            'tabs_wrapper' => 'form_fields_tabs',
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

    /* ---------------- Per-form connection section (safe) ---------------- */
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
        $fields   = $record->get('fields');

        $formId   = isset($settings['id']) ? $settings['id'] : (isset($settings['form_id']) ? $settings['form_id'] : '');
        $formName = isset($settings['form_name']) ? $settings['form_name'] : '';

        // Read the per-field "Biteti" value from the saved form definition.
        $defs = isset($settings['form_fields']) ? $settings['form_fields'] : [];
        $crm_by_id = [];
        foreach ($defs as $fd) {
            $crm = isset($fd['biteti_field']) ? trim($fd['biteti_field']) : '';
            if ($crm === '') continue;
            if (!empty($fd['custom_id'])) $crm_by_id[$fd['custom_id']] = $crm;
            if (!empty($fd['_id']))       $crm_by_id[$fd['_id']] = $crm;
        }

        $out = [];
        foreach ($fields as $id => $field) {
            $crm = '';
            if (isset($crm_by_id[$id])) $crm = $crm_by_id[$id];
            else {
                $stripped = preg_replace('/^field_/', '', (string) $id);
                if (isset($crm_by_id[$stripped])) $crm = $crm_by_id[$stripped];
            }
            $out[] = [
                'id'    => $id,
                'label' => isset($field['title']) ? $field['title'] : '',
                'value' => isset($field['value']) ? $field['value'] : '',
                'crm'   => $crm,
            ];
        }

        update_option(self::OPT_LAST, $out);
        update_option(self::OPT_LASTFORM, ['id' => $formId, 'name' => $formName]);

        // Per-form opt-in: enabled + URL.
        $enabled = isset($settings['biteti_crm_enable']) && $settings['biteti_crm_enable'] === 'yes';
        $url = isset($settings['biteti_crm_url']) ? trim($settings['biteti_crm_url']) : '';
        if (!$enabled || !$url) return;

        $meta = $record->get('meta');
        $page_url = '';
        if (is_array($meta)) {
            if (isset($meta['page_url']['value'])) $page_url = $meta['page_url']['value'];
            elseif (isset($meta['page_url']) && !is_array($meta['page_url'])) $page_url = $meta['page_url'];
        }
        if (!$page_url && !empty($_SERVER['HTTP_REFERER'])) $page_url = $_SERVER['HTTP_REFERER'];

        wp_remote_post($url, [
            'timeout'  => 15,
            'blocking' => false,
            'headers'  => ['Content-Type' => 'application/json'],
            'body'     => wp_json_encode([
                'form_id'   => (string) $formId,
                'form_name' => (string) $formName,
                'page_url'  => (string) $page_url,
                'fields'    => $out,
            ]),
        ]);
      } catch (\Throwable $e) { /* never break the form submission */ }
    }
}

new Biteti_CRM_Elementor();
