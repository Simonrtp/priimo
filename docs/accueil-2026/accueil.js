/* ===========================================================================
   PRIIMO — ACCUEIL 2026 — script de la maquette
   ---------------------------------------------------------------------------
   Ce fichier sert à faire vivre la maquette hors Next.js :
     1. emplacements de capture (affichés tant que le PNG n'est pas déposé) ;
     2. vidéo du hero + modale « Voir Priimo en 60 secondes » ;
     3. panneau de réglages (édition des textes, affichage des sections).
   Au portage : les points 1 et 3 ne sont pas à reprendre. Le point 2 devient
   un petit composant client.
   =========================================================================== */
(function () {
  'use strict';

  var CLE_TEXTES   = 'priimo-accueil-textes';
  var CLE_SECTIONS = 'priimo-accueil-sections';
  var mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------------------
     1 — EMPLACEMENTS DE CAPTURE
     Une capture absente laisse apparaître le nom de fichier attendu.
     ------------------------------------------------------------------------- */
  function marqueVide(element) {
    var ecran = element.closest('[data-ecran]');
    if (ecran) ecran.classList.add('est-vide');
  }

  document.querySelectorAll('img[data-capture]').forEach(function (img) {
    img.addEventListener('error', function () { marqueVide(img); });
    if (img.complete && img.naturalWidth === 0) marqueVide(img);
  });

  var videoHero = document.querySelector('[data-video-hero]');
  if (videoHero) {
    videoHero.addEventListener('error', function () { marqueVide(videoHero); }, true);
    var source = videoHero.querySelector('source');
    if (source) source.addEventListener('error', function () { marqueVide(videoHero); });
  }

  /* -------------------------------------------------------------------------
     2 — VIDÉO
     Le hero joue en sourdine quand il est visible ; le bouton secondaire
     ouvre la modale avec le son et les contrôles.
     ------------------------------------------------------------------------- */
  if (videoHero && !mouvementReduit && 'IntersectionObserver' in window) {
    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        if (entree.isIntersecting) {
          var lecture = videoHero.play();
          if (lecture && lecture.catch) lecture.catch(function () {});
        } else {
          videoHero.pause();
        }
      });
    }, { threshold: 0.25 });
    observateur.observe(videoHero);
  }

  var modale = document.getElementById('modale-video');
  var videoModale = document.querySelector('[data-video-modale]');

  document.querySelectorAll('[data-ouvre-video]').forEach(function (bouton) {
    bouton.addEventListener('click', function () {
      if (!modale || !modale.showModal) return;
      if (videoHero) videoHero.pause();
      modale.showModal();
      if (videoModale) {
        var lecture = videoModale.play();
        if (lecture && lecture.catch) lecture.catch(function () {});
      }
    });
  });

  if (modale) {
    var fermer = modale.querySelector('[data-ferme-video]');
    if (fermer) fermer.addEventListener('click', function () { modale.close(); });

    modale.addEventListener('click', function (evenement) {
      if (evenement.target === modale) modale.close();
    });

    modale.addEventListener('close', function () {
      if (videoModale) { videoModale.pause(); videoModale.currentTime = 0; }
    });
  }

  /* -------------------------------------------------------------------------
     3 — PANNEAU DE RÉGLAGES
     Les champs sont construits à partir des attributs data-txt="Section / Champ".
     Ajouter un texte modifiable = ajouter l'attribut dans le HTML, rien d'autre.
     ------------------------------------------------------------------------- */
  var champs = Array.prototype.slice.call(document.querySelectorAll('[data-txt]'));
  var textesOrigine = {};
  champs.forEach(function (element) {
    textesOrigine[element.getAttribute('data-txt')] = element.textContent.trim();
  });

  function lire(cle, defaut) {
    try {
      var brut = window.localStorage.getItem(cle);
      return brut ? JSON.parse(brut) : defaut;
    } catch (e) { return defaut; }
  }
  function ecrire(cle, valeur) {
    try { window.localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) {}
  }

  var textes = lire(CLE_TEXTES, {});
  champs.forEach(function (element) {
    var cle = element.getAttribute('data-txt');
    if (typeof textes[cle] === 'string') element.textContent = textes[cle];
  });

  /* Construction des champs, groupés par section. */
  var conteneur = document.getElementById('reglages-textes');
  if (conteneur) {
    var groupes = {};
    var ordre = [];

    champs.forEach(function (element) {
      var cle = element.getAttribute('data-txt');
      var morceaux = cle.split(' / ');
      var groupe = morceaux[0];
      var libelle = morceaux.slice(1).join(' / ') || 'Texte';
      if (!groupes[groupe]) { groupes[groupe] = []; ordre.push(groupe); }
      groupes[groupe].push({ cle: cle, libelle: libelle, element: element });
    });

    ordre.forEach(function (nomGroupe) {
      var section = document.createElement('section');
      section.className = 'reglages__groupe';

      var titre = document.createElement('h2');
      titre.className = 'reglages__groupe-titre';
      titre.textContent = nomGroupe;
      section.appendChild(titre);

      groupes[nomGroupe].forEach(function (entree) {
        var label = document.createElement('label');
        label.className = 'champ';

        var legende = document.createElement('span');
        legende.textContent = entree.libelle;

        var zone = document.createElement('textarea');
        zone.rows = entree.element.textContent.trim().length > 70 ? 3 : 1;
        zone.value = entree.element.textContent.trim();
        zone.addEventListener('input', function () {
          entree.element.textContent = zone.value;
          textes[entree.cle] = zone.value;
          ecrire(CLE_TEXTES, textes);
        });

        label.appendChild(legende);
        label.appendChild(zone);
        section.appendChild(label);
      });

      conteneur.appendChild(section);
    });
  }

  /* Affichage des sections masquables. */
  var sections = lire(CLE_SECTIONS, { tarifs: true, temoignage: false });

  function appliqueSections() {
    Object.keys(sections).forEach(function (identifiant) {
      var section = document.getElementById(identifiant);
      if (section) section.hidden = !sections[identifiant];
    });
  }
  appliqueSections();

  document.querySelectorAll('[data-bascule]').forEach(function (case_) {
    var identifiant = case_.getAttribute('data-bascule');
    case_.checked = !!sections[identifiant];
    case_.addEventListener('change', function () {
      sections[identifiant] = case_.checked;
      ecrire(CLE_SECTIONS, sections);
      appliqueSections();
    });
  });

  /* Ouverture / fermeture du panneau. */
  var panneau = document.getElementById('reglages');
  var ouvrir = document.querySelector('[data-ouvre-reglages]');
  var fermerPanneau = document.querySelector('[data-ferme-reglages]');

  function bascule(ouvert) {
    if (!panneau || !ouvrir) return;
    panneau.hidden = !ouvert;
    ouvrir.setAttribute('aria-expanded', String(ouvert));
    ouvrir.hidden = ouvert;
  }
  if (ouvrir) ouvrir.addEventListener('click', function () { bascule(true); });
  if (fermerPanneau) fermerPanneau.addEventListener('click', function () { bascule(false); });

  document.addEventListener('keydown', function (evenement) {
    if (evenement.key === 'Escape' && panneau && !panneau.hidden) bascule(false);
  });

  /* Copier les textes / réinitialiser. */
  var boutonCopie = document.querySelector('[data-copie-textes]');
  if (boutonCopie) {
    boutonCopie.addEventListener('click', function () {
      var tout = {};
      champs.forEach(function (element) {
        tout[element.getAttribute('data-txt')] = element.textContent.trim();
      });
      var contenu = JSON.stringify(tout, null, 2);
      var libelle = boutonCopie.textContent;

      function confirme() {
        boutonCopie.textContent = 'Copié';
        setTimeout(function () { boutonCopie.textContent = libelle; }, 1600);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(contenu).then(confirme, function () { window.prompt('Textes de la page', contenu); });
      } else {
        window.prompt('Textes de la page', contenu);
      }
    });
  }

  var boutonReinit = document.querySelector('[data-reinit]');
  if (boutonReinit) {
    boutonReinit.addEventListener('click', function () {
      try {
        window.localStorage.removeItem(CLE_TEXTES);
        window.localStorage.removeItem(CLE_SECTIONS);
      } catch (e) {}
      window.location.reload();
    });
  }
})();
