UPDATE email_templates 
SET 
  subject = 'Seu cadastro foi realizado com sucesso',
  body_html = '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background: linear-gradient(135deg, #CC3A33 0%, #A10000 100%); border-radius: 24px; overflow: hidden;">
          <tr>
            <td style="padding: 48px 40px 40px 40px;">
              <!-- Logo/Brand -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <span style="font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: 4px; text-transform: uppercase;">SCALE</span>
                  </td>
                </tr>
              </table>
              
              <!-- Main Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255,255,255,0.95); border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 40px 32px;">
                    <!-- Success Icon -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 24px;">
                          <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #CC3A33 0%, #A10000 100%); border-radius: 50%; display: inline-block; line-height: 64px; text-align: center;">
                            <span style="color: #ffffff; font-size: 28px;">&#10003;</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Title -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 16px;">
                          <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1a1a1a;">Cadastro realizado</h1>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Greeting -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 24px;">
                          <p style="margin: 0; font-size: 18px; color: #CC3A33; font-weight: 600;">Olá, {{name}}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Message -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding-bottom: 32px;">
                          <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                            Nosso time vai entrar em contato com você nas próximas 24 horas.
                          </p>
                          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #4a4a4a; text-align: center;">
                            A Scale é o seu próximo passo para escalar o seu negócio no mundo da beleza.
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Divider -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 24px;">
                          <div style="height: 1px; background: linear-gradient(90deg, transparent, #e0e0e0, transparent);"></div>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Info Cards -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fafafa; border-radius: 12px;">
                            <tr>
                              <td style="padding: 20px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td width="40" valign="top">
                                      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #CC3A33 0%, #A10000 100%); border-radius: 8px; text-align: center; line-height: 32px;">
                                        <span style="color: #ffffff; font-size: 14px;">&#9993;</span>
                                      </div>
                                    </td>
                                    <td style="padding-left: 12px;">
                                      <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #1a1a1a;">Fique atento</p>
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
                  <td align="center" style="padding-top: 32px;">
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.8);">Scale Beauty</p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">Assessoria de marketing por Emile Bitetti</p>
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