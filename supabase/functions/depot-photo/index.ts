// =====================================================================
//  Baobabs Basket Club — fonction serveur : dépôt d'une photo publique
//
//  NOM DE DÉPLOIEMENT : depot-photo
//    npx supabase functions deploy depot-photo --project-ref lmwbwasupqkvswukieav
//
//  Aucun secret nouveau : elle n'utilise que les variables que Supabase
//  fournit d'office (SUPABASE_URL, SUPABASE_ANON_KEY,
//  SUPABASE_SERVICE_ROLE_KEY).
//
//  POURQUOI CETTE FONCTION EXISTE
//
//  Le bucket recruitment-photos était ouvert en écriture au rôle anon :
//
//    create policy "recruitment_photos_public_upload"
//      on storage.objects for insert to anon
//      with check (bucket_id = 'recruitment-photos');
//
//  MIGRATION-SUPABASE-v6.sql l'écrivait elle-même, en note de bas de
//  page : « cette policy autorise techniquement n'importe qui à envoyer
//  un fichier vers ce bucket », et proposait la suite : « passer par une
//  Edge Function qui valide et relaie l'upload, plutôt qu'un accès
//  direct ». C'est ce fichier.
//
//  Ce que la policy ne protégeait pas, et que personne ne voit de
//  l'extérieur :
//
//    1. LE CONTENU N'ÉTAIT JAMAIS REGARDÉ. La liste allowed_mime_types
//       du bucket vérifie l'en-tête Content-Type ANNONCÉ par l'appelant,
//       pas les octets. Un fichier quelconque étiqueté image/png
//       entrait. Ici, les formats sont reconnus à leurs premiers octets,
//       et ces octets-là, on ne les choisit pas sans fabriquer un vrai
//       fichier du bon format.
//
//    2. IL N'Y AVAIT AUCUN PLAFOND DE NOMBRE. Cinq mégaoctets par
//       fichier, mais autant de fichiers qu'on voulait, chacun sur un
//       chemin neuf (Date.now()). Un script remplissait le quota de
//       stockage du projet en quelques minutes, et la facture avec.
//
//    3. LES DEUX PLAFONDS SE CONTREDISAIENT. joueuse.html acceptait
//       25 Mo et envoyait la photo telle quelle — c'est une décision
//       écrite, le club veut l'original pour cadrer lui-même — mais le
//       bucket refusait au-delà de 5 Mo. Une photo de téléphone récent
//       passait le contrôle, partait, et échouait à l'arrivée. Un seul
//       plafond désormais, celui d'en dessous, et le bucket est monté
//       pour le suivre.
//
//  DEUX USAGES, ET ILS NE PROUVENT PAS LA MÊME CHOSE
//
//    « collecte »    joueuse.html. La personne arrive avec un jeton de
//                    campagne (?t=) ou son jeton de reprise. La fonction
//                    le vérifie auprès de la base : sans jeton valide,
//                    rien ne passe. C'est le cas fort.
//
//    « candidature » index.html. La photo part AVANT que la candidature
//                    existe : il n'y a rien à vérifier, et c'est dans la
//                    nature du formulaire. On ne peut donc pas fermer,
//                    on peut seulement limiter le débit — voir plus bas.
//
//  CE QU'ELLE NE PROTÈGE PAS. Quelqu'un peut toujours déposer une photo
//  de candidature sans être candidat. C'est le principe de la boîte aux
//  lettres : tout le monde peut y glisser une lettre, seul le club
//  l'ouvre. Ce qui change, c'est qu'il ne peut plus y glisser autre
//  chose qu'une image, ni en glisser mille.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (code: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: code, headers: { ...CORS, "Content-Type": "application/json" } });

const BUCKET = "recruitment-photos";

// 25 Mo : le plafond que joueuse.html annonce déjà, pour laisser passer
// les photos des téléphones à 48 Mpx qui dépassaient 12 Mo. Le bucket a
// été monté à la même valeur (voir le SQL compagnon), sans quoi la
// fonction accepterait ce que le stockage refuse — l'erreur d'avant,
// déplacée d'un cran.
const MAX = 25 * 1024 * 1024;

// Un fichier de moins de 512 octets n'est pas une photo. C'est le même
// garde-fou que depot-piece : il attrape les envois vides.
const MIN = 512;

// COMBIEN DE PHOTOS PAR HEURE, DEPUIS UNE MÊME ADRESSE.
// Douze : un candidat s'y reprend deux ou trois fois, une famille de
// trois enfants en envoie trois. Douze laisse de la marge à tout le
// monde et arrête un script en douze requêtes.
const DEBIT_MAX = 12;
const DEBIT_FENETRE_MIN = 60;

// Les quatre formats acceptés, reconnus à leurs premiers octets.
//   JPEG  FF D8 FF
//   PNG   89 P N G CR LF 1A LF
//   WEBP  « RIFF » .... « WEBP »
//   GIF   « GIF87a » ou « GIF89a »
// Le PDF n'en fait pas partie : ici on dépose un visage, pas un dossier.
// Les pièces administratives passent par depot-piece et son bucket privé.
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
function formatReel(b: Uint8Array): string | null {
  const a = (i: number) => b[i];
  if (b.length >= 3 && a(0) === 0xff && a(1) === 0xd8 && a(2) === 0xff) return "image/jpeg";
  if (b.length >= 8 && a(0) === 0x89 && a(1) === 0x50 && a(2) === 0x4e && a(3) === 0x47 &&
      a(4) === 0x0d && a(5) === 0x0a && a(6) === 0x1a && a(7) === 0x0a) return "image/png";
  if (b.length >= 12 && a(0) === 0x52 && a(1) === 0x49 && a(2) === 0x46 && a(3) === 0x46 &&
      a(8) === 0x57 && a(9) === 0x45 && a(10) === 0x42 && a(11) === 0x50) return "image/webp";
  if (b.length >= 6 && a(0) === 0x47 && a(1) === 0x49 && a(2) === 0x46 && a(3) === 0x38 &&
      (a(4) === 0x37 || a(4) === 0x39) && a(5) === 0x61) return "image/gif";
  return null;
}

// L'ADRESSE DE L'APPELANT, TELLE QUE LE PROXY LA DONNE.
// x-forwarded-for peut porter une liste ; la première est celle du
// client. Elle est falsifiable en théorie, et c'est pour ça que le débit
// est un filet et pas une serrure : la serrure, c'est le contrôle des
// octets, qui ne se contourne pas.
function adresse(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const premier = xff.split(",")[0].trim();
  return premier || req.headers.get("cf-connecting-ip") || "inconnue";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return reply(400, { error: "requete_illisible" });

    const usage   = String(form.get("usage") || "");
    const jeton   = String(form.get("jeton") || "");
    const reprise = String(form.get("reprise") || "");
    const fichier = form.get("fichier");

    if (usage !== "collecte" && usage !== "candidature") {
      return reply(400, { error: "usage_inconnu" });
    }
    if (!(fichier instanceof File)) return reply(400, { error: "fichier_manquant" });
    if (fichier.size > MAX) return reply(413, { error: "fichier_trop_lourd" });
    if (fichier.size < MIN) return reply(400, { error: "fichier_vide" });

    const bytes = new Uint8Array(await fichier.arrayBuffer());

    // --- 1. LES OCTETS, AVANT TOUT LE RESTE.
    // On ne regarde pas ce que l'appelant annonce : on regarde ce qu'il
    // envoie. L'extension du fichier déposé viendra de là, elle aussi.
    const reel = formatReel(bytes);
    if (!reel) return reply(400, { error: "format_refuse" });
    const ext = EXT[reel];

    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- 2. LE DÉBIT. Compté en base, pour que deux appels simultanés
    // sur deux instances de la fonction voient le même compteur.
    // bbc_photo_debit renvoie le nombre d'envois déjà faits dans la
    // fenêtre, après avoir compté celui-ci.
    const { data: debit, error: eDebit } = await db.rpc("bbc_photo_debit", {
      p_ip: adresse(req), p_fenetre_min: DEBIT_FENETRE_MIN,
    });
    if (!eDebit && typeof debit === "number" && debit > DEBIT_MAX) {
      return reply(429, { error: "trop_d_envois" });
    }
    // Une erreur sur le compteur ne bloque pas un dépôt légitime : le
    // débit est un filet. Si la fonction SQL n'est pas encore passée, le
    // contrôle des octets protège déjà.

    // --- 3. QUI DÉPOSE ? Seulement pour la collecte, qui a un jeton.
    let dossier = "candidatures";
    if (usage === "collecte") {
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
      let bon = false;
      if (reprise) {
        // Une reprise : la fiche existe, le jeton personnel l'ouvre.
        const { data } = await anon.rpc("bbc_collecte_reprendre", { p_reprise: reprise });
        bon = !!(data && (Array.isArray(data) ? data.length : data));
      } else if (jeton) {
        // Un premier dépôt : le jeton de campagne doit être ouvert.
        const { data } = await anon.rpc("bbc_collecte_ouvrir", { p_jeton: jeton });
        const ligne = Array.isArray(data) ? data[0] : data;
        bon = !!(ligne && ligne.ok === true);
      }
      if (!bon) return reply(403, { error: "jeton_invalide" });
      dossier = "profils";
    }

    // --- 4. LE FICHIER. Le nom est fabriqué ici, entièrement : celui
    // que le navigateur envoie ne sert à rien et peut porter n'importe
    // quoi. Un horodatage, six caractères au hasard, et l'extension que
    // les OCTETS ont dictée — pas celle que l'appelant a écrite.
    const alea = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
    const chemin = `${dossier}/${Date.now()}-${alea}.${ext}`;

    const { error: eUp } = await db.storage.from(BUCKET).upload(chemin, bytes, {
      // Le type vient de la lecture des octets, jamais de l'annonce :
      // c'est ce qui garantit qu'un fichier déposé ne sera pas resservi
      // avec un type qui le rendrait exécutable dans un navigateur.
      contentType: reel,
      upsert: false,
    });
    if (eUp) return reply(502, { error: "televersement_refuse", detail: eUp.message });

    return reply(200, {
      ok: true,
      url: `${url}/storage/v1/object/public/${BUCKET}/${chemin}`,
    });
  } catch (e) {
    return reply(500, { error: String(e) });
  }
});
