UPDATE email_templates 
SET 
  body_html = '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background: linear-gradient(135deg, #F40000 0%, #A10000 100%); border-radius: 20px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 20px 28px 20px;">
              <!-- Logo/Brand -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: 4px; text-transform: uppercase;">SCALE</span>
                  </td>
                </tr>
              </table>
              
              <!-- Main Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255,255,255,0.97); border-radius: 14px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px 24px;">
                    <!-- Success Icon -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 20px;">
                          <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #F40000 0%, #A10000 100%); border-radius: 50%; display: inline-block; line-height: 56px; text-align: center;">
                            <span style="color: #ffffff; font-size: 24px;">&#10003;</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Title -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 12px;">
                          <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a1a;">Cadastro realizado</h1>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Greeting -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 20px;">
                          <p style="margin: 0; font-size: 17px; color: #F40000; font-weight: 600;">Olá, {{name}}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Message -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 24px;">
                          <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                            Nosso time vai entrar em contato com você nas próximas 24 horas.
                          </p>
                          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                            A Scale é o seu próximo passo para escalar o seu negócio no mundo da beleza.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Divider -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 20px;">
                          <div style="height: 1px; background: linear-gradient(90deg, transparent, #e0e0e0, transparent);"></div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Info Card -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8f8f8; border-radius: 10px;">
                            <tr>
                              <td style="padding: 16px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td width="36" valign="top">
                                      <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #F40000 0%, #A10000 100%); border-radius: 6px; text-align: center; line-height: 28px;">
                                        <span style="color: #ffffff; font-size: 12px;">&#9993;</span>
                                      </div>
                                    </td>
                                    <td style="padding-left: 10px;">
                                      <p style="margin: 0 0 2px 0; font-size: 13px; font-weight: 600; color: #1a1a1a;">Fique atento</p>
                                      <p style="margin: 0; font-size: 12px; color: #666666;">Verifique seu WhatsApp e e-mail</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Footer -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.9);">Scale Beauty</p>
                    <p style="margin: 6px 0 0 0; font-size: 11px; color: rgba(255,255,255,0.7);">Assessoria de marketing por Emilly Biteti</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  updated_at = now()
WHERE id = '7f06e73e-fed4-4e78-b4e0-12e2dc84c5ed';