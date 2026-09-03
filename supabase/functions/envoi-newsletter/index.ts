// =====================================================================
//  Baobabs Basket Club — fonction serveur : envoi de la newsletter
//
//  OÙ LA COLLER : Supabase → Edge Functions → Deploy a new function
//    Nom EXACT : envoi-newsletter
//    Collez tout ce fichier, puis Deploy.
//
//  SECRETS : les mêmes que les autres envois du club —
//    RESEND_API_KEY (existe déjà), BBC_SENDER_EMAIL,
//    BBC_SENDER_NAME (facultatif). L'envoi vit dans
//    ../_shared/courriel.ts.
//
//  SÉCURITÉ : seul un compte administrateur (table admin_users) peut
//  déclencher un envoi — la fonction vérifie le jeton de session de
//  l'appelant avant toute chose. Les destinataires ne se voient jamais
//  entre eux : un message par personne, pas de liste apparente.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { envoyer, envoyerLot, destinataire, LOT_MAX, CourrielNonConfigure } from "../_shared/courriel.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (code: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: code, headers: { ...CORS, "Content-Type": "application/json" } });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildHtml(subject: string, body: string): string {
  const paras = body.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#2A2E2B">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
  ).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F0EFEA">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px">
    <div style="background:#0A1B0D;border-radius:14px 14px 0 0;padding:22px 26px">
      <div style="font-family:Arial,sans-serif;font-weight:700;font-size:13px;letter-spacing:.18em;color:#C6A257">BAOBABS BASKET CLUB</div>
    </div>
    <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:26px;font-family:Arial,sans-serif">
      <h1 style="margin:0 0 18px;font-size:20px;line-height:1.3;color:#0A1B0D">${escapeHtml(subject)}</h1>
      ${paras}
    </div>
    <p style="font-family:Arial,sans-serif;font-size:11.5px;line-height:1.6;color:#8A918B;text-align:center;margin:16px 8px 0">
      Vous recevez cet e-mail parce que vous êtes inscrit à la newsletter du Baobabs Basket Club.<br>
      Pour ne plus la recevoir, répondez simplement «&nbsp;STOP&nbsp;» à ce message.
    </p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { subject, body, test_email } = await req.json().catch(() => ({}));
    if (!subject || !String(subject).trim()) return reply(400, { error: "sujet manquant" });
    if (!body || !String(body).trim()) return reply(400, { error: "message manquant" });

    // --- L'appelant est-il administrateur ? ---
    const auth = req.headers.get("Authorization") || "";
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: isAdmin } = await caller.rpc("is_admin");
    if (!isAdmin) return reply(403, { error: "réservé aux administrateurs" });

    // La configuration de l'envoi est vérifiée par _shared/courriel.ts,
    // qui lève CourrielNonConfigure — attrapé plus bas.

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const html = buildHtml(String(subject), String(body));

    // --- Mode test : un seul destinataire, rien n'est journalisé ---
    if (test_email) {
      const t = await envoyer({
        to: [String(test_email)],
        subject: `[TEST] ${subject}`,
        html,
      });
      if (!t.ok) return reply(502, { error: "l'envoi du test a échoué", detail: t.detail });
      return reply(200, { test: true, to: test_email });
    }

    // --- Garde anti-rafale : pas deux envois réels en moins de 10 minutes ---
    const { data: last } = await db
      .from("newsletter_sends")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (last && last[0] && Date.now() - new Date(last[0].created_at).getTime() < 10 * 60 * 1000) {
      return reply(429, { error: "un envoi vient déjà de partir — attendez quelques minutes" });
    }

    // --- Les destinataires ---
    const { data: subs } = await db
      .from("newsletter_subscribers")
      .select("email, name")
      .order("created_at", { ascending: true });
    const list = (subs || []).filter((s) => s.email && /@/.test(s.email));
    if (!list.length) return reply(200, { sent: 0, failed: 0, note: "aucun inscrit" });

    // --- Envoi par paquets : UN MESSAGE PAR PERSONNE, jamais de liste
    // visible. Brevo le faisait avec messageVersions et acceptait mille
    // versions par appel ; Resend prend un objet complet par
    // destinataire, cent au maximum. Le paquet passe donc de 400 à 100 —
    // c'est la seule chose que le changement de fournisseur impose ici.
    //
    // Le prénom de l'abonné part avec l'adresse (destinataire()), comme
    // avec Brevo : sans lui, le message arrive adressé à une adresse nue
    // dans le client de messagerie plutôt qu'à une personne.
    let sent = 0, failed = 0;
    for (let i = 0; i < list.length; i += LOT_MAX) {
      const batch = list.slice(i, i + LOT_MAX);
      const env = await envoyerLot(batch.map((s) => ({
        to: [destinataire(s.email as string, s.name as string | undefined)],
        subject: String(subject),
        html,
      })));
      if (env.ok) sent += batch.length; else failed += batch.length;
    }

    await db.from("newsletter_sends").insert({
      subject: String(subject),
      body: String(body),
      recipients: list.length,
      sent,
      failed,
    });

    return reply(200, { sent, failed, recipients: list.length });
  } catch (e) {
    if (e instanceof CourrielNonConfigure) return reply(500, { error: String(e.message) });
    return reply(500, { error: String(e) });
  }
});
