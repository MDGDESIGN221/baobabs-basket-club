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

// Douze fichiers par dossier au maximum. Il y a quatre pieces a fournir,
// et on accepte qu'une famille s'y reprenne : douze laisse de la marge.
// Sans plafond, le meme couple reference + telephone peut ecrire sans fin
// dans le bucket -- chaque envoi porte un horodatage, donc un chemin neuf,
// donc rien n'ecrase rien. Ce n'est pas un vol de donnees, c'est une
// facture de stockage qui grimpe et un dossier illisible.
const MAX_PIECES_PAR_DOSSIER = 12;

// LE TYPE ANNONCE N'EST PAS LE TYPE REEL.
//
// Le navigateur declare « mime: image/png » et le bucket verifie cette
// declaration, pas les octets. La liste de types du bucket ne protege
// donc de rien : un fichier quelconque etiquete image/png entrait.
//
// Les quatre formats acceptes se reconnaissent a leurs premiers octets,
// et ces octets-la, personne ne les choisit sans fabriquer un vrai
// fichier du bon format.
//
//   JPEG  FF D8 FF
//   PNG   89 P N G CR LF 1A LF
//   WEBP  « RIFF » .... « WEBP »
//   PDF   « %PDF- »
function formatReel(b: Uint8Array): string | null {
  const a = (i: number) => b[i];
  if (b.length >= 3 && a(0) === 0xff && a(1) === 0xd8 && a(2) === 0xff) return "image/jpeg";
  if (b.length >= 8 && a(0) === 0x89 && a(1) === 0x50 && a(2) === 0x4e && a(3) === 0x47 &&
      a(4) === 0x0d && a(5) === 0x0a && a(6) === 0x1a && a(7) === 0x0a) return "image/png";
  if (b.length >= 12 && a(0) === 0x52 && a(1) === 0x49 && a(2) === 0x46 && a(3) === 0x46 &&
      a(8) === 0x57 && a(9) === 0x45 && a(10) === 0x42 && a(11) === 0x50) return "image/webp";
  if (b.length >= 5 && a(0) === 0x25 && a(1) === 0x50 && a(2) === 0x44 && a(3) === 0x46 &&
      a(4) === 0x2d) return "application/pdf";
  return null;
}

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

    // LES OCTETS DOIVENT DIRE LA MEME CHOSE QUE L'ANNONCE. Un fichier
    // dont le contenu ne correspond a aucun des quatre formats, ou qui
    // se presente sous un autre que le sien, ne passe pas. Le message
    // reste le meme que pour un format refuse : la famille n'a pas a
    // apprendre ce qu'est un octet d'en-tete, elle a a savoir que sa
    // photo n'est pas passee.
    const reel = formatReel(bytes);
    if (!reel || reel !== String(mime)) return reply(400, { error: "format_refuse" });

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

    // Le dossier est-il deja plein ? On compte avant d'ecrire. Un dossier
    // qui a atteint douze fichiers a soit quatre pieces et huit
    // corrections, soit quelqu'un qui joue avec le formulaire : dans les
    // deux cas, c'est au club de regarder.
    const { data: deja } = await db.storage.from("dossiers-prives")
      .list(ref, { limit: MAX_PIECES_PAR_DOSSIER + 1 });
    if (deja && deja.length >= MAX_PIECES_PAR_DOSSIER) {
      return reply(429, { error: "dossier_plein" });
    }

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
