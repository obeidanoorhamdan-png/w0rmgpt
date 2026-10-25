CREATE TABLE public.seller_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.seller_api_keys TO service_role;
ALTER TABLE public.seller_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_codes ADD COLUMN created_by_key_id UUID REFERENCES public.seller_api_keys(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.gift_codes.created_by_key_id IS 'Seller API key that created this code; NULL when created from the admin panel';