/* ============================================================
   POURQUOI LA COMPOSITION N'APPARAÎT PAS
   ============================================================
   À coller dans la console du SITE PUBLIC (pas l'admin).
   Ouvre https://www.baobabsbasketclub.com → F12 → Console → colle → Entrée.

   Il teste chaque maillon de la chaîne, dans l'ordre, et s'arrête au
   premier qui casse. Aucune écriture : que des lectures.
   ============================================================ */
(async () => {
  const URL = "https://lmwbwasupqkvswukieav.supabase.co";
  const KEY = "sb_publishable_68RKprorqTmVkzjHrKgdZw_h-AcMXRh";
  const H = { apikey: KEY, Authorization: "Bearer " + KEY };
  const lire = async (q) => {
    const r = await fetch(URL + "/rest/v1/" + q, { headers: H });
    return { ok: r.ok, code: r.status, corps: r.ok ? await r.json() : (await r.text()).slice(0, 160) };
  };
  const R = {};

  // 0. la section est-elle seulement dans la page ?
  const sec = document.getElementById("bb-lineup");
  R["0. section présente dans la page"] = !!sec;
  if (!sec) {
    R["→ CAUSE"] = "La page servie est l'ancienne. Vercel n'a pas encore déployé, ou le navigateur garde la page en cache — recharge avec Ctrl+Maj+R.";
    return R;
  }
  R["0b. section visible"] = !sec.classList.contains("bb-hide");

  // 1. y a-t-il un match à venir, et le site peut-il le lire ?
  const auj = new Date().toISOString().slice(0, 10);
  const m = await lire("matches?select=id,opponent_name,match_date,is_home&match_date=gte." + auj + "&order=match_date.asc&limit=1");
  R["1. lecture de matches"] = m.ok ? "OK" : "REFUSÉE (" + m.code + ") " + m.corps;
  if (!m.ok) {
    R["→ CAUSE"] = "Le site public n'a pas le droit de lire la table matches. C'est une politique RLS à ouvrir en lecture.";
    return R;
  }
  const match = (m.corps || [])[0];
  R["2. prochain match trouvé"] = match ? (match.opponent_name + " le " + match.match_date) : "AUCUN";
  if (!match) {
    R["→ CAUSE"] = "Aucun match avec une date >= aujourd'hui dans la table matches. Créez le prochain match dans l'admin (écran Matchs).";
    return R;
  }

  // 3. la feuille de match est-elle lisible depuis le site ?
  const st = await lire("match_stats?select=player_id,is_starter&match_id=eq." + encodeURIComponent(match.id));
  R["3. lecture de match_stats"] = st.ok ? "OK" : "REFUSÉE (" + st.code + ") " + st.corps;
  if (!st.ok) {
    R["→ CAUSE"] = "Le site public n'a pas le droit de lire match_stats. C'est la cause la plus probable — demandez-moi le SQL.";
    return R;
  }
  const lignes = st.corps || [];
  R["4. lignes dans la feuille"] = lignes.length;
  const titulaires = lignes.filter((l) => l.is_starter);
  R["5. titulaires désignés"] = titulaires.length;
  if (!titulaires.length) {
    R["→ CAUSE"] = "Le cinq de départ n'est pas désigné pour ce match. Ouvrez « Soir de match » dans l'admin et posez cinq joueuses sur le terrain.";
    return R;
  }

  // 6. les joueuses désignées existent-elles dans l'effectif du site ?
  const pl = await lire("players?select=id,name,jersey_number,position,status&limit=200");
  R["6. lecture de players"] = pl.ok ? "OK" : "REFUSÉE (" + pl.code + ")";
  if (pl.ok) {
    const parId = {};
    (pl.corps || []).forEach((p) => (parId[String(p.id)] = p));
    const retrouvees = titulaires.filter((l) => parId[String(l.player_id)]);
    R["7. titulaires retrouvées dans l'effectif"] = retrouvees.length + " / " + titulaires.length;
    R["   noms"] = retrouvees.map((l) => {
      const p = parId[String(l.player_id)];
      return (p.jersey_number ?? "?") + " · " + p.name + " · " + (p.position || "sans poste");
    });
    if (!retrouvees.length) {
      R["→ CAUSE"] = "Les joueuses du cinq ne sont pas retrouvées dans l'effectif public (parties du club, ou identifiants différents).";
      return R;
    }
  }

  // 7. le coach
  const sf = await lire("staff?select=name,role&order=sort.asc");
  R["8. lecture de staff"] = sf.ok ? "OK" : "REFUSÉE (" + sf.code + ")";
  if (sf.ok) {
    const coach = (sf.corps || []).filter((s) => /coach|entra/i.test(s.role || ""))[0];
    R["9. coach reconnu"] = coach ? coach.name + " (" + coach.role + ")" : "AUCUN — le bloc coach ne s'affichera pas, le reste oui";
  }

  R["→ VERDICT"] = "Toute la chaîne répond. Si la section reste invisible, rechargez en Ctrl+Maj+R : la page servie est encore l'ancienne.";
  return R;
})();
