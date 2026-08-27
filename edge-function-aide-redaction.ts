// =====================================================================
// Baobabs Basket Club — Edge Function : aide à la rédaction (admin)
//
// Appelée directement depuis admin-matchs.html (navigateur), avec la
// session Supabase de l'utilisateur connecté à l'admin — donc auth
// requise (pas de webhook externe ici, contrairement à
// send-order-confirmation).
//
// Deux actions, choisies par le champ "action" du corps de la requête :
//   - "generate" : écrit une bio à partir des infos de la fiche
//   - "check"    : relit un texte existant et relève les fautes
//                  (orthographe, conjugaison), sans le modifier
//
// La clé Claude reste côté serveur (secret de fonction),
// jamais exposée dans admin-matchs.html.
//
// Configuration nécessaire dans Supabase :
//   1. Dashboard → Edge Functions → Create a new function → "Via Editor"
//      → nommer "generate-text" → coller ce fichier → Deploy
//   2. Dashboard → Edge Functions → generate-text → Secrets
//      → ajouter ANTHROPIC_API_KEY
//   3. Rien à faire côté Database Webhooks : cette fonction n'est PAS
//      un webhook, elle est appelée directement par l'admin avec le
//      token de session de l'utilisateur connecté (withSupabase
//      vérifie ce token automatiquement, auth n'est donc pas "none"
//      ici, contrairement à send-order-confirmation).
// =====================================================================

import { withSupabase } from "jsr:@supabase/server@^1";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-4-6";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

interface PlayerInfo {
  name?: string;
  position?: string;
  height?: string;
  city?: string;
  birth_year?: number;
  detail?: string; // le champ optionnel "détail à mentionner" tapé par l'utilisateur
}

function currentAge(birthYear?: number): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

function buildGeneratePrompt(info: PlayerInfo): string {
  const age = currentAge(info.birth_year);
  const facts = [
    info.name ? `Nom : ${info.name}` : null,
    info.position ? `Poste : ${info.position}` : null,
    info.height ? `Taille : ${info.height}` : null,
    info.city ? `Ville : ${info.city}` : null,
    age != null ? `Âge : ${age} ans` : null,
    info.detail ? `Détail à mentionner : ${info.detail}` : null,
  ].filter(Boolean).join("\n");

  return `Tu écris une bio courte (3 à 4 phrases) pour la fiche scouting d'une joueuse de basket sur le site du Baobabs Basket Club, un club de Dakar, Sénégal.

Style attendu (exemples de bios déjà publiées sur le site) :
"Chef d'orchestre des Baobabs, Aïda dicte le tempo et sait accélérer dans le money time. Une meneuse lucide qui fait briller ses coéquipières."
"Ailière athlétique et adroite de loin, Fatou étire les défenses et se projette vite en transition. Un profil moderne, précieux des deux côtés du terrain."

Ton : valorisant, sportif, concret. Pas de superlatifs vides, pas de formules toutes faites hors style ci-dessus. Pas de tirets cadratins.

Informations sur la joueuse :
${facts}

Réponds uniquement avec le texte de la bio, sans guillemets, sans préambule.`;
}

function buildCheckPrompt(text: string): string {
  return `Relis ce texte en français (bio d'une joueuse de basket) et relève UNIQUEMENT les fautes d'orthographe, de grammaire ou de conjugaison. Ignore le style ou les choix de formulation si ce n'est pas une faute.

Texte à relire :
"""
${text}
"""

Réponds STRICTEMENT en JSON, sans aucun texte avant ou après, selon ce format exact :
{"errors": [{"original": "extrait fautif exact", "correction": "extrait corrigé", "explanation": "courte explication"}]}

Si aucune faute n'est trouvée, réponds {"errors": []}.`;
}

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error: ${errText}`);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
  return textBlock?.text?.trim() || "";
}

export default {
  fetch: withSupabase({ auth: "required" }, async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (!ANTHROPIC_API_KEY) {
        console.error("ANTHROPIC_API_KEY manquante dans les secrets de la fonction.");
        return jsonResponse({ error: "no_api_key" }, 500);
      }

      const payload = await req.json();
      const action = payload.action;

      if (action === "generate") {
        const prompt = buildGeneratePrompt(payload.player || {});
        const bio = await callClaude(prompt, 300);
        return jsonResponse({ bio });
      }

      if (action === "check") {
        const text = String(payload.text || "").trim();
        if (!text) return jsonResponse({ errors: [] });
        const raw = await callClaude(buildCheckPrompt(text), 800);
        let parsed: { errors: unknown[] };
        try {
          const cleaned = raw.replace(/^```json|```$/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch {
          console.error("Réponse non-JSON de Claude pour 'check':", raw);
          return jsonResponse({ error: "parse_failed" }, 502);
        }
        return jsonResponse(parsed);
      }

      return jsonResponse({ error: "unknown_action" }, 400);
    } catch (err) {
      console.error("Erreur inattendue:", err);
      return jsonResponse({ error: "unexpected", detail: String(err) }, 500);
    }
  }),
};
