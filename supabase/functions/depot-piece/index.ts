// =====================================================================
//  Baobabs Basket Club — fonction serveur : dépôt d'une pièce de dossier
//
//  NOM DE DÉPLOIEMENT : depot-piece
//    npx supabase functions deploy depot-piece
//
//  Aucun secret nouveau : elle n'utilise que les variables que Supabase
//  fournit d'office (SUPABASE_URL, SUPABASE_ANON_KEY,
//  SUPABASE_SERVICE_ROLE_KEY).
//
//  POURQUOI CETTE FONCTION EXISTE
//  Une famille doit pouvoir envoyer le certificat médical de son enfant
//  depuis son téléphone. Mais des documents d'identité de mineurs ne
//  peuvent pas vivre dans un espace de stockage ouvert en écriture au
//  public — c'était la raison pour laquelle le dépôt depuis le site
//  avait été écarté.
//
//  Ici, le navigateur n'obtient AUCUN accès au stockage. Il envoie le
//  fichier à cette fonction, qui :
//    1. vérifie le couple référence + téléphone du responsable ;
//    2. écrit dans un bucket PRIVÉ avec la clé de service ;
//    3. enregistre la ligne par bbc_piece_deposer, qui refait la même
//       vérification — une fonction serveur peut être appelée
//       directement, on ne lui fait pas confiance sur parole.
//
//  Ce qu'on accepte : quelqu'un qui connaît la référence ET le
//  téléphone d'une famille peut déposer une pièce à sa place. C'est le
//  même niveau que le suivi parent. Le risque est qu'un inconnu AJOUTE
//  un document, pas qu'il en LISE un.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (code: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: code, headers: { ...CORS, "Content-Type": "application/json" } });

const PIECES = ["photo", "naissance", "medical", "autorisation"];
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};
// 8 Mo comme le bucket. Le site compresse avant d'envoyer : une photo de
// telephone tombe autour de 300 Ko, on est tres loin du plafond.
const MAX = 8 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { reference, phone, kind, mime, data } = await req.json().catch(() => ({}));

    if (!reference || !phone) return reply(400, { error: "reference_ou_telephone_manquant" });
    if (!PIECES.includes(String(kind))) return reply(400, { error: "piece_inconnue" });
    const ext = TYPES[String(mime)];
    if (!ext) return reply(400, { error: "format_refuse" });
    if (!data || typeof data !== "string") return reply(400, { error: "fichier_manquant" });

    // base64 -> octets. On mesure APRES decodage : la chaine base64 fait
    // un tiers de plus que le fichier, et refuser sur sa longueur
    // rejetterait des fichiers parfaitement admissibles.
    let bytes: Uint8Array;
    try {
      const brut = atob(String(data).replace(/^data:[^,]+,/, ""));
      bytes = new Uint8Array(brut.length);
      for (let i = 0; i < brut.length; i++) bytes[i] = brut.charCodeAt(i);
    } catch { return reply(400, { error: "fichier_illisible" }); }
    if (bytes.length > MAX) return reply(413, { error: "fichier_trop_lourd" });
    if (bytes.length < 512) return reply(400, { error: "fichier_vide" });

    const url = Deno.env.get("SUPABASE_URL")!;

    // --- 1. Le couple est-il bon ? On le demande avec la cle publique,
    // exactement comme le ferait le navigateur : si le dossier n'existe
    // pas, la fonction leve et on s'arrete avant de toucher au stockage.
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: suivi, error: eSuivi } = await anon.rpc("bbc_inscription_suivi", {
      p_reference: String(reference), p_phone: String(phone),
    });
    if (eSuivi || !suivi || !suivi.length) return reply(403, { error: "dossier_introuvable" });

    // --- 2. Le fichier, dans le bucket prive, avec la cle de service.
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ref = String(reference).toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const chemin = `${ref}/${kind}-${Date.now()}.${ext}`;
    const { error: eUp } = await db.storage.from("dossiers-prives").upload(chemin, bytes, {
      contentType: String(mime), upsert: true,
    });
    if (eUp) return reply(502, { error: "televersement_refuse", detail: eUp.message });

    // --- 3. La ligne du dossier. bbc_piece_deposer refait la
    // verification : si elle echoue, on retire le fichier qu'on vient
    // d'ecrire plutot que de le laisser orphelin dans le bucket.
    const { error: ePiece } = await db.rpc("bbc_piece_deposer", {
      p_reference: String(reference), p_phone: String(phone),
      p_kind: String(kind), p_url: chemin,
    });
    if (ePiece) {
      await db.storage.from("dossiers-prives").remove([chemin]).catch(() => {});
      return reply(403, { error: ePiece.message || "depot_refuse" });
    }

    // On rend l'etat du dossier : le site peut dire ce qui manque encore
    // sans reinterroger.
    const { data: apres } = await anon.rpc("bbc_inscription_suivi", {
      p_reference: String(reference), p_phone: String(phone),
    });
    const etat = (apres && apres[0]) || null;
    return reply(200, {
      ok: true, kind,
      dossier_complet: etat ? etat.dossier_complet : null,
      pieces_manquantes: etat ? etat.pieces_manquantes : null,
    });
  } catch (e) {
    return reply(500, { error: String(e) });
  }
});
