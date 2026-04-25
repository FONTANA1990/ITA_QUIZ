-- LIMPEZA TOTAL DE POLÍTICAS ANTERIORES (Evita lixo de tentativas passadas)
DO $$ 
DECLARE 
    r record;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('organizations', 'organization_members', 'settings', 'invites')) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 1. Tabelas de Organização
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'admin', 'member'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 2. Tabela de Configurações da Base
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, key)
);

-- 3. Tabela de Convites
CREATE TABLE IF NOT EXISTS public.invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Segurança (RLS) - ESTRATÉGIA DE QUEBRA DE RECURSIVIDADE TOTAL
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- 4.1 Organizations: SELECT Público para evitar loops em JOINS
CREATE POLICY "Leitura pública de organizações" ON public.organizations
FOR SELECT USING (true);

CREATE POLICY "Owners podem tudo na organização" ON public.organizations
FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Usuários autenticados podem criar organizações" ON public.organizations
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- 4.2 Organization Members: SELECT permitido para o próprio ou para o OWNER da org
CREATE POLICY "Membros podem ver associações permitidas" ON public.organization_members
FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);

CREATE POLICY "Admins podem gerenciar membros" ON public.organization_members
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
);

-- 4.3 Settings & Invites
CREATE POLICY "Membros podem ver settings" ON public.settings
FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

CREATE POLICY "Admins podem gerenciar settings" ON public.settings
FOR ALL USING (
    public.check_is_org_admin(organization_id)
);

CREATE POLICY "Leitura de convites para interessados" ON public.invites
FOR SELECT USING (
    invited_email = (SELECT email FROM public.users WHERE id = auth.uid()) OR
    public.check_is_org_admin(organization_id)
);

CREATE POLICY "Admins podem gerenciar convites" ON public.invites
FOR ALL USING (
    public.check_is_org_admin(organization_id)
);

-- 5. Funções Auxiliares
CREATE OR REPLACE FUNCTION public.check_is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = auth.uid()
        UNION
        SELECT 1 FROM public.organization_members WHERE organization_id = p_org_id AND user_id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC para criação atômica
CREATE OR REPLACE FUNCTION public.create_organization(p_name TEXT, p_owner_id UUID)
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- 1. Cria a org
    INSERT INTO public.organizations (name, owner_id)
    VALUES (p_name, p_owner_id)
    RETURNING id INTO v_org_id;

    -- 2. Adiciona o owner como membro admin
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_owner_id, 'admin');

    RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC para aceitar convite
CREATE OR REPLACE FUNCTION public.accept_invite(p_invite_id UUID)
RETURNS VOID AS $$
DECLARE
    v_org_id UUID;
    v_role TEXT;
    v_email TEXT;
BEGIN
    -- 1. Pega o email do usuário atual do auth.users (via public.users para facilidade)
    SELECT email INTO v_email FROM public.users WHERE id = auth.uid();

    -- 2. Busca o convite pendente para este email
    SELECT organization_id, role INTO v_org_id, v_role
    FROM public.invites
    WHERE id = p_invite_id AND invited_email = v_email AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite não encontrado ou já processado.';
    END IF;

    -- 3. Insere o membro (SECURITY DEFINER garante a permissão)
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, auth.uid(), v_role)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- 4. Marca o convite como aceito
    UPDATE public.invites
    SET status = 'accepted'
    WHERE id = p_invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
