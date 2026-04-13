// Endpoint to send invitation email via Brevo
// This is a MINIMAL endpoint that ONLY sends emails
import { Context } from 'npm:hono';

export async function sendInvitationEmail(c: Context) {
  try {
    const body = await c.req.json();
    const { email, name, invitationLink } = body;

    console.log('📧 [SEND-INVITE] Sending invitation email...');
    console.log('📧 [SEND-INVITE] To:', email);
    console.log('📧 [SEND-INVITE] Name:', name);

    // Get Brevo credentials from environment
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const brevoSender = Deno.env.get('BREVO_SENDER_EMAIL');

    if (!brevoApiKey || !brevoSender) {
      console.error('❌ [SEND-INVITE] Missing Brevo credentials');
      return c.json({ error: 'Email service not configured' }, 500);
    }

    // Send email with Brevo
    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: 'Sistema POS',
          email: brevoSender
        },
        to: [{
          email: email,
          name: name
        }],
        subject: 'Invitación a unirte al equipo',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">¡Bienvenido al equipo! 🎉</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${name}</strong>,</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                Has sido invitado a formar parte del equipo. Para completar tu registro y acceder al sistema, haz clic en el siguiente botón:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationLink}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-size: 16px; 
                          font-weight: bold; 
                          display: inline-block;">
                  Completar mi registro
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="font-size: 12px; color: #999; word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
                ${invitationLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center;">
                Este enlace es válido por 7 días. Si no solicitaste esta invitación, puedes ignorar este correo.
              </p>
            </div>
          </body>
          </html>
        `
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('❌ [SEND-INVITE] Brevo error:', errorData);
      return c.json({ error: 'Failed to send email', details: errorData }, 500);
    }

    console.log('✅ [SEND-INVITE] Email sent successfully!');
    return c.json({ success: true, message: 'Email sent successfully' });

  } catch (error: any) {
    console.error('❌ [SEND-INVITE] Error:', error);
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
}
