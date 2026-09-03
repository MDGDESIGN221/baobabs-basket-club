// =====================================================================
//  Baobabs Basket Club — fonction serveur : e-mail de confirmation
//
//  OÙ LA COLLER : Supabase → Edge Functions → Deploy a new function
//    Nom EXACT : confirmation-reservation
//    Collez tout ce fichier, puis Deploy.
//
//  SECRETS À RENSEIGNER (Edge Functions → Secrets) :
//    RESEND_API_KEY    — existe déjà : c'est celle de l'e-mail de commande
//    BBC_SENDER_EMAIL  — l'adresse d'expéditeur, sur un domaine vérifié
//                        dans Resend
//    BBC_SENDER_NAME   — facultatif, « Baobabs Basket Club » par défaut
//
//  L'envoi vit dans ../_shared/courriel.ts.
//
//  POURQUOI UNE FONCTION SERVEUR : la clé d'envoi ne doit jamais être
//  dans le site — n'importe qui pourrait la lire et envoyer des e-mails
//  au nom du club. Ici, la clé reste côté serveur, et le contenu de
//  l'e-mail vient de la base : on ne peut pas s'en servir pour envoyer
//  autre chose que la confirmation d'une réservation existante.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { envoyer, destinataire, CourrielNonConfigure } from "../_shared/courriel.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (code: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: code, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { reservation_id } = await req.json().catch(() => ({}));
    if (!reservation_id) return reply(400, { error: "reservation_id manquant" });

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: r } = await db
      .from("reservations")
      .select("*, ticket_offers(category), matches(opponent_name, match_date, match_time, venue, is_home, competition)")
      .eq("id", reservation_id)
      .single();
    if (!r) return reply(404, { error: "réservation introuvable" });
    if (!r.buyer_email) return reply(200, { skipped: "réservation sans adresse e-mail" });
    if (r.status === "annulee" || r.status === "expiree") return reply(409, { error: "réservation " + r.status });

    // Garde anti-rafale : un envoi au plus toutes les 10 minutes par
    // réservation. Protège la boîte du client et le quota d'envoi.
    if (r.confirmation_email_sent && Date.now() - new Date(r.confirmation_email_sent).getTime() < 10 * 60 * 1000) {
      return reply(429, { error: "un e-mail vient déjà de partir pour cette réservation" });
    }

    // La configuration de l'envoi est vérifiée par _shared/courriel.ts,
    // qui lève CourrielNonConfigure — attrapé plus bas.

    const m = r.matches || {};
    const affiche = m.is_home
      ? `Baobabs Basket Club – ${m.opponent_name || "adversaire"}`
      : `${m.opponent_name || "Adversaire"} – Baobabs Basket Club`;
    const dateStr = m.match_date
      ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(m.match_date + "T12:00:00"))
      : "date à confirmer";
    const heure = m.match_time ? String(m.match_time).slice(0, 5) : "";
    const cat = (r.ticket_offers && r.ticket_offers.category) || "";
    const total = new Intl.NumberFormat("fr-FR").format(r.total_fcfa || 0) + " FCFA";

    const ligne = (l: string, v: string) =>
      `<tr><td style="padding:7px 0;font:600 12px Arial,sans-serif;color:#6B7570;text-transform:uppercase;letter-spacing:.08em">${l}</td>` +
      `<td style="padding:7px 0;font:14px Arial,sans-serif;color:#141A16;text-align:right">${v}</td></tr>`;

    const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#EFEDE6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEDE6;padding:26px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="background:#0A1B0D;border-radius:14px 14px 0 0;padding:22px 28px;text-align:center">
    <div style="font:700 12px Arial,sans-serif;letter-spacing:.24em;color:#C6A257">BAOBABS BASKET CLUB</div>
    <div style="font:700 21px Arial,sans-serif;color:#F3EFE6;padding-top:9px">Votre réservation est enregistrée</div>
  </td></tr>
  <tr><td style="background:#FFFFFF;padding:26px 28px 8px">
    <p style="font:14px/1.65 Arial,sans-serif;color:#3A423C;margin:0 0 18px">Bonjour ${r.buyer_name || ""},<br>
    vos places sont réservées. Présentez la référence ci-dessous au guichet le jour du match — <b>le règlement se fait sur place</b>.</p>
    <div style="background:#C6A257;border-radius:11px;padding:16px;text-align:center">
      <div style="font:700 11px Arial,sans-serif;letter-spacing:.16em;color:#0A1B0D;opacity:.75">RÉFÉRENCE À PRÉSENTER</div>
      <div style="font:700 30px Arial,sans-serif;letter-spacing:.1em;color:#0A1B0D;padding-top:4px">${r.reference}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #E4E0D4">
      ${ligne("Match", affiche)}
      ${ligne("Date", dateStr + (heure ? " · " + heure : ""))}
      ${m.venue ? ligne("Lieu", m.venue) : ""}
      ${cat ? ligne("Catégorie", cat) : ""}
      ${ligne("Places", String(r.quantity))}
      ${ligne("À régler sur place", total)}
    </table>
    <p style="font:12.5px/1.6 Arial,sans-serif;color:#6B7570;margin:16px 0 20px">Un empêchement ? Répondez simplement à cet e-mail et le club libérera vos places.</p>
  </td></tr>
  <tr><td style="background:#0A1B0D;border-radius:0 0 14px 14px;padding:15px 28px;text-align:center">
    <span style="font:11px Arial,sans-serif;color:#8A968C">Baobabs Basket Club · Dakar — baobabsbasketclub.com</span>
  </td></tr>
</table>
</td></tr></table></body></html>`;

    const env = await envoyer({
      to: [destinataire(r.buyer_email, r.buyer_name)],
      subject: `Réservation ${r.reference} — ${affiche}`,
      html,
      text:
        `Votre réservation est enregistrée.\n\nRéférence à présenter au guichet : ${r.reference}\n` +
        `Match : ${affiche}\nDate : ${dateStr}${heure ? " · " + heure : ""}\n` +
        (m.venue ? `Lieu : ${m.venue}\n` : "") +
        `Places : ${r.quantity}\nÀ régler sur place : ${total}\n\nBaobabs Basket Club · Dakar`,
    });
    if (!env.ok) return reply(502, { error: "envoi refusé", detail: env.detail });

    await db.from("reservations").update({ confirmation_email_sent: new Date().toISOString() }).eq("id", r.id);
    return reply(200, { sent: true, to: r.buyer_email });
  } catch (e) {
    if (e instanceof CourrielNonConfigure) return reply(500, { error: String(e.message) });
    return reply(500, { error: String(e) });
  }
});
