<?php
/**
 * Plugin Name: Biteti CRM — Integração Elementor
 * Description: Envia submissões de formulários do Elementor para o CRM pelo Form ID. NÃO altera o editor do Elementor (seguro). O mapeamento dos campos e a pipeline são configurados na plataforma.
 * Version: 4.0.0
 * Author: Biteti & Co Inteligenc
 */

if (!defined('ABSPATH')) exit;

class Biteti_CRM_Elementor {
    const OPT_URL  = 'biteti_crm_endpoint_url';
    const OPT_LAST = 'biteti_crm_last_fields';
    const OPT_LASTFORM = 'biteti_crm_last_form';

    public function __construct() {
        add_action('admin_menu', [$this, 'menu']);
        add_action('admin_init', [$this, 'settings']);
        // Only listens to submissions — never touches the Elementor editor.
        add_action('elementor_pro/forms/new_record', [$this, 'on_submit'], 10, 2);
    }

    public function menu() {
        add_menu_page('Biteti', 'Biteti', 'manage_options', 'biteti-crm-elementor', [$this, 'page'], 'dashicons-share-alt2', 58);
    }
    public function settings() { register_setting('biteti_crm', self::OPT_URL); }

    public function page() {
        $last = get_option(self::OPT_LAST, []);
        $lastForm = get_option(self::OPT_LASTFORM, []);
        ?>
        <div class="wrap">
            <h1>Biteti — Integração Elementor</h1>
            <form method="post" action="options.php">
                <?php settings_fields('biteti_crm'); ?>
                <table class="form-table">
                    <tr>
                        <th><label>URL do endpoint da plataforma</label></th>
                        <td>
                            <input type="url" name="<?php echo self::OPT_URL; ?>" value="<?php echo esc_attr(get_option(self::OPT_URL)); ?>" class="regular-text" style="width:640px" placeholder="https://sua-plataforma/api/integrations/elementor" />
                            <p class="description">Copie em: Plataforma → Configurações → Integrações → <b>Elementor</b>.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Salvar'); ?>
            </form>

            <hr>
            <h2>Última submissão recebida</h2>
            <p class="description">Envie o formulário uma vez e recarregue esta página. Copie o <b>Form ID</b> e os <b>IDs dos campos</b> para criar a integração na plataforma.</p>
            <?php if (empty($last)) : ?>
                <p><em>Nenhuma submissão recebida ainda.</em></p>
            <?php else : ?>
                <p><b>Form ID:</b> <code><?php echo esc_html($lastForm['id'] ?? '—'); ?></code> &nbsp; <b>Nome:</b> <?php echo esc_html($lastForm['name'] ?? '—'); ?></p>
                <table class="widefat striped" style="max-width:820px">
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

    public function on_submit($record, $handler) {
      try {
        $url = get_option(self::OPT_URL);

        $fields = $record->get('fields');
        $settings = $record->get('form_settings');
        $formId = isset($settings['id']) ? $settings['id'] : (isset($settings['form_id']) ? $settings['form_id'] : '');
        $formName = isset($settings['form_name']) ? $settings['form_name'] : '';

        $out = [];
        foreach ($fields as $id => $field) {
            $out[] = ['id' => $id, 'label' => isset($field['title']) ? $field['title'] : '', 'value' => isset($field['value']) ? $field['value'] : ''];
        }

        // Remember for the admin screen (helps copy the Form ID + field ids).
        update_option(self::OPT_LAST, $out);
        update_option(self::OPT_LASTFORM, ['id' => $formId, 'name' => $formName]);

        if (!$url) return;

        // Page URL (for UTMs + lead history), from the record meta or referer.
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
