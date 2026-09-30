/* Audit de contraste de la page affichee (refonte, 29/09/2026).
   Pour chaque texte visible : sa couleur, le fond plein qui est vraiment
   derriere lui (couches transparentes melangees), et s'il est pose sur
   une photo. Seuils WCAG AA : 4,5 pour le texte courant, 3 pour le gros
   (24 px, ou 18,66 px en gras). Rend la liste des fautes par section.
   Usage : coller dans la console, ou l'executer par l'outil du panneau. */
(function(){
  function rgba(s){
    var m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null;
    var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);
    return { r:p[0], g:p[1], b:p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function over(top, bot){ // top par-dessus bot (bot opaque)
    var a = top.a; return { r: top.r*a + bot.r*(1-a), g: top.g*a + bot.g*(1-a), b: top.b*a + bot.b*(1-a), a:1 };
  }
  function lum(c){ function f(v){ v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); } return .2126*f(c.r) + .7152*f(c.g) + .0722*f(c.b); }
  function ratio(a, b){ var x = lum(a), y = lum(b); return (Math.max(x,y) + .05) / (Math.min(x,y) + .05); }
  function visible(el){
    var r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    for (var n = el; n && n !== document.documentElement; n = n.parentElement){
      var cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < .05) return false;
      if (n.classList && n.classList.contains('bb-hide')) return false;
    }
    return true;
  }
  function recouvre(a, b){ return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }
  function fond(el){
    var couches = [], photo = null, r = el.getBoundingClientRect();
    for (var n = el; n; n = n.parentElement){
      var cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !photo) photo = 'fond-image ' + (n.id || n.className || n.tagName);
      var c = rgba(cs.backgroundColor);
      if (c && c.a > 0){ couches.push(c); if (c.a >= .99) break; }
      // une photo soeur, posee dessous en absolu
      if (!photo && n.parentElement){
        var kids = n.parentElement.children;
        for (var i = 0; i < kids.length; i++){
          var k = kids[i]; if (k === n || k.contains(el)) continue;
          var img = k.matches('img,video,picture,canvas') ? k : k.querySelector('img,video,canvas');
          if (!img) continue;
          var kcs = getComputedStyle(k);
          if (kcs.position !== 'absolute' && kcs.position !== 'fixed' && kcs.display !== 'contents') continue;
          if (kcs.display === 'none' || parseFloat(kcs.opacity) < .05) continue;
          if (recouvre(img.getBoundingClientRect(), r)) { photo = 'photo ' + (k.id || String(k.className).slice(0,30) || k.tagName); break; }
        }
      }
    }
    var base = { r:241, g:242, b:239, a:1 }; // fond de page
    for (var j = couches.length - 1; j >= 0; j--) base = over(couches[j], base);
    return { c: base, photo: photo };
  }
  function section(el){
    for (var n = el; n; n = n.parentElement){
      if (n.id && /^bb-(page|hero|evenement|lineup|presaison|galerie|tv|actus|effectif|media|shop|app|fo|try|partners|tribu|camp|footer|hdr|utility|live|results|nl|org|founder|staff|season|standings|comp|bill|ins|ac-|mf|jf)/.test(n.id)) return n.id;
    }
    return '?';
  }
  var fautes = [], vus = 0, surPhoto = [];
  var tous = document.querySelectorAll('body *:not(script):not(style):not(svg):not(svg *)');
  for (var i = 0; i < tous.length; i++){
    var el = tous[i];
    var txt = '';
    for (var k = 0; k < el.childNodes.length; k++){ var cn = el.childNodes[k]; if (cn.nodeType === 3) txt += cn.nodeValue; }
    txt = txt.replace(/\s+/g, ' ').trim(); if (!txt) continue;
    if (!visible(el)) continue;
    vus++;
    var cs = getComputedStyle(el), col = rgba(cs.color); if (!col) continue;
    var f = fond(el), c = over(col, f.c), rt = ratio(c, f.c);
    var px = parseFloat(cs.fontSize), gras = parseInt(cs.fontWeight, 10) >= 700;
    var seuil = (px >= 24 || (gras && px >= 18.66)) ? 3 : 4.5;
    var item = { sec: section(el), txt: txt.slice(0, 48), ratio: Math.round(rt*100)/100, seuil: seuil, couleur: cs.color, fond: 'rgb(' + Math.round(f.c.r) + ',' + Math.round(f.c.g) + ',' + Math.round(f.c.b) + ')', px: px };
    if (f.photo){ item.photo = f.photo; surPhoto.push(item); }
    else if (rt < seuil) fautes.push(item);
  }
  var parSec = {};
  fautes.forEach(function(f){ (parSec[f.sec] = parSec[f.sec] || []).push(f); });
  return { textesVus: vus, fautes: fautes.length, surPhoto: surPhoto.length, parSection: Object.keys(parSec).map(function(s){ return s + ' : ' + parSec[s].length; }), detail: fautes, photos: surPhoto };
})()
