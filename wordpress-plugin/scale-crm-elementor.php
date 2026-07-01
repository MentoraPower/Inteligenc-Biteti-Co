<?php
/**
 * Plugin Name: Biteti CRM — Integração Elementor
 * Description: Envia submissões de formulários do Elementor Pro para o CRM, com mapeamento de campos (resolve o problema de campos "bugados" quando só há Placeholder).
 * Version: 1.0.0
 * Author: Biteti & Co Inteligenc
 */

if (!defined('ABSPATH')) exit;

class Biteti_CRM_Elementor {
    const OPT_URL = 'biteti_crm_webhook_url';
    const OPT_MAP = 'biteti_crm_field_map';

    public function __construct() {
        add_action('admin_menu', [$this, 'menu']);
        add_action('admin_init', [$this, 'settings']);
        // Fires on every Elementor Pro form submission.
        add_action('elementor_pro/forms/new_record', [$this, 'on_submit'], 10, 2);
    }

    /* ---------------- Admin settings ---------------- */
    public function menu() {
        add_options_page('CRM Elementor', 'CRM Elementor', 'manage_options', 'biteti-crm-elementor', [$this, 'page']);
    }

    public function settings() {
        register_setting('biteti_crm', self::OPT_URL);
        register_setting('biteti_crm', self::OPT_MAP);
    }

    public function page() { ?>
        <div class="wrap">
            <h1>CRM Elementor — Integração</h1>
            <form method="post" action="options.php">
                <?php settings_fields('biteti_crm'); ?>
                <table class="form-table">
                    <tr>
                        <th><label>URL do Webhook do CRM</label></th>
                        <td>
                            <input type="url" name="<?php echo self::OPT_URL; ?>" value="<?php echo esc_attr(get_option(self::OPT_URL)); ?>" class="regular-text" style="width:600px" placeholder="https://seu-dominio/api/webhook?sub_origin_id=...&pipeline_id=..." />
                            <p class="description">Cole a URL de "receber" gerada no CRM (Configurações → Webhook).</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label>Mapeamento de campos</label></th>
                        <td>
                            <textarea name="<?php echo self::OPT_MAP; ?>" rows="10" style="width:600px;font-family:monospace"><?php echo esc_textarea(get_option(self::OPT_MAP)); ?></textarea>
                            <p class="description">
                                Um por linha, no formato <code>campo_do_elementor = campo_da_plataforma</code>.<br>
                                O "campo_do_elementor" pode ser o <b>ID</b> (aba Avançado) OU o <b>Label</b> do campo.<br>
                                Destinos da plataforma: <code>name</code>, <code>email</code>, <code>phone</code>, <code>instagram</code>.<br>
                                Exemplo:<br>
                                <code>field_a1b2c3 = name</code><br>
                                <code>Seu melhor e-mail = email</code><br>
                                <code>WhatsApp = phone</code>
                            </p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
    <?php }

    /* ---------------- Parse the mapping textarea ---------------- */
    private function parse_map() {
        $map = [];
        $raw = (string) get_option(self::OPT_MAP);
        foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
            if (strpos($line, '=') === false) continue;
            list($src, $dst) = array_map('trim', explode('=', $line, 2));
            if ($src === '' || $dst === '') continue;
            $map[$this->norm($src)] = $dst;
        }
        return $map;
    }

    private function norm($s) {
        return strtolower(trim(preg_replace('/\s+/', ' ', (string) $s)));
    }

    /* ---------------- On form submit ---------------- */
    public function on_submit($record, $handler) {
        $url = get_option(self::OPT_URL);
        if (!$url) return;

        $fields = $record->get('fields'); // [ id => ['id','type','title','value','raw_value'] ]
        $map = $this->parse_map();

        // Core platform fields go at the root; anything else is treated as a
        // custom field (matched by the platform custom field's id OR field_key).
        $core = ['name', 'email', 'phone', 'whatsapp', 'instagram'];

        $payload = [];         // clean, mapped core keys (name/email/phone/...)
        $custom = [];          // custom_fields object -> matched by field id/key
        $raw = [];             // everything by id AND by label (fallback aliases)

        foreach ($fields as $id => $field) {
            $value = isset($field['value']) ? $field['value'] : '';
            $label = isset($field['title']) ? $field['title'] : '';

            // Keep raw copies keyed by id and by label.
            if ($id !== '') $raw[$id] = $value;
            if ($label !== '') $raw[$label] = $value;

            // Explicit mapping (by id or by label).
            $byId = isset($map[$this->norm($id)]) ? $map[$this->norm($id)] : null;
            $byLabel = isset($map[$this->norm($label)]) ? $map[$this->norm($label)] : null;
            $target = $byId ?: $byLabel;

            if ($target) {
                if (in_array(strtolower($target), $core, true)) {
                    $payload[strtolower($target)] = $value;
                } else {
                    // Custom field: send both ways so it matches by id or field_key.
                    $custom[$target] = $value;
                    $raw[$target] = $value;
                }
            }
        }

        // Mapped core keys win over the raw fallback.
        $body = array_merge($raw, $payload);
        if (!empty($custom)) $body['custom_fields'] = $custom;

        // Include the form name for reference.
        $settings = $record->get('form_settings');
        if (!empty($settings['form_name'])) $body['_form'] = $settings['form_name'];

        wp_remote_post($url, [
            'timeout'  => 15,
            'blocking' => false, // fire-and-forget, don't slow the form
            'headers'  => ['Content-Type' => 'application/json'],
            'body'     => wp_json_encode($body),
        ]);
    }
}

new Biteti_CRM_Elementor();
