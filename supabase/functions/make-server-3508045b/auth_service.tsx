import * as kv from './kv_store.tsx';

interface VerificationCode {
  email: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

// Generar código de 6 dígitos
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Guardar código de verificación
export async function saveVerificationCode(email: string, code: string): Promise<void> {
  const now = Date.now();
  const expiresAt = now + (10 * 60 * 1000); // Expira en 10 minutos
  
  const verificationData: VerificationCode = {
    email,
    code,
    createdAt: now,
    expiresAt,
    attempts: 0,
  };

  await kv.set(`verification:${email}`, verificationData);
  console.log(`✅ Código guardado para ${email}, expira en 10 minutos`);
}

// Verificar código
export async function verifyCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  const data = await kv.get<VerificationCode>(`verification:${email}`);

  if (!data) {
    return { success: false, error: 'No se encontró un código para este email' };
  }

  // Verificar si el código expiró
  if (Date.now() > data.expiresAt) {
    await kv.del(`verification:${email}`);
    return { success: false, error: 'El código ha expirado. Solicita uno nuevo.' };
  }

  // Verificar intentos
  if (data.attempts >= 5) {
    await kv.del(`verification:${email}`);
    return { success: false, error: 'Demasiados intentos. Solicita un nuevo código.' };
  }

  // Verificar el código
  if (data.code !== code) {
    // Incrementar intentos
    data.attempts += 1;
    await kv.set(`verification:${email}`, data);
    return { success: false, error: `Código incorrecto. Te quedan ${5 - data.attempts} intentos.` };
  }

  // Código correcto, eliminar de la base de datos
  await kv.del(`verification:${email}`);
  return { success: true };
}

// Enviar email con Brevo
export async function sendVerificationEmail(email: string, code: string, name?: string): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  
  if (!apiKey) {
    throw new Error('BREVO_API_KEY no está configurado');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: 'Sistema POS',
        email: 'noreply@tudominio.com', // Cambia esto por tu email verificado en Brevo
      },
      to: [
        {
          email,
          name: name || email,
        },
      ],
      subject: 'Código de Verificación - Sistema POS',
      htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); padding: 40px 20px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Sistema POS</h1>
                      <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">Código de Verificación</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.5;">
                        ${name ? `Hola <strong>${name}</strong>,` : 'Hola,'}<br>
                        Aquí está tu código de verificación:
                      </p>
                      
                      <!-- Code Box -->
                      <div style="background: linear-gradient(135deg, #3b82f6 0%, #9333ea 100%); border-radius: 12px; padding: 30px; margin: 30px 0;">
                        <p style="margin: 0; color: #ffffff; font-size: 48px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                          ${code}
                        </p>
                      </div>
                      
                      <p style="margin: 20px 0 10px; color: #6b7280; font-size: 14px;">
                        Este código expira en <strong>10 minutos</strong>
                      </p>
                      
                      <p style="margin: 30px 0 0; color: #9ca3af; font-size: 13px; line-height: 1.5;">
                        Si no solicitaste este código, puedes ignorar este mensaje de forma segura.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                        © 2024 Sistema POS. Todos los derechos reservados.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Error enviando email con Brevo:', error);
    throw new Error(`Error al enviar email: ${response.statusText}`);
  }

  console.log(`✅ Email enviado exitosamente a ${email}`);
}
