const { Client } = require('pg');
const connectionString = 'postgresql://postgres:%40Geo%40486279513%23@db.ixzrojkuswgyiemrdzcq.supabase.co:5432/postgres';

// Altere o e-mail e a nova senha abaixo antes de rodar o script:
const emailToReset = 'usuario@exemplo.com';
const newPassword = 'SenhaProvisoria123';

async function resetPassword() {
  if (emailToReset === 'usuario@exemplo.com') {
    console.log('⚠️  Edite o arquivo e defina o "emailToReset" e a "newPassword" corretos.');
    return;
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    
    // O Supabase Auth armazena senhas criptografadas com bcrypt.
    // Usamos a extensão pgcrypto para gerar o hash blowfish/bcrypt correto.
    const query = `
      UPDATE auth.users 
      SET encrypted_password = crypt($1, gen_salt('bf', 10)) 
      WHERE email = $2
    `;
    
    const res = await client.query(query, [newPassword, emailToReset]);
    
    if (res.rowCount > 0) {
      console.log(`\n✅ Sucesso! A senha de ${emailToReset} foi alterada para: ${newPassword}`);
      console.log(`Envie essa nova senha temporária para o usuário e peça para ele alterá-la no painel.\n`);
    } else {
      console.log(`\n❌ Nenhum usuário encontrado com o e-mail: ${emailToReset}\n`);
    }
  } catch (err) {
    console.error('❌ Erro ao redefinir senha:', err);
  } finally {
    await client.end();
  }
}

resetPassword();
