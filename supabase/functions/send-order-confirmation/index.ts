// =====================================================================
// Baobabs Basket Club — Edge Function : confirmation de commande
//
// Déclenchée par un Database Webhook Supabase sur INSERT dans `orders`.
// N'envoie un email que si customer_email est renseigné.
// La clé Resend reste côté serveur (secret de fonction),
// jamais exposée dans index.html.
//
// CE FICHIER N'EXISTAIT QUE DANS LE TABLEAU DE BORD jusqu'au 13 septembre
// 2026 (déployé « Via Editor », version 4). Il est ramené dans le dépôt
// pour une seule raison : l'adresse d'expédition était écrite en dur,
// onboarding@resend.dev, l'adresse de test de Resend, qui n'atteint que
// le propriétaire du compte Resend. Un client ne recevait donc rien.
// L'expéditeur vient désormais de ../_shared/courriel.ts : BBC_SENDER_EMAIL
// dès que le secret existe, l'adresse de test sinon. Les réponses des
// clients arrivent sur la boîte du club (repondreA()).
//
// Pour redéployer après modification :
//   npx supabase functions deploy send-order-confirmation --project-ref lmwbwasupqkvswukieav
//
// Configuration (déjà en place en production) :
//   Secrets : RESEND_API_KEY, WEBHOOK_SECRET, et BBC_SENDER_EMAIL une
//   fois le domaine vérifié dans Resend.
//   Database → Webhooks : table orders, Insert, vers cette fonction,
//   en-tête x-webhook-secret = WEBHOOK_SECRET.
//
// Un Database Webhook n'envoie pas de clé publishable/secret Supabase —
// il envoie ses propres headers. On utilise donc auth:'none' (aucune
// vérification par le SDK) et on vérifie nous-mêmes x-webhook-secret
// avant de faire quoi que ce soit, exactement comme Supabase recommande
// pour les fournisseurs externes (Stripe, GitHub, etc.).
// =====================================================================

import { withSupabase } from "jsr:@supabase/server@^1";
import { expediteurOuTest, repondreA } from "../_shared/courriel.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

function escHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function formatFCFA(n: number | null | undefined): string {
  if (n == null) return "";
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

interface OrderItem {
  id?: string;
  name?: string;
  size?: string;
  qty?: number;
  unit_price?: number;
}

function buildEmailHtml(order: Record<string, unknown>): string {
  let items: OrderItem[] = [];
  try {
    items = Array.isArray(order.items) ? (order.items as OrderItem[]) : JSON.parse(String(order.items || "[]"));
  } catch {
    items = [];
  }

  const itemsRows = items
    .map((it) => {
      const lineTotal = it.unit_price && it.qty ? it.unit_price * it.qty : null;
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e0d5">
            <div style="font-weight:600;color:#0A1B0D">${escHtml(it.name || "Article")}</div>
            ${it.size ? `<div style="font-size:13px;color:#6b7268">Taille : ${escHtml(it.size)}</div>` : ""}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e0d5;text-align:center;color:#6b7268">×${escHtml(it.qty ?? 1)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e0d5;text-align:right;font-weight:600;color:#0A1B0D">${lineTotal ? formatFCFA(lineTotal) : ""}</td>
        </tr>`;
    })
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#ffffff">
    <div style="background:#0A1B0D;padding:28px 24px;text-align:center">
      <div style="color:#C6A257;font-weight:800;font-size:18px;letter-spacing:.04em">BAOBABS BASKET CLUB</div>
    </div>
    <div style="padding:28px 24px">
      <h1 style="font-size:20px;color:#0A1B0D;margin:0 0 6px">Commande confirmée</h1>
      <p style="color:#4a5049;font-size:14px;margin:0 0 22px">
        Merci ${escHtml(order.customer_name)}, votre commande <b>${escHtml(order.order_number)}</b> a bien été reçue.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        <thead>
          <tr>
            <th style="text-align:left;font-size:12px;color:#8a9088;padding-bottom:8px;border-bottom:2px solid #0A1B0D">Article</th>
            <th style="text-align:center;font-size:12px;color:#8a9088;padding-bottom:8px;border-bottom:2px solid #0A1B0D">Qté</th>
            <th style="text-align:right;font-size:12px;color:#8a9088;padding-bottom:8px;border-bottom:2px solid #0A1B0D">Sous-total</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div style="text-align:right;font-size:17px;font-weight:800;color:#0A1B0D;margin-bottom:22px">
        Total : ${formatFCFA(order.total as number)}
      </div>
      ${order.pickup_location ? `<p style="font-size:14px;color:#4a5049"><b>Lieu de retrait :</b> ${escHtml(order.pickup_location)}</p>` : ""}
      ${order.payment_method ? `<p style="font-size:14px;color:#4a5049"><b>Paiement :</b> ${escHtml(order.payment_method)}</p>` : ""}
      ${order.note ? `<p style="font-size:14px;color:#4a5049"><b>Votre précision :</b> ${escHtml(order.note)}</p>` : ""}
      <p style="font-size:13px;color:#8a9088;margin-top:24px">
        Nous vous recontacterons au ${escHtml(order.customer_phone)} pour confirmer les modalités.
      </p>
    </div>
    <div style="background:#f4f1e8;padding:16px 24px;text-align:center;font-size:12px;color:#8a9088">
      Baobabs Basket Club — Dakar, Sénégal
    </div>
  </div>`;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    try {
      // Vérification manuelle du webhook — voir note en haut de fichier.
      if (WEBHOOK_SECRET) {
        const incomingSecret = req.headers.get("x-webhook-secret");
        if (incomingSecret !== WEBHOOK_SECRET) {
          return new Response(JSON.stringify({ error: "invalid_webhook_secret" }), { status: 401 });
        }
      } else {
        console.warn("WEBHOOK_SECRET non configuré — la fonction accepte toute requête. À corriger avant mise en production.");
      }

      if (!RESEND_API_KEY) {
        console.error("RESEND_API_KEY manquante dans les secrets de la fonction.");
        return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), { status: 200 });
      }

      const payload = await req.json();
      // Format standard d'un Database Webhook Supabase : { type, table, record, old_record }
      const order = payload.record ?? payload;

      if (!order || !order.id) {
        return new Response(JSON.stringify({ skipped: true, reason: "no_order_in_payload" }), { status: 200 });
      }

      if (!order.customer_email) {
        return new Response(JSON.stringify({ skipped: true, reason: "no_email_provided" }), { status: 200 });
      }

      if (order.confirmation_email_sent) {
        return new Response(JSON.stringify({ skipped: true, reason: "already_sent" }), { status: 200 });
      }

      const emailHtml = buildEmailHtml(order);

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: expediteurOuTest(),
          to: order.customer_email,
          reply_to: repondreA(),
          subject: `Commande ${order.order_number} confirmée — Baobabs Basket Club`,
          html: emailHtml,
        }),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error("Échec envoi Resend:", errText);
        return new Response(JSON.stringify({ error: "resend_failed", detail: errText }), { status: 502 });
      }

      // Marque la commande comme "email envoyé" pour éviter les doublons.
      // ctx.supabase ici est un client admin (bypass RLS) car withSupabase
      // provisionne automatiquement les clés nécessaires côté plateforme.
      const { error: updateError } = await ctx.supabase
        .from("orders")
        .update({ confirmation_email_sent: true })
        .eq("id", order.id);

      if (updateError) {
        console.error("Échec du marquage confirmation_email_sent:", updateError);
      }

      return new Response(JSON.stringify({ sent: true }), { status: 200 });
    } catch (err) {
      console.error("Erreur inattendue:", err);
      return new Response(JSON.stringify({ error: "unexpected", detail: String(err) }), { status: 500 });
    }
  }),
};
