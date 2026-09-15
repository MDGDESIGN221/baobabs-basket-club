-- =====================================================================
--  LE RECADRAGE D'UNE PIECE NE PERD PLUS L'ORIGINAL
--  --------------------------------------------------------------------
--  Dans Inscriptions, « Recadrer » la photo d'identite d'un enfant
--  fabriquait une image coupee et REMPLACAIT l'adresse de la piece par
--  celle-ci : quelques jours plus tard, impossible de recadrer plus
--  large, l'original televerse n'etait plus reference nulle part (le
--  fichier restait dans le bucket, orphelin). Signale par le club le
--  14 septembre 2026.
--  `url_origine` garde la premiere adresse : chaque recadrage repart de
--  l'original, jamais de la coupe precedente.
-- =====================================================================

alter table public.academy_documents
  add column if not exists url_origine text;
