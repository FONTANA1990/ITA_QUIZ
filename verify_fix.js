const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ixzrojkuswgyiemrdzcq.supabase.co";
const supabaseKey = "sb_publishable_1yNEmoyTdpnBu3RCEDN8bg_CMBAbZcw"; // Anon key
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("Verificando a query que estava falhando...");
  
  // A query que dava erro 500 era: 
  // organization_members?select=role,organizations(*)&user_id=eq.e458bc9f-ebbb-491c-908a-42326e162d46

  try {
    const { data, error, status } = await supabase
      .from("organization_members")
      .select("role, organizations(*)")
      .eq("user_id", "e458bc9f-ebbb-491c-908a-42326e162d46");

    if (error) {
       console.log(`Status de retorno: ${status}`);
       console.log("Erro retornado (esperado se não autenticado, mas não deve ser 500):", error);
    } else {
       console.log("Sucesso! A query não retornou erro 500.");
       console.log("Data:", data);
    }
  } catch (err) {
    console.error("Erro fatal na query:", err);
  }
}

verify();
