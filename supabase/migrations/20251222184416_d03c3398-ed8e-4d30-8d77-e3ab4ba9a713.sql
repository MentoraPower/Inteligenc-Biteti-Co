-- Remove duplicate facebook_ads_connections keeping only the most recent one
DELETE FROM facebook_ads_connections 
WHERE id IN ('6336f0e2-62bd-4a90-b858-0513952ec8a2', '64e971bd-5a3e-4aa2-88ea-590a9e9aa01a');