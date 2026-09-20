// =====================================================================
//  Baobabs Basket Club — fonction serveur : l'alerte des arrivées
//
//  « y'a moyen d'être averti par mail quand je ne suis pas connecté sur
//    l'admin pour me prévenir des nouvelles ? » (20 septembre 2026)
//
//  Une seule fonction pour six tables : candidatures, inscriptions à
//  l'école, commandes, messages, et les profils déposés par un lien de
//  collecte (joueuses, staff). Elle est appelée par un déclencheur SQL
//  posé sur chaque table (MIGRATION-2026-09-20-alerte-des-arrivees.sql),
//  avec le corps standard d'un webhook Supabase : { type, table, record }.
//
//  QUI PEUT L'APPELER. Le jeton porté par le déclencheur est celui du
//  rôle service : on le lit et on refuse tout autre rôle. Pas de secret
//  supplémentaire à poser dans le tableau de bord, donc rien à
//  désynchroniser (c'est ce qui avait laissé alerte-inscription sans
//  déclencheur : voir CORRECTIF-2026-09-17-b, bloc 4).
//
//  UNE SEULE ALERTE PAR LIGNE. La table alertes_envoyees se remplit
//  AVANT l'envoi : une clé déjà prise, et la fonction se tait. Si l'envoi
//  échoue, la clé est retirée pour qu'un rejeu puisse réessayer.
//
//  ON NE CROIT QUE LA BASE. Le corps du webhook ne sert qu'à connaître
//  la table et l'identifiant ; la ligne est relue côté serveur, comme
//  alerte-inscription le faisait déjà.
//
//  L'ADRESSE QUI REÇOIT. bbc_config, clé alerte_email (lisible par le
//  rôle service seulement), puis le secret BBC_ALERT_EMAIL, puis
//  l'expéditeur BBC_SENDER_EMAIL. Plusieurs adresses possibles,
//  séparées par des virgules.
//
//  L'envoi lui-même vit dans ../_shared/courriel.ts (Resend).
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { envoyer, CourrielNonConfigure } from "../_shared/courriel.ts";

const ADMIN = "https://www.baobabsbasketclub.com/admin-matchs.html";

const reply = (code: number, body: unknown) =>
  new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } });

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fcfa = (n: unknown) => (n == null || n === "" ? "" : new Intl.NumberFormat("fr-FR").format(Number(n)) + " FCFA");
const court = (s: unknown, n = 700) => { const t = String(s ?? "").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };

type Ligne = Record<string, unknown>;
interface Message { sujet: string; titre: string; ecran: string; champs: [string, string][]; }
interface Table { message: (r: Ligne) => Message; garde?: (r: Ligne) => boolean; }

function articles(r: Ligne): string {
  let it: { name?: string; qty?: number; quantity?: number; size?: string }[] = [];
  try { it = Array.isArray(r.items) ? (r.items as typeof it) : JSON.parse(String(r.items || "[]")); } catch { it = []; }
  return it.map((x) => `${x.name || "Article"}${x.size ? " (" + x.size + ")" : ""} × ${x.qty || x.quantity || 1}`).join(", ");
}

const TABLES: Record<string, Table> = {
  recruitment_requests: {
    message: (r) => {
      const nom = [r.first_name, r.last_name].filter(Boolean).join(" ");
      return { sujet: `Nouvelle candidature : ${nom}`, titre: "Une candidature vient d'arriver", ecran: "Candidatures", champs: [
        ["Nom", nom], ["Catégorie", String(r.category ?? "")], ["Poste", String(r.position ?? "")], ["Ville", String(r.city ?? "")],
        ["Téléphone", String(r.phone ?? "")], ["E-mail", String(r.email ?? "")], ["Expérience", court(r.experience)], ["Message", court(r.message)],
      ] };
    },
  },
  academy_registrations: {
    message: (r) => {
      const enfant = [r.child_first_name, r.child_last_name].filter(Boolean).join(" ");
      return { sujet: `Nouvelle inscription à l'école : ${enfant}`, titre: "Une inscription à l'école vient d'arriver", ecran: "Inscriptions", champs: [
        ["Référence", String(r.reference ?? "")], ["Enfant", enfant], ["Catégorie", String(r.category ?? "")],
        ["Responsable", [r.guardian_name, r.guardian_relation ? "(" + r.guardian_relation + ")" : ""].filter(Boolean).join(" ")],
        ["Téléphone", [r.guardian_phone, r.guardian_phone2].filter(Boolean).join(" / ")], ["E-mail", String(r.guardian_email ?? "")], ["Message", court(r.message)],
      ] };
    },
  },
  orders: {
    message: (r) => ({ sujet: `Nouvelle commande ${r.order_number ?? ""} : ${fcfa(r.total)}`, titre: "Une commande vient d'arriver", ecran: "Commandes", champs: [
      ["Commande", String(r.order_number ?? "")], ["Client", String(r.customer_name ?? "")], ["Téléphone", String(r.customer_phone ?? "")], ["E-mail", String(r.customer_email ?? "")],
      ["Articles", articles(r)], ["Total", fcfa(r.total)], ["Code promo", r.promo_code ? `${String(r.promo_code).toUpperCase()} (${fcfa(r.discount_fcfa)} de remise)` : "aucun"],
      ["Retrait", String(r.pickup_location ?? "")], ["Paiement", String(r.payment_method ?? "")], ["Remarque", court(r.note)],
    ] }),
  },
  contact_messages: {
    message: (r) => ({ sujet: `Nouveau message de ${r.name || r.email || "un visiteur"}`, titre: "Un message vient d'arriver", ecran: "Messages", champs: [
      ["De", String(r.name ?? "")], ["E-mail", String(r.email ?? "")], ["Message", court(r.message, 2000)],
    ] }),
  },
  players: {
    garde: (r) => r.fiche_etat === "recue",
    message: (r) => ({ sujet: `Nouveau profil de joueuse : ${r.name ?? ""}`, titre: "Un profil de joueuse vient d'arriver par un lien de collecte", ecran: "Joueuses", champs: [
      ["Nom", String(r.name ?? "")], ["Ville", String(r.city ?? "")], ["Postes", Array.isArray(r.positions) ? (r.positions as string[]).join(", ") : String(r.positions ?? "")], ["Ancien club", String(r.previous_club ?? "")],
    ] }),
  },
  staff: {
    garde: (r) => r.fiche_etat === "recue",
    message: (r) => ({ sujet: `Nouveau profil de staff : ${r.name ?? ""}`, titre: "Un profil de staff vient d'arriver par un lien de collecte", ecran: "Staff", champs: [
      ["Nom", String(r.name ?? "")], ["Fonction", String(r.role ?? "")], ["Famille", String(r.categorie ?? "")], ["Diplôme", String(r.qualification ?? "")],
    ] }),
  },
};

function gabarit(m: Message): { html: string; text: string } {
  const lignes = m.champs.filter(([, v]) => v && String(v).trim());
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#fff">
    <div style="background:#0A1B0D;padding:22px 24px"><div style="color:#C6A257;font-weight:800;font-size:16px;letter-spacing:.04em">BAOBABS BASKET CLUB</div></div>
    <div style="padding:24px">
      <h1 style="font-size:19px;color:#0A1B0D;margin:0 0 16px">${esc(m.titre)}</h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${lignes.map(([k, v]) => `<tr><td style="padding:7px 10px 7px 0;color:#8a9088;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:7px 0;color:#0A1B0D;white-space:pre-line">${esc(v)}</td></tr>`).join("")}
      </table>
      <p style="margin:22px 0 0"><a href="${ADMIN}" style="display:inline-block;background:#46BF1D;color:#0A1B0D;font-weight:700;text-decoration:none;padding:11px 16px;border-radius:6px">Ouvrir l'admin, écran ${esc(m.ecran)}</a></p>
      <p style="font-size:12px;color:#8a9088;margin-top:22px">Vous recevez ce message parce que le club vous a désigné pour les alertes. Dans l'admin, MAYA vous l'annonce aussi.</p>
    </div>
  </div>`;
  const text = m.titre + "\n\n" + lignes.map(([k, v]) => k + " : " + v).join("\n") + "\n\nOuvrir l'admin (écran " + m.ecran + ") : " + ADMIN;
  return { html, text };
}

function roleDuJeton(req: Request): string {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const p = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(p.role || "");
  } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "POST attendu" });
  if (roleDuJeton(req) !== "service_role") return reply(401, { error: "appel non autorisé" });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const table = String((body as { table?: string }).table || "");
  const rec = (body as { record?: { id?: string } }).record;
  const def = TABLES[table];
  if (!def || !rec?.id) return reply(200, { skipped: true, reason: "rien à annoncer" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { error: eDedup } = await db.from("alertes_envoyees").insert({ table_name: table, ligne_id: rec.id });
  if (eDedup) return reply(200, { skipped: true, reason: eDedup.code === "23505" ? "déjà envoyée" : "dédoublonnage : " + eDedup.message });
  const retirer = () => db.from("alertes_envoyees").delete().match({ table_name: table, ligne_id: rec.id });

  const { data: r } = await db.from(table).select("*").eq("id", rec.id).single();
  if (!r) { await retirer(); return reply(200, { skipped: true, reason: "ligne introuvable" }); }
  if (def.garde && !def.garde(r)) return reply(200, { skipped: true, reason: "pas à annoncer" });

  const { data: cfg } = await db.from("bbc_config").select("valeur").eq("cle", "alerte_email").maybeSingle();
  const to = String(cfg?.valeur || Deno.env.get("BBC_ALERT_EMAIL") || Deno.env.get("BBC_SENDER_EMAIL") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length) { await retirer(); return reply(200, { skipped: true, reason: "aucune adresse d'alerte" }); }

  const m = def.message(r);
  const g = gabarit(m);
  try {
    const res = await envoyer({ to, subject: m.sujet, html: g.html, text: g.text });
    if (!res.ok) { await retirer(); return reply(502, { error: "envoi refusé", detail: res.detail }); }
  } catch (e) {
    await retirer();
    if (e instanceof CourrielNonConfigure) return reply(503, { error: "courriel non configuré", detail: e.message });
    return reply(500, { error: "inattendu", detail: String(e) });
  }
  return reply(200, { sent: true, table, to: to.length });
});
