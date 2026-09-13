// =====================================================================
//  Baobabs Basket Club — fonction serveur : envoi de la newsletter
//
//  DÉPLOYÉE LE 13 SEPTEMBRE 2026 sous le slug « envoi-newsletter »,
//  celui que l'admin appelle (FN.newsletter). Pour la redéployer après
//  une modification, avec ce fichier ET ../_shared/courriel.ts :
//    npx supabase functions deploy envoi-newsletter --project-ref lmwbwasupqkvswukieav
//  Jamais par « Deploy a new function » du tableau de bord : le slug y
//  est tiré au sort et l'admin ne la trouverait plus.
//
//  SECRETS : les mêmes que les autres envois du club —
//    RESEND_API_KEY (existe déjà), BBC_SENDER_EMAIL,
//    BBC_SENDER_NAME (facultatif). L'envoi vit dans
//    ../_shared/courriel.ts. L'écran Newsletter demande { action:"etat" }
//    à l'ouverture et affiche ce qui manque, secret par secret.
//
//  SÉCURITÉ : seul un compte administrateur (table admin_users) peut
//  déclencher un envoi — la fonction vérifie le jeton de session de
//  l'appelant avant toute chose. Les destinataires ne se voient jamais
//  entre eux : un message par personne, pas de liste apparente.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { envoyer, envoyerLot, destinataire, etat, LOT_MAX, CourrielNonConfigure } from "../_shared/courriel.ts";

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
    const { action, subject, body, test_email } = await req.json().catch(() => ({}));

    // --- L'appelant est-il administrateur ? ---
    const auth = req.headers.get("Authorization") || "";
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: isAdmin } = await caller.rpc("is_admin");
    if (!isAdmin) return reply(403, { error: "réservé aux administrateurs" });

    // --- L'état de l'envoi, demandé par l'écran Newsletter à l'ouverture.
    // Rien ne part : on dit seulement ce qui est en place et ce qui
    // manque, pour ne pas rédiger un message entier avant d'apprendre
    // qu'aucune adresse d'expédition n'existe. Voir etat() dans
    // _shared/courriel.ts.
    if (action === "etat") return reply(200, await etat());

    if (!subject || !String(subject).trim()) return reply(400, { error: "sujet manquant" });
    if (!body || !String(body).trim()) return reply(400, { error: "message manquant" });

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
    // Une adresse inscrite deux fois (le formulaire du site ne l'empêche
    // pas) ne reçoit qu'un message : on dédoublonne, sans tenir compte
    // de la casse.
    const vus = new Set<string>();
    const list = (subs || []).filter((s) => {
      const e = String(s.email || "").trim().toLowerCase();
      if (!e || !/@/.test(e) || vus.has(e)) return false;
      vus.add(e);
      return true;
    });
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
    //
    // Un paquet refusé l'est pour une raison que Resend écrit en clair
    // (domaine non vérifié, quota du jour atteint, clé refusée). On la
    // garde pour la rendre à l'écran : « 3 échecs » sans la cause, c'est
    // une heure de recherche.
    let sent = 0, failed = 0, detail = "";
    for (let i = 0; i < list.length; i += LOT_MAX) {
      const batch = list.slice(i, i + LOT_MAX);
      const env = await envoyerLot(batch.map((s) => ({
        to: [destinataire(s.email as string, s.name as string | undefined)],
        subject: String(subject),
        html,
      })));
      if (env.ok) sent += batch.length; else { failed += batch.length; detail = env.detail; }
    }

    await db.from("newsletter_sends").insert({
      subject: String(subject),
      body: String(body),
      recipients: list.length,
      sent,
      failed,
    });

    return reply(200, { sent, failed, recipients: list.length, detail });
  } catch (e) {
    if (e instanceof CourrielNonConfigure) return reply(500, { error: String(e.message) });
    return reply(500, { error: String(e) });
  }
});
