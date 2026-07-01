<?php
/**
 * Plugin Name: Biteti CRM — Integração Elementor
 * Description: Adiciona em cada campo do formulário Elementor um controle "Campo no CRM" e um Token de Conexão. No envio, manda os dados já com os nomes que a plataforma aceita, identificando pelo token.
 * Version: 3.0.0
 * Author: Biteti & Co Inteligenc
 */

if (!defined('ABSPATH')) exit;

class Biteti_CRM_Elementor {
    const OPT_URL = 'biteti_crm_endpoint_url';

    public function __construct() {
        add_action('admin_menu', [$this, 'menu']);
        add_action('admin_init', [$this, 'settings']);

        // Add a "Campo no CRM" control to each form field (below Placeholder).
        add_action('elementor/element/form/section_form_fields/before_section_end', [$this, 'add_field_control'], 10, 2);
        // Add a "Conexão CRM" section (token) to the Form widget.
        add_action('elementor/element/form/section_form_fields/after_section_end', [$this, 'add_token_section'], 10, 2);

        add_action('elementor_pro/forms/new_record', [$this, 'on_submit'], 10, 2);
    }

    /* ---------------- Admin: endpoint URL ---------------- */
    public function menu() {
        add_menu_page('CRM Elementor', 'CRM Elementor', 'manage_options', 'biteti-crm-elementor', [$this, 'page'], 'dashicons-share-alt2', 58);
    }
    public function settings() { register_setting('biteti_crm', self::OPT_URL); }
    public function page() { ?>
        <div class="wrap">
            <h1>Biteti CRM — Integração Elementor</h1>
            <form method="post" action="options.php">
                <?php settings_fields('biteti_crm'); ?>
                <table class="form-table">
                    <tr>
                        <th><label>URL do endpoint da plataforma</label></th>
                        <td>
                            <input type="url" name="<?php echo self::OPT_URL; ?>" value="<?php echo esc_attr(get_option(self::OPT_URL)); ?>" class="regular-text" style="width:640px" placeholder="https://sua-plataforma/api/integrations/elementor" />
                            <p class="description">Copie em: Plataforma → Configurações → Integrações → <b>Elementor</b>. Vale pra todos os formulários.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Salvar'); ?>
            </form>
            <hr>
            <h2>Como usar</h2>
            <ol>
                <li>Cole a URL do endpoint acima e salve.</li>
                <li>Na plataforma, crie a integração <b>Elementor</b> e copie o <b>Token</b> + os nomes dos campos.</li>
                <li>No formulário do Elementor: em <b>Conteúdo → Conexão CRM</b>, cole o <b>Token</b>.</li>
                <li>Em cada campo, no fim das opções, preencha <b>"Campo no CRM"</b> com o nome (ex: <code>name</code>, <code>email</code>, <code>phone</code>, <code>instagram</code> ou o id de um campo personalizado).</li>
            </ol>
        </div>
    <?php }

    /* ---------------- Elementor: per-field control ---------------- */
    public function add_field_control($element, $args) {
        if (!class_exists('\ElementorPro\Plugin')) return;
        $elementor = \ElementorPro\Plugin::elementor();
        $control_data = $elementor->controls_manager->get_control_from_stack($element->get_unique_name(), 'form_fields');
        if (is_wp_error($control_data)) return;

        $new_field = [
            'name' => 'crm_field',
            'label' => 'Campo no CRM (Biteti)',
            'type' => \Elementor\Controls_Manager::TEXT,
            'placeholder' => 'name, email, phone, instagram ou id do campo',
            'description' => 'Nome que a plataforma aceita (veja na integração).',
            'tab' => 'content',
            'inner_tab' => 'form_fields_content_tab',
            'tabs_wrapper' => 'form_fields_tabs',
        ];

        // Insert right after the "placeholder" control.
        $fields = $control_data['fields'];
        $out = [];
        $inserted = false;
        foreach ($fields as $f) {
            $out[] = $f;
            if (!$inserted && isset($f['name']) && $f['name'] === 'placeholder') {
                $out[] = $new_field;
                $inserted = true;
            }
        }
        if (!$inserted) $out[] = $new_field;
        $control_data['fields'] = $out;
        $element->update_control('form_fields', $control_data);
    }

    /* ---------------- Elementor: token section ---------------- */
    public function add_token_section($element, $args) {
        $element->start_controls_section('biteti_crm_section', [
            'label' => 'Conexão CRM (Biteti)',
            'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
        ]);
        $element->add_control('biteti_crm_token', [
            'label' => 'Token de Conexão',
            'type' => \Elementor\Controls_Manager::TEXT,
            'placeholder' => 'Cole o token gerado na plataforma',
            'description' => 'Plataforma → Integrações → Elementor → gere e copie o token.',
        ]);
        $element->end_controls_section();
    }

    /* ---------------- On submit ---------------- */
    public function on_submit($record, $handler) {
        $endpoint = get_option(self::OPT_URL);
        if (!$endpoint) return;

        $form_settings = $record->get('form_settings');
        $token = isset($form_settings['biteti_crm_token']) ? trim($form_settings['biteti_crm_token']) : '';
        if (!$token) return; // Este formulário não tem conexão configurada.

        // Map each field id -> "Campo no CRM" from the field definitions.
        $defs = isset($form_settings['form_fields']) ? $form_settings['form_fields'] : [];
        $crm_map = [];
        foreach ($defs as $fd) {
            $crm = isset($fd['crm_field']) ? trim($fd['crm_field']) : '';
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

        if (empty($body)) return;
        $body['token'] = $token;

        $url = add_query_arg('token', rawurlencode($token), $endpoint);
        wp_remote_post($url, [
            'timeout'  => 15,
            'blocking' => false,
            'headers'  => ['Content-Type' => 'application/json'],
            'body'     => wp_json_encode($body),
        ]);
    }
}

new Biteti_CRM_Elementor();
