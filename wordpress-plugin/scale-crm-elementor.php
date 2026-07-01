<?php
/**
 * Plugin Name: Biteti CRM — Integração Elementor
 * Description: Por formulário: ligue "Ativar Biteti" e cole a URL de conexão. NÃO altera os campos do formulário (seguro) — o mapeamento é feito na plataforma. Formulários sem o switch ligado não são afetados. Vários na mesma página funcionam de forma independente.
 * Version: 6.0.0
 * Author: Biteti & Co Inteligenc
 */

if (!defined('ABSPATH')) exit;

class Biteti_CRM_Elementor {
    const OPT_LAST = 'biteti_crm_last_fields';
    const OPT_LASTFORM = 'biteti_crm_last_form';

    public function __construct() {
        add_action('admin_menu', [$this, 'menu']);
        // Only adds a NEW section to the form widget (safe). NEVER touches the fields.
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
            <p>Tudo é por formulário, no editor do Elementor. Este plugin <b>não altera os campos</b> do formulário.</p>
            <h2>Como usar (por formulário)</h2>
            <ol>
                <li>Na plataforma: <b>Integrações → Elementor</b> → crie a integração (pipeline + tag) e copie a <b>URL de Conexão</b>.</li>
                <li>No formulário do Elementor: aba <b>Conteúdo → Conexão Biteti</b> → ligue <b>"Ativar Biteti"</b> e cole a URL. (Só formulários ligados são enviados.)</li>
                <li>Envie o formulário uma vez e volte aqui: copie os <b>IDs dos campos</b> abaixo e mapeie na plataforma.</li>
            </ol>
            <hr>
            <h2>Última submissão recebida</h2>
            <?php if (empty($last)) : ?>
                <p><em>Nenhuma submissão recebida ainda.</em></p>
            <?php else : ?>
                <p><b>Form:</b> <?php echo esc_html($lastForm['name'] ?? '—'); ?> &nbsp; <b>Form ID:</b> <code><?php echo esc_html($lastForm['id'] ?? '—'); ?></code></p>
                <table class="widefat striped" style="max-width:820px">
                    <thead><tr><th>ID do campo</th><th>Pergunta / Label</th><th>Exemplo</th></tr></thead>
                    <tbody>
                        <?php foreach ($last as $f) : ?>
                            <tr>
                                <td><code><?php echo esc_html($f['id']); ?></code></td>
                                <td><?php echo esc_html($f['label']); ?></td>
                                <td><?php echo esc_html(mb_strimwidth((string)$f['value'], 0, 60, '…')); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
        <?php
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

        $out = [];
        foreach ($fields as $id => $field) {
            $out[] = ['id' => $id, 'label' => isset($field['title']) ? $field['title'] : '', 'value' => isset($field['value']) ? $field['value'] : ''];
        }

        // Always remember the last submission (local reference for mapping).
        update_option(self::OPT_LAST, $out);
        update_option(self::OPT_LASTFORM, ['id' => $formId, 'name' => $formName]);

        // Per-form opt-in: must be enabled AND have a connection URL.
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
