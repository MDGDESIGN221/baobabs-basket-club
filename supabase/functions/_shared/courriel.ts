// =====================================================================
//  Baobabs Basket Club — l'envoi d'e-mail, à un seul endroit
//
//  POURQUOI CE FICHIER EXISTE
//  Trois fonctions envoyaient du courrier, chacune avec sa propre copie
//  de l'appel au fournisseur. Trois copies ne peuvent que diverger — et
//  elles avaient déjà divergé de la réalité : elles étaient écrites pour
//  Brevo, alors que le projet tourne sur Resend depuis l'e-mail de
//  commande. Les secrets BREVO_API_KEY et BBC_SENDER_EMAIL n'ont jamais
//  existé sur ce projet ; les trois fonctions étaient déployées et
//  répondaient 500 sans envoyer quoi que ce soit.
//
//  Changer de fournisseur se fait désormais ici, et nulle part ailleurs.
//
//  LES SECRETS (Supabase → Edge Functions → Secrets)
//    RESEND_API_KEY    — existe déjà, c'est celle de l'e-mail de commande
//    BBC_SENDER_EMAIL  — l'adresse d'expéditeur. Elle doit appartenir à
//                        un domaine VÉRIFIÉ dans Resend, sinon l'envoi
//                        est refusé. C'est la seule chose à ajouter.
//    BBC_SENDER_NAME   — facultatif, « Baobabs Basket Club » par défaut
//
//  CE QUI CHANGE ENTRE LES DEUX FOURNISSEURS, et c'est tout :
//    Brevo   sender:{email,name}   to:[{email}]   htmlContent
//    Resend  from:"Nom <adresse>"  to:["adresse"] html
// =====================================================================

export interface Courriel {
  to: string[];          // une ou plusieurs adresses
  subject: string;
  html: string;
  text?: string;
}

export class CourrielNonConfigure extends Error {}

function cle(): string {
  const k = Deno.env.get("RESEND_API_KEY");
  if (!k) throw new CourrielNonConfigure("RESEND_API_KEY manquant");
  return k;
}

// « Baobabs Basket Club <club@baobabsbasketclub.com> » — la forme que
// Resend attend. Le nom est facultatif, l'adresse ne l'est pas.
export function expediteur(): string {
  const email = Deno.env.get("BBC_SENDER_EMAIL");
  if (!email) throw new CourrielNonConfigure("BBC_SENDER_EMAIL manquant");
  const nom = Deno.env.get("BBC_SENDER_NAME") || "Baobabs Basket Club";
  return `${nom} <${email}>`;
}

// MÊME FORME POUR UN DESTINATAIRE. La newsletter envoyait le prénom de
// chaque abonné à Brevo (to:[{email,name}]) : le message arrivait adressé
// dans le client de messagerie, pas juste balancé à une adresse. Resend
// n'a pas de champ name séparé — la même forme "Nom <adresse>" sert pour
// l'expéditeur et le destinataire.
export function destinataire(email: string, nom?: string | null): string {
  return nom && nom.trim() ? `${nom.trim()} <${email}>` : email;
}

function corps(m: Courriel) {
  const o: Record<string, unknown> = {
    from: expediteur(),
    to: m.to,
    subject: m.subject,
    html: m.html,
  };
  if (m.text) o.text = m.text;
  return o;
}

/** Un envoi. Lève si la configuration manque, rend le texte de l'erreur
 *  du fournisseur sinon — l'appelant décide quoi en faire. */
export async function envoyer(m: Courriel): Promise<{ ok: boolean; detail: string }> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle()}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps(m)),
  });
  return { ok: r.ok, detail: r.ok ? "" : await r.text() };
}

// UN MESSAGE PAR PERSONNE, JAMAIS DE LISTE VISIBLE.
// C'est la règle de la newsletter : personne ne doit voir l'adresse des
// autres. Brevo le faisait avec messageVersions, Resend avec /emails/batch
// — un objet complet par destinataire, cent au maximum par appel.
export const LOT_MAX = 100;

export async function envoyerLot(messages: Courriel[]): Promise<{ ok: boolean; detail: string }> {
  if (!messages.length) return { ok: true, detail: "" };
  if (messages.length > LOT_MAX) {
    return { ok: false, detail: `lot de ${messages.length} au-delà du maximum de ${LOT_MAX}` };
  }
  const r = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle()}`, "Content-Type": "application/json" },
    body: JSON.stringify(messages.map(corps)),
  });
  return { ok: r.ok, detail: r.ok ? "" : await r.text() };
}
