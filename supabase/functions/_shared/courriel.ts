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
//    BBC_REPLY_TO      — facultatif, voir REPONDRE_A_PAR_DEFAUT ci-dessous
//
//  CE QUI CHANGE ENTRE LES DEUX FOURNISSEURS, et c'est tout :
//    Brevo   sender:{email,name}   to:[{email}]   htmlContent
//    Resend  from:"Nom <adresse>"  to:["adresse"] html
//
//  L'ADRESSE D'ENVOI N'EST PAS FORCÉMENT UNE BOÎTE QU'ON LIT.
//  Resend exige un domaine vérifié pour le champ « from » — une adresse
//  du genre club@baobabsbasketclub.com convient très bien, même si
//  personne n'ouvre cette boîte. Mais confirmation-reservation promet au
//  client « Répondez simplement à cet e-mail », et la newsletter invite
//  à répondre STOP pour se désinscrire : une réponse à une adresse que
//  personne ne lit part dans le vide. D'où repondreA() plus bas, posée
//  sur TOUT envoi par défaut, sans réglage à ajouter dans Supabase.
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

// LA BOÎTE OÙ ATTERRIT UNE RÉPONSE, PAR DÉFAUT.
// C'est l'adresse déjà connue du reste de l'admin — voir AUDIT_NAMES
// dans admin-matchs.html, où 'baobabsbasketclub@gmail.com' est déjà
// identifiée comme « Le gérant ». Rien de secret ici : c'est une adresse
// de contact publique, pas une clé. BBC_REPLY_TO permet de la remplacer
// sans toucher au code, si le club change un jour de boîte de réception.
const REPONDRE_A_PAR_DEFAUT = "baobabsbasketclub@gmail.com";
export function repondreA(): string {
  return Deno.env.get("BBC_REPLY_TO") || REPONDRE_A_PAR_DEFAUT;
}

// L'ADRESSE DE TEST DE RESEND, POUR L'E-MAIL DE COMMANDE SEULEMENT.
// Elle n'atteint que le propriétaire du compte Resend : un client, lui,
// ne reçoit rien. send-order-confirmation l'utilisait en dur ; il prend
// désormais BBC_SENDER_EMAIL dès que le secret existe, et ne retombe sur
// l'adresse de test qu'en son absence, pour ne pas casser le webhook.
// La newsletter, elle, refuse d'envoyer sans vraie adresse (expediteur()) :
// un envoi à cent abonnés depuis l'adresse de test serait cent silences.
export const EXPEDITEUR_TEST = "Baobabs Basket Club <onboarding@resend.dev>";
export function expediteurOuTest(): string {
  try { return expediteur(); } catch { return EXPEDITEUR_TEST; }
}

function corps(m: Courriel) {
  const o: Record<string, unknown> = {
    from: expediteur(),
    to: m.to,
    subject: m.subject,
    html: m.html,
    reply_to: repondreA(),
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

// =====================================================================
//  L'ÉTAT DE L'ENVOI, DIT PAR CELUI QUI ENVOIE.
//
//  Personne ne peut lire les secrets d'une fonction depuis l'extérieur :
//  ni l'admin, ni l'outillage. On ne sait donc pas, depuis l'écran
//  Newsletter, si la clé Resend est posée, si l'adresse d'expédition
//  existe, ni si son domaine est vérifié. On l'apprenait au premier
//  envoi, par un 500 sec.
//
//  Cette fonction répond à ces questions sans rien révéler : elle dit si
//  chaque secret est là, et demande à Resend la liste des domaines et
//  leur statut (GET /domains). L'adresse d'expédition est rendue telle
//  quelle, c'est celle que chaque abonné verra dans sa boîte.
//
//  Une clé Resend « sending only » ne peut pas lister les domaines :
//  Resend répond 401 avec un message qui le dit. On le distingue d'une
//  clé refusée pour ne pas accuser une clé qui marche.
// =====================================================================
export interface EtatDomaine { nom: string; statut: string }
export interface EtatCourriel {
  cle: "absente" | "invalide" | "restreinte" | "valide";
  cle_detail: string;
  domaines: EtatDomaine[];
  expediteur: string | null;
  nom: string;
  repondre_a: string;
  domaine_expediteur: string | null;
  expediteur_verifie: boolean | null;   // null : la clé n'a pas pu lister
  test_seulement: boolean;              // onboarding@resend.dev
  pret: boolean;
  manque: string[];
}

export async function etat(): Promise<EtatCourriel> {
  const e: EtatCourriel = {
    cle: "absente", cle_detail: "", domaines: [],
    expediteur: (Deno.env.get("BBC_SENDER_EMAIL") || "").trim() || null,
    nom: Deno.env.get("BBC_SENDER_NAME") || "Baobabs Basket Club",
    repondre_a: repondreA(),
    domaine_expediteur: null, expediteur_verifie: null, test_seulement: false,
    pret: false, manque: [],
  };
  const k = Deno.env.get("RESEND_API_KEY");
  if (k) {
    try {
      const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${k}` } });
      const txt = await r.text();
      if (r.ok) {
        e.cle = "valide";
        let j: { data?: { name?: string; status?: string }[] } = {};
        try { j = JSON.parse(txt); } catch { /* corps inattendu : liste vide */ }
        e.domaines = (j.data || []).map((d) => ({ nom: String(d.name || ""), statut: String(d.status || "") }));
      } else if (/restricted|only send/i.test(txt)) {
        e.cle = "restreinte"; e.cle_detail = txt.slice(0, 300);
      } else {
        e.cle = "invalide"; e.cle_detail = txt.slice(0, 300);
      }
    } catch (err) {
      e.cle = "restreinte"; e.cle_detail = "Resend injoignable : " + String(err);
    }
  }
  if (e.expediteur) {
    const m = /@([^>\s]+)>?$/.exec(e.expediteur);
    e.domaine_expediteur = m ? m[1].toLowerCase() : null;
    e.test_seulement = e.domaine_expediteur === "resend.dev";
    if (e.cle === "valide" && e.domaine_expediteur) {
      const d = e.domaines.find((x) => x.nom.toLowerCase() === e.domaine_expediteur);
      e.expediteur_verifie = !!d && d.statut === "verified";
    }
  }

  if (e.cle === "absente") e.manque.push("Ajouter le secret RESEND_API_KEY dans Supabase (Edge Functions, Secrets) : la clé se crée sur resend.com, API Keys.");
  else if (e.cle === "invalide") e.manque.push("Resend refuse la clé RESEND_API_KEY : la recréer sur resend.com, API Keys, puis remplacer le secret dans Supabase.");
  if (!e.expediteur) e.manque.push("Ajouter le secret BBC_SENDER_EMAIL : une adresse sur un domaine vérifié dans Resend, par exemple club@baobabsbasketclub.com.");
  else if (e.test_seulement) e.manque.push("L'adresse onboarding@resend.dev n'envoie qu'au propriétaire du compte Resend : les abonnés ne recevront rien. Il faut une adresse sur le domaine du club.");
  else if (!e.domaine_expediteur) e.manque.push("BBC_SENDER_EMAIL n'est pas une adresse valable : attendu quelque chose comme club@baobabsbasketclub.com.");
  else if (e.cle === "valide") {
    const d = e.domaines.find((x) => x.nom.toLowerCase() === e.domaine_expediteur);
    if (!d) e.manque.push(`Le domaine ${e.domaine_expediteur} n'est pas ajouté dans Resend : resend.com, Domains, Add domain, puis poser les enregistrements DNS donnés (DKIM, SPF) chez l'hébergeur du nom de domaine.`);
    else if (d.statut !== "verified") e.manque.push(`Le domaine ${e.domaine_expediteur} est ajouté dans Resend mais pas vérifié (statut : ${d.statut}) : contrôler les enregistrements DNS chez l'hébergeur, puis « Verify » dans Resend.`);
  }
  e.pret = e.manque.length === 0 && (e.cle === "valide" || e.cle === "restreinte");
  return e;
}
