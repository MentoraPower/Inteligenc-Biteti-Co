<?php
/**
 * Plugin Name: Biteti CRM — Integração Elementor
 * Description: Envia submissões de formulários do Elementor / PRO Elements para o CRM, com mapeamento de campos. Resolve o problema de campos "bugados" (sem Label) — você mapeia o ID/pergunta do campo para o nome certo (name, email, phone, instagram ou um campo personalizado) e o plugin manda um JSON limpo.
 * Version: 1.1.0
 * Author: Biteti & Co Inteligenc
 */

if (!defined('ABSPATH')) exit;

class Biteti_CRM_Elementor {
    const OPT_URL  = 'biteti_crm_webhook_url';
    const OPT_MAP  = 'biteti_crm_field_map';
    const OPT_LAST = 'biteti_crm_last_fields';

    public function __construct() {
        add_action('admin_menu', [$this, 'menu']);
        add_action('admin_init', [$this, 'settings']);
        // Fires on every Elementor Pro / PRO Elements form submission.
        add_action('elementor_pro/forms/new_record', [$this, 'on_submit'], 10, 2);
    }

    /* ---------------- Admin settings ---------------- */
    public function menu() {
        add_menu_page('CRM Elementor', 'CRM Elementor', 'manage_options', 'biteti-crm-elementor', [$this, 'page'], 'dashicons-share-alt2', 58);
    }

    public function settings() {
        register_setting('biteti_crm', self::OPT_URL);
        register_setting('biteti_crm', self::OPT_MAP);
    }

    public function page() {
        $last = get_option(self::OPT_LAST, []);
        ?>
        <div class="wrap">
            <h1>Biteti CRM — Integração Elementor</h1>
            <form method="post" action="options.php">
                <?php settings_fields('biteti_crm'); ?>
                <table class="form-table">
                    <tr>
                        <th><label>1) URL do Webhook do CRM</label></th>
                        <td>
                            <input type="url" name="<?php echo self::OPT_URL; ?>" value="<?php echo esc_attr(get_option(self::OPT_URL)); ?>" class="regular-text" style="width:640px" placeholder="https://seu-dominio/api/webhook?sub_origin_id=...&pipeline_id=..." />
                            <p class="description">Cole a URL de <b>receber</b> gerada no CRM (Configurações → Webhook → criar webhook do tipo "Receber" → copiar URL).</p>
                        </td>
                    </tr>
                    <tr>
                        <th><label>2) Mapeamento de campos</label></th>
                        <td>
                            <textarea name="<?php echo self::OPT_MAP; ?>" rows="9" style="width:640px;font-family:monospace" placeholder="field_ccbb416 = name&#10;field_ede6366 = email&#10;field_4a3d28d = phone&#10;field_c116fda = instagram"><?php echo esc_textarea(get_option(self::OPT_MAP)); ?></textarea>
                            <p class="description">
                                Um por linha: <code>campo_do_elementor = destino</code>.<br>
                                O "campo_do_elementor" pode ser o <b>ID</b> do campo OU o texto da <b>pergunta/Label</b>.<br>
                                Destinos principais: <code>name</code>, <code>email</code>, <code>phone</code>, <code>instagram</code>.<br>
                                Para <b>campo personalizado</b>, use a <b>chave (field_key)</b> ou o <b>ID</b> do campo na plataforma.
                            </p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Salvar'); ?>
            </form>

            <hr>
            <h2>Campos recebidos na última submissão</h2>
            <p class="description">Envie o formulário uma vez e recarregue esta página. Copie o <b>ID</b> (ou a pergunta) da coluna abaixo para o mapeamento acima.</p>
            <?php if (empty($last)) : ?>
                <p><em>Nenhuma submissão recebida ainda.</em></p>
            <?php else : ?>
                <table class="widefat striped" style="max-width:800px">
                    <thead><tr><th>ID do campo</th><th>Pergunta / Label</th><th>Exemplo de valor</th></tr></thead>
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

        $fields = $record->get('fields'); // [ id => ['id','type','title','value','raw_value'] ]
        $map = $this->parse_map();

        // Core platform fields go at the root; anything else is a custom field.
        $core = ['name', 'email', 'phone', 'whatsapp', 'instagram'];

        $payload = [];   // clean core keys
        $custom  = [];   // custom_fields object
        $raw     = [];   // fallback: by id AND by label
        $last    = [];   // stored for the admin "last submission" table

        foreach ($fields as $id => $field) {
            $value = isset($field['value']) ? $field['value'] : '';
            $label = isset($field['title']) ? $field['title'] : '';

            $last[] = ['id' => $id, 'label' => $label, 'value' => $value];

            if ($id !== '')    $raw[$id] = $value;
            if ($label !== '') $raw[$label] = $value;

            $byId    = isset($map[$this->norm($id)])    ? $map[$this->norm($id)]    : null;
            $byLabel = isset($map[$this->norm($label)]) ? $map[$this->norm($label)] : null;
            $target  = $byId ?: $byLabel;

            if ($target) {
                if (in_array(strtolower($target), $core, true)) {
                    $payload[strtolower($target)] = $value;
                } else {
                    $custom[$target] = $value;   // matched by field id / field_key on the CRM
                    $raw[$target] = $value;
                }
            }
        }

        // Remember the fields so they show up in the admin screen for mapping.
        update_option(self::OPT_LAST, $last);

        if (!$url) return;

        // Mapped core keys win over the raw fallback.
        $body = array_merge($raw, $payload);
        if (!empty($custom)) $body['custom_fields'] = $custom;

        $settings = $record->get('form_settings');
        if (!empty($settings['form_name'])) $body['_form'] = $settings['form_name'];

        wp_remote_post($url, [
            'timeout'  => 15,
            'blocking' => false, // fire-and-forget, não atrasa o formulário
            'headers'  => ['Content-Type' => 'application/json'],
            'body'     => wp_json_encode($body),
        ]);
    }
}

new Biteti_CRM_Elementor();
