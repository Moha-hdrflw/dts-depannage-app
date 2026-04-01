-- ============================================
-- DTS Dépannage Élec — Schéma Supabase
-- Exécuter dans l'éditeur SQL de Supabase
-- ============================================

-- Table USERS (profils liés à auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  prenom TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'technicien')),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT,
  adresse TEXT,
  type_client TEXT NOT NULL DEFAULT 'particulier' CHECK (type_client IN ('particulier', 'pro')),
  date_creation DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table INTERVENTIONS
CREATE TABLE IF NOT EXISTS public.interventions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  technicien_id UUID REFERENCES public.users(id),
  technicien_nom TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  heure TIME,
  type_panne TEXT NOT NULL,
  type_panne_autre TEXT,
  prix_autre NUMERIC(10,2),
  creneau TEXT NOT NULL DEFAULT 'journee' CHECK (creneau IN ('journee', 'nuit')),
  duree_heures NUMERIC(4,1),
  mise_en_securite BOOLEAN DEFAULT false,
  montant_ht NUMERIC(10,2),
  tva_taux INTEGER DEFAULT 10,
  montant_ttc NUMERIC(10,2),
  mode_paiement TEXT CHECK (mode_paiement IN ('CB', 'Cash', 'Virement')),
  notes_technicien TEXT,
  facture_editee BOOLEAN DEFAULT false,
  facture_envoyee BOOLEAN DEFAULT false,
  date_facture TIMESTAMPTZ,
  sms_avis_envoye BOOLEAN DEFAULT false,
  sms_j1_envoye BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table PHOTOS
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  intervention_id UUID REFERENCES public.interventions(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  type TEXT CHECK (type IN ('avant', 'apres')),
  date_upload TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Helper : récupérer le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- USERS : lecture pour tous les connectés, écriture admin uniquement
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "users_update" ON public.users FOR UPDATE TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "users_delete" ON public.users FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- CLIENTS : admin voit tout, technicien voit ses clients du jour
CREATE POLICY "clients_admin" ON public.clients FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "clients_technicien_select" ON public.clients FOR SELECT TO authenticated
  USING (
    get_my_role() = 'technicien' AND
    id IN (
      SELECT client_id FROM public.interventions
      WHERE technicien_id = auth.uid() AND date = CURRENT_DATE
    )
  );

CREATE POLICY "clients_technicien_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'technicien'));

-- INTERVENTIONS : admin voit tout, technicien voit les siennes du jour
CREATE POLICY "interventions_admin" ON public.interventions FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "interventions_technicien_select" ON public.interventions FOR SELECT TO authenticated
  USING (get_my_role() = 'technicien' AND technicien_id = auth.uid() AND date = CURRENT_DATE);

CREATE POLICY "interventions_technicien_insert" ON public.interventions FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'technicien' AND technicien_id = auth.uid());

-- Permet à tout utilisateur authentifié de mettre à jour les badges (facture, sms)
CREATE POLICY "interventions_update_badges" ON public.interventions FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- PHOTOS
CREATE POLICY "photos_admin" ON public.photos FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

CREATE POLICY "photos_technicien" ON public.photos FOR ALL TO authenticated
  USING (
    get_my_role() = 'technicien' AND
    client_id IN (
      SELECT client_id FROM public.interventions
      WHERE technicien_id = auth.uid() AND date = CURRENT_DATE
    )
  );

-- ============================================
-- Bucket Storage pour les photos
-- ============================================
-- 1. Dans Supabase Dashboard > Storage, créer un bucket "photos" (cocher Public)
-- 2. Exécuter ces politiques Storage :

INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "storage_photos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "storage_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "storage_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'photos');

CREATE POLICY "storage_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'photos');

-- ============================================
-- Trigger : auto-insert profil à l'inscription
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, prenom, role, actif)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'prenom', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'technicien'),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
