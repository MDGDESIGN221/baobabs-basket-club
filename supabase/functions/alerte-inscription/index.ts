// =====================================================================
//  Baobabs Basket Club — fonction serveur : alerte nouvelle inscription
//
//  OÙ LA COLLER : Supabase → Edge Functions → Deploy a new function
//    Nom EXACT : alerte-inscription
//    Collez tout ce fichier, puis Deploy.
//
//  SECRETS (Edge Functions → Secrets)
//    RESEND_API_KEY    — existe déjà : c'est celle de l'e-mail de commande
//    BBC_SENDER_EMAIL  — À AJOUTER : l'adresse d'expéditeur, sur un
//                        domaine vérifié dans Resend
//    BBC_SENDER_NAME   — facultatif
//    BBC_ALERT_EMAIL   — À AJOUTER : l'adresse qui reçoit l'alerte.
//                        Plusieurs adresses possibles, séparées par des
//                        virgules. Si absent, l'alerte part sur
//                        BBC_SENDER_EMAIL.
//
//  L'envoi lui-même vit dans ../_shared/courriel.ts — un seul endroit
//  pour les trois fonctions qui écrivent au club ou aux familles.
//
//  CE QU'ELLE FAIT
//  À chaque inscription déposée sur le site, elle envoie un e-mail au
//  club avec l'essentiel : l'enfant, le responsable, le téléphone, la
//  référence. Sans elle, une inscription attend qu'on pense à ouvrir
//  l'admin — et la page promet un rappel « sous 48 h ».
//
//  POURQUOI ELLE RELIT LA BASE
//  Le webhook envoie déjà la ligne complète dans son appel. On ne s'en
//  sert que pour l'identifiant, et on relit la ligne côté serveur : ce
//  qui part par e-mail vient ainsi toujours de la base, jamais du corps
//  de la requête. Quelqu'un qui devinerait l'adresse de la fonction ne
//  pourrait pas s'en servir pour faire envoyer un texte de son choix.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { envoyer, CourrielNonConfigure } from "../_shared/courriel.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (code: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: code, headers: { ...CORS, "Content-Type": "application/json" } });

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // Un webhook Supabase poste { type, table, record, old_record, schema }.
    // On accepte aussi un appel direct { registration_id } pour pouvoir
    // tester la fonction à la main depuis le tableau de bord.
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const rec = (body as { record?: { id?: string } }).record;
    const id = rec?.id ?? (body as { registration_id?: string }).registration_id;
    if (!id) return reply(400, { error: "identifiant d'inscription manquant" });

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: r, error } = await db
      .from("academy_registrations")
      .select("reference, child_first_name, child_last_name, birth_date, gender, category, district, school, guardian_name, guardian_relation, guardian_phone, guardian_phone2, guardian_email, health_notes, message, created_at")
      .eq("id", id)
      .single();
    if (error || !r) return reply(404, { error: "inscription introuvable" });

    const senderEmail = Deno.env.get("BBC_SENDER_EMAIL");
    if (!senderEmail) return reply(500, { error: "BBC_SENDER_EMAIL manquant" });

    const destinataires = (Deno.env.get("BBC_ALERT_EMAIL") || senderEmail)
      .split(",").map((e) => e.trim()).filter(Boolean);

    const enfant = `${r.child_first_name ?? ""} ${r.child_last_name ?? ""}`.trim();
    const age = r.birth_date
      ? Math.floor((Date.now() - new Date(r.birth_date as string).getTime()) / 31557600000)
      : null;

    const ligne = (k: string, v: unknown) =>
      v ? `<tr><td style="padding:6px 14px 6px 0;color:#7E8A82;font-size:13px">${esc(k)}</td>
             <td style="padding:6px 0;color:#0A150F;font-size:14px;font-weight:600">${esc(v)}</td></tr>` : "";

    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#C6A257;font-weight:700">
    École de basket — nouvelle inscription</div>
  <h1 style="font-size:24px;color:#0A150F;margin:10px 0 4px">${esc(enfant || "Inscription")}</h1>
  <div style="display:inline-block;background:#0B2419;color:#A8D93B;font-weight:700;
              letter-spacing:.08em;padding:6px 12px;border-radius:6px;font-size:14px">
    ${esc(r.reference)}</div>
  <table style="width:100%;border-collapse:collapse;margin-top:20px">
    ${ligne("Catégorie", r.category)}
    ${ligne("Né(e) le", r.birth_date)}
    ${ligne("Âge", age !== null ? `${age} ans` : "")}
    ${ligne("Sexe", r.gender === "F" ? "Fille" : r.gender === "M" ? "Garçon" : "")}
    ${ligne("Quartier", r.district)}
    ${ligne("École", r.school)}
    <tr><td colspan="2" style="padding-top:14px"><hr style="border:none;border-top:1px solid #E4E1D9"></td></tr>
    ${ligne("Responsable", r.guardian_name)}
    ${ligne("Lien", r.guardian_relation)}
    ${ligne("Téléphone", r.guardian_phone)}
    ${ligne("Second numéro", r.guardian_phone2)}
    ${ligne("Email", r.guardian_email)}
    ${ligne("Santé", r.health_notes)}
    ${ligne("Message", r.message)}
  </table>
  <p style="margin-top:22px">
    <a href="https://www.baobabsbasketclub.com/admin-matchs.html"
       style="background:#A8D93B;color:#0A1B0D;font-weight:700;text-decoration:none;
              padding:13px 22px;border-radius:8px;display:inline-block">Ouvrir le dossier</a>
  </p>
  <p style="font-size:12px;color:#7E8A82;line-height:1.6;margin-top:18px">
    La page Inscriptions annonce un rappel sous 48 h. Le dossier est dans
    l'admin, menu Recrutement → Inscriptions.</p>
</div>`;

    const env = await envoyer({
      to: destinataires,
      // Le téléphone dans l'objet : sur un écran de téléphone, on peut
      // rappeler la famille sans même ouvrir le message.
      subject: `Inscription ${r.reference} — ${enfant}${r.guardian_phone ? " · " + r.guardian_phone : ""}`,
      html,
    });

    if (!env.ok) return reply(502, { error: "envoi refusé", detail: env.detail });
    return reply(200, { sent: true, reference: r.reference, to: destinataires.length });
  } catch (e) {
    if (e instanceof CourrielNonConfigure) return reply(500, { error: String(e.message) });
    return reply(500, { error: String(e) });
  }
});
